/**
 * Service for storing and retrieving AI provider API keys in browser localStorage
 * Keys are encrypted using Web Crypto API before storage
 */

const STORAGE_KEY_PREFIX = 'eduai_api_key_';
const ENCRYPTION_KEY_NAME = 'eduai_encryption_key';

export type AIProvider = 'google' | 'openai' | 'deepseek' | 'anthropic';

/**
 * Generate or retrieve the encryption key for this browser
 * The key is derived from a combination of browser fingerprint and stored salt
 */
async function getEncryptionKey(): Promise<CryptoKey> {
  // Try to get existing salt from localStorage
  let salt = localStorage.getItem(ENCRYPTION_KEY_NAME);

  if (!salt) {
    // Generate new salt and store it
    const saltArray = crypto.getRandomValues(new Uint8Array(16));
    salt = Array.from(saltArray, byte => byte.toString(16).padStart(2, '0')).join('');
    localStorage.setItem(ENCRYPTION_KEY_NAME, salt);
  }

  // Create a key from the salt using PBKDF2
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(salt),
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: encoder.encode('eduai-storage-salt'),
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt a string value
 */
async function encrypt(value: string): Promise<string> {
  const key = await getEncryptionKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoder = new TextEncoder();

  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(value)
  );

  // Combine IV and encrypted data
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(encrypted), iv.length);

  // Convert to base64
  return btoa(String.fromCharCode(...combined));
}

/**
 * Decrypt a string value
 */
async function decrypt(encryptedValue: string): Promise<string> {
  try {
    const key = await getEncryptionKey();
    const decoder = new TextDecoder();

    // Decode from base64
    const combined = Uint8Array.from(atob(encryptedValue), c => c.charCodeAt(0));

    // Extract IV and encrypted data
    const iv = combined.slice(0, 12);
    const encrypted = combined.slice(12);

    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      encrypted
    );

    return decoder.decode(decrypted);
  } catch (error) {
    console.error('Decryption failed:', error);
    return '';
  }
}

export const apiKeyStorage = {
  /**
   * Store an API key for a specific provider (encrypted)
   */
  async setApiKey(provider: AIProvider, apiKey: string): Promise<void> {
    const encrypted = await encrypt(apiKey);
    localStorage.setItem(`${STORAGE_KEY_PREFIX}${provider}`, encrypted);
  },

  /**
   * Get an API key for a specific provider (decrypted)
   */
  async getApiKey(provider: AIProvider): Promise<string | null> {
    const encrypted = localStorage.getItem(`${STORAGE_KEY_PREFIX}${provider}`);
    if (!encrypted) return null;
    return await decrypt(encrypted);
  },

  /**
   * Remove an API key for a specific provider
   */
  removeApiKey(provider: AIProvider): void {
    localStorage.removeItem(`${STORAGE_KEY_PREFIX}${provider}`);
  },

  /**
   * Get all stored API keys as an object (decrypted)
   */
  async getAllApiKeys(): Promise<Record<string, string>> {
    const keys: Record<string, string> = {};
    const providers: AIProvider[] = ['google', 'openai', 'deepseek', 'anthropic'];

    for (const provider of providers) {
      const key = await this.getApiKey(provider);
      if (key) {
        keys[provider] = key;
      }
    }

    return keys;
  },

  /**
   * Extract provider name from model ID (e.g., "google:gemini-2.5-flash" -> "google")
   */
  getProviderFromModel(modelId: string): AIProvider | null {
    const provider = modelId.split(':')[0].toLowerCase();
    if (['google', 'openai', 'deepseek', 'anthropic'].includes(provider)) {
      return provider as AIProvider;
    }
    return null;
  },

  /**
   * Check if a provider needs an API key (non-ollama models)
   */
  requiresApiKey(modelId: string): boolean {
    return !modelId.startsWith('ollama');
  },

  /**
   * Build the apiKeys object for EduAI API based on selected model
   */
  async buildApiKeysForModel(modelId: string): Promise<Record<string, any>> {
    if (modelId.startsWith('ollama')) {
      return {
        ollama: {
          isEnabled: true
        }
      };
    }

    const provider = this.getProviderFromModel(modelId);
    if (!provider) {
      return {};
    }

    const apiKey = await this.getApiKey(provider);
    if (!apiKey) {
      return {};
    }

    return {
      [provider]: {
        apiKey,
        isEnabled: true
      }
    };
  }
};

export default apiKeyStorage;

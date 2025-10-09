const { describe, it, expect } = require('@jest/globals');

describe('Authentication Service Tests', () => {
  it('should validate email format', () => {
    const isValidEmail = (email) => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return emailRegex.test(email);
    };

    expect(isValidEmail('test@example.com')).toBe(true);
    expect(isValidEmail('invalid-email')).toBe(false);
    expect(isValidEmail('user@domain')).toBe(false);
  });

  it('should validate password strength', () => {
    const isStrongPassword = (password) => {
      return password.length >= 8 && 
             /[A-Z]/.test(password) && 
             /[a-z]/.test(password) && 
             /[0-9]/.test(password);
    };

    expect(isStrongPassword('Password123')).toBe(true);
    expect(isStrongPassword('weak')).toBe(false);
    expect(isStrongPassword('password123')).toBe(false);
  });

  it('should hash passwords', () => {
    // Mock password hashing for testing
    const mockHash = (password) => {
      return 'hashed_' + password + '_salt';
    };
    
    const password = 'testpassword';
    const hash = mockHash(password);
    
    expect(hash).toBeDefined();
    expect(hash).not.toBe(password);
    expect(hash).toContain('hashed_');
  });
});

describe('Question Service Tests', () => {
  it('should validate question types', () => {
    const validTypes = ['multiple-choice', 'true-false', 'short-answer', 'essay'];
    
    const isValidType = (type) => validTypes.includes(type);
    
    expect(isValidType('multiple-choice')).toBe(true);
    expect(isValidType('invalid-type')).toBe(false);
  });

  it('should validate difficulty levels', () => {
    const validDifficulties = ['easy', 'medium', 'hard'];
    
    const isValidDifficulty = (difficulty) => validDifficulties.includes(difficulty);
    
    expect(isValidDifficulty('medium')).toBe(true);
    expect(isValidDifficulty('invalid')).toBe(false);
  });
});

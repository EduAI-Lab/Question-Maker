/**
 * Jest runs this file before tests. Fixed secrets keep JWT and encryption tests deterministic.
 */
process.env.JWT_SECRET = 'test-jwt-secret-for-unit-tests';
process.env.ENCRYPTION_KEY = 'test-encryption-key-32bytes!!';

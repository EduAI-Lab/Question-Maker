export default {
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/../tests'],
  testMatch: [
    '**/__tests__/**/*.js',
    '**/?(*.)+(spec|test).js'
  ],
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/index.js',
    '!src/config/**'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  setupFilesAfterEnv: ['<rootDir>/../tests/setup.js'],
  moduleFileExtensions: ['js', 'json'],
  transform: {},
  testTimeout: 10000
};

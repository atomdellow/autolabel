module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.js?(x)'],
  setupFilesAfterEnv: ['./jest.setup.js'], // Optional: for global setup
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/uploads/',
    '/trained_models/',
    '/training_data/',
    '/scripts/'
  ],
  collectCoverage: true,
  coverageReporters: ['json', 'lcov', 'text', 'clover'],
  coverageThreshold: { // Optional: enforce coverage levels
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },
};

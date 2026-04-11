module.exports = {
  testEnvironment: 'node',
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/index.js',
    '!src/db/migrate.js',
    '!src/db/seed.js',
  ],
  testMatch: ['**/__tests__/**/*.test.js', '**/*.test.js'],
  modulePathIgnorePatterns: ['<rootDir>/node_modules/'],
  testTimeout: 10000,
};

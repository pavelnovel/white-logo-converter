module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  testTimeout: 15000, // 15 seconds for ImageMagick operations
  verbose: true,
  maxWorkers: 1, // Run tests sequentially to avoid race conditions on shared directories
};

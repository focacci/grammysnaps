module.exports = {
  // Use ts-jest preset for TypeScript support
  preset: "ts-jest",

  // Test environment
  testEnvironment: "node",

  // Root directory for tests
  rootDir: ".",

  // Test file patterns
  testMatch: ["**/*.test.ts"],

  // Coverage configuration
  collectCoverageFrom: [
    "src/**/*.ts",
    "!**/*.d.ts",
    "!**/node_modules/**",
    "!**/dist/**",
    "!**/*.test.ts",
  ],

  // Coverage output directory
  coverageDirectory: "./coverage",

  // Coverage reporters
  coverageReporters: ["text", "lcov", "html"],

  // Module paths
  moduleFileExtensions: ["ts", "js", "json"],

  // Transform files with ts-jest
  transform: {
    "^.+\\.ts$": [
      "ts-jest",
      {
        tsconfig: "tsconfig.test.json",
      },
    ],
  },

  // Setup files to run before tests
  setupFilesAfterEnv: ["<rootDir>/test-setup.ts"],

  // Clear mocks between tests
  clearMocks: true,

  // Restore mocks after each test
  restoreMocks: true,

  // Verbose output
  verbose: true,
};

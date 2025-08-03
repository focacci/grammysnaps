// Test setup file
// This file runs before each test file

// Load testing environment variables
import dotenv from "dotenv";
dotenv.config({ path: "./testing.env" });

// Global test timeout
jest.setTimeout(10000);

// Mock console methods to keep test output clean
global.console = {
  ...console,
  // Comment out the next line to see console output during tests
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

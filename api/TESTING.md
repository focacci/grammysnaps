# API Testing Guide

This document describes the testing setup and practices for the GrammySnaps API.

## Test Framework

We use **Jest** with TypeScript support via `ts-jest` for our testing framework.

## Test Structure

```
api/
├── test-setup.ts          # Global test setup
├── test-utils.ts          # Test utilities and helpers
├── tsconfig.test.json     # TypeScript config for tests
├── jest.config.js         # Jest configuration
└── src/
    ├── middleware/
    │   ├── auth.middleware.ts
    │   └── auth.middleware.test.ts
    └── [other modules]/
        ├── [module].ts
        └── [module].test.ts
```

## Running Tests

### Basic Commands

```bash
# Run all tests
npm test

# Run tests in watch mode (re-runs on file changes)
npm run test:watch

# Run tests with coverage report
npm run test:coverage

# Run tests for CI/CD (no watch, with coverage)
npm run test:ci
```

### Test File Patterns

Jest will automatically find and run files matching these patterns:

- `**/__tests__/**/*.test.ts`
- `**/*.test.ts`

## Test Configuration

### Jest Configuration (`jest.config.js`)

- **Preset**: `ts-jest` for TypeScript support
- **Environment**: Node.js
- **Coverage**: Enabled with text, HTML, and LCOV reporters
- **Setup**: Global setup file at `test-setup.ts`

### TypeScript Support

Tests are written in TypeScript and use a dedicated `tsconfig.test.json` configuration that extends the main TypeScript config to include test files and utilities.

## Writing Tests

### Test File Naming

- Place test files adjacent to the code being tested
- Use the `.test.ts` suffix
- Name test files to match the module being tested: `auth.middleware.test.ts`

### Test Structure

```typescript
describe("ModuleName", () => {
  beforeEach(() => {
    // Setup before each test
    jest.clearAllMocks();
  });

  describe("when specific condition", () => {
    it("should have expected behavior", () => {
      // Test implementation
    });
  });
});
```

### Mocking Guidelines

#### 1. Mock External Dependencies

```typescript
// Mock Fastify server and plugins
const mockServer = {
  log: { error: jest.fn() },
  auth: { verifyAccessToken: jest.fn() },
};
```

#### 2. Mock at the Module Level

```typescript
// For mocking entire modules
jest.mock("../some-module", () => ({
  someFunction: jest.fn(),
}));
```

#### 3. Clear Mocks Between Tests

```typescript
beforeEach(() => {
  jest.clearAllMocks();
});
```

### Testing Middleware

When testing Fastify middleware:

1. **Mock Request and Reply Objects**

   ```typescript
   const mockRequest = {
     headers: {},
     server: {
       /* mock server */
     },
     // ...other properties
   } as FastifyRequest;

   const mockReply = {
     status: jest.fn().mockReturnThis(),
     send: jest.fn().mockReturnThis(),
   } as any;
   ```

2. **Test All Code Paths**

   - Success cases
   - Error cases
   - Edge cases
   - Invalid inputs

3. **Verify Side Effects**
   ```typescript
   expect(mockReply.status).toHaveBeenCalledWith(401);
   expect(mockReply.send).toHaveBeenCalledWith({ error: "..." });
   ```

## Coverage Goals

- **Statements**: > 80%
- **Branches**: > 80%
- **Functions**: > 80%
- **Lines**: > 80%

### Current Coverage

Run `npm run test:coverage` to see current coverage statistics.

## Best Practices

### 1. Unit Test Principles

- **Fast**: Tests should run quickly
- **Independent**: Tests should not depend on each other
- **Repeatable**: Tests should produce the same results every time
- **Self-Validating**: Tests should have clear pass/fail results
- **Timely**: Tests should be written close to when the code is written

### 2. Test Organization

- Group related tests with `describe` blocks
- Use descriptive test names that explain the behavior
- Test one behavior per `it` block
- Use `beforeEach`/`afterEach` for setup/cleanup

### 3. Assertions

- Use specific assertions (`toBe`, `toEqual`, `toHaveBeenCalledWith`)
- Test both positive and negative cases
- Verify all side effects

### 4. Mocking Strategy

- Mock external dependencies (databases, APIs, etc.)
- Don't mock the code under test
- Use the least amount of mocking necessary
- Prefer dependency injection for easier testing

## Example: Auth Middleware Tests

See `src/middleware/auth.middleware.test.ts` for a comprehensive example of:

- Mocking Fastify request/reply objects
- Testing success and error paths
- Testing edge cases
- Verifying function calls and side effects
- TypeScript interface compliance

## Future Testing Considerations

### Integration Tests

For testing multiple components together:

- Set up test database
- Test full request/response cycles
- Verify database interactions

### E2E Tests

For testing complete user flows:

- Use tools like Supertest
- Test authentication flows
- Test complete CRUD operations

### Performance Tests

For testing performance characteristics:

- Load testing with tools like Artillery
- Memory leak detection
- Response time benchmarks

import { FastifyRequest, FastifyReply } from "fastify";

/**
 * Test utilities for creating mock Fastify objects and common test helpers
 */

export interface MockFastifyServer {
  log: {
    error: jest.MockedFunction<any>;
    info: jest.MockedFunction<any>;
    warn: jest.MockedFunction<any>;
    debug: jest.MockedFunction<any>;
  };
  auth?: {
    verifyAccessToken: jest.MockedFunction<any>;
    generateAccessToken: jest.MockedFunction<any>;
    generateRefreshToken: jest.MockedFunction<any>;
  };
  pg?: {
    query: jest.MockedFunction<any>;
  };
  s3?: {
    upload: jest.MockedFunction<any>;
    delete: jest.MockedFunction<any>;
    getSignedUrl: jest.MockedFunction<any>;
  };
}

/**
 * Creates a mock Fastify request object with sensible defaults
 */
export const createMockRequest = (
  overrides: Partial<FastifyRequest> = {}
): FastifyRequest => {
  const mockServer: MockFastifyServer = {
    log: {
      error: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    },
    auth: {
      verifyAccessToken: jest.fn(),
      generateAccessToken: jest.fn(),
      generateRefreshToken: jest.fn(),
    },
    pg: {
      query: jest.fn(),
    },
    s3: {
      upload: jest.fn(),
      delete: jest.fn(),
      getSignedUrl: jest.fn(),
    },
  };

  return {
    headers: {},
    body: {},
    params: {},
    query: {},
    server: mockServer,
    ...overrides,
  } as any;
};

/**
 * Creates a mock Fastify reply object with chainable methods
 */
export const createMockReply = (
  overrides: Partial<FastifyReply> = {}
): FastifyReply => {
  const reply = {
    status: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
    header: jest.fn().mockReturnThis(),
    type: jest.fn().mockReturnThis(),
    code: jest.fn().mockReturnThis(),
    ...overrides,
  };

  return reply as any;
};

/**
 * Creates a mock user payload for authentication tests
 */
export const createMockUserPayload = (overrides: any = {}) => ({
  userId: "test-user-123",
  email: "test@example.com",
  ...overrides,
});

/**
 * Creates a mock database query result
 */
export const createMockQueryResult = <T = any>(
  rows: T[] = [],
  overrides: any = {}
) => ({
  rows,
  rowCount: rows.length,
  command: "SELECT",
  fields: [],
  ...overrides,
});

/**
 * Common test assertions for error responses
 */
export const expectErrorResponse = (
  mockReply: FastifyReply,
  statusCode: number,
  errorMessage: string
) => {
  expect(mockReply.status).toHaveBeenCalledWith(statusCode);
  expect(mockReply.send).toHaveBeenCalledWith({
    error: errorMessage,
  });
};

/**
 * Common test assertions for success responses
 */
export const expectSuccessResponse = (
  mockReply: FastifyReply,
  statusCode: number = 200,
  data?: any
) => {
  if (statusCode !== 200) {
    expect(mockReply.status).toHaveBeenCalledWith(statusCode);
  }
  if (data !== undefined) {
    expect(mockReply.send).toHaveBeenCalledWith(data);
  }
};

/**
 * Utility to wait for async operations in tests
 */
export const waitFor = (ms: number = 0) =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Utility to create a mock file object for multipart uploads
 */
export const createMockFile = (overrides: any = {}) => ({
  fieldname: "file",
  originalname: "test.jpg",
  encoding: "7bit",
  mimetype: "image/jpeg",
  size: 1024,
  buffer: Buffer.from("fake-image-data"),
  ...overrides,
});

/**
 * Utility to generate random test data
 */
export const generateTestData = {
  email: (prefix = "test") => `${prefix}-${Date.now()}@example.com`,
  uuid: () => `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  name: (prefix = "Test") =>
    `${prefix} ${Math.random().toString(36).substr(2, 9)}`,
  timestamp: () => new Date().toISOString(),
};

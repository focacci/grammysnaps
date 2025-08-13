import Fastify, { FastifyInstance } from "fastify";
import authRoutes from "./auth.routes";
import { UserPublic, LoginInput } from "../types/user.types";
import { ValidationUtils } from "../utils/validation";
import { AUTH_ERRORS } from "../types/errors";
import { TEST_UUIDS } from "../test-utils/test-data";

// Mock validation utilities
jest.mock("../utils/validation", () => ({
  ValidationUtils: {
    sanitizeEmail: jest.fn((email) => email.toLowerCase().trim()),
  },
}));

// Mock auth middleware to always pass
jest.mock("../middleware/auth.middleware", () => ({
  requireAuth: jest.fn(async (request) => {
    // Mock successful authentication by setting user on request
    request.user = {
      userId: "user-123",
      email: "test@example.com",
    };
    // Don't call reply.send() or return anything - just let the request continue
  }),
}));

// User plugin mocks
const mockUserCreate = jest.fn();
const mockUserGet = jest.fn();
const mockUserGetByEmail = jest.fn();
const mockUserGetById = jest.fn();
const mockUserUpdate = jest.fn();
const mockUserUpdateSecurity = jest.fn();
const mockUserDelete = jest.fn();
const mockUserValidatePassword = jest.fn();
const mockUserAddToFamily = jest.fn();
const mockUserRemoveFromFamily = jest.fn();

// Auth plugin mocks
const mockGenerateTokens = jest.fn();
const mockVerifyRefreshToken = jest.fn();
const mockVerifyAccessToken = jest.fn();
const mockValidateSession = jest.fn();
const mockRevokeUserTokens = jest.fn();

describe("Auth Routes", () => {
  let fastify: FastifyInstance;

  const mockUser: UserPublic = {
    id: TEST_UUIDS.USER_1,
    email: "test@example.com",
    first_name: "John",
    last_name: "Doe",
    families: [TEST_UUIDS.FAMILY_1],
    created_at: "2023-01-01T00:00:00Z",
    updated_at: "2023-01-01T00:00:00Z",
  };

  const mockUserWithPassword = {
    ...mockUser,
    password_hash: "hashed-password",
  };

  beforeEach(async () => {
    // Create a new Fastify instance for each test
    fastify = Fastify({ logger: false });

    // Decorate the fastify instance with mock plugins
    fastify.decorate("user", {
      create: mockUserCreate,
      get: mockUserGet,
      getByEmail: mockUserGetByEmail,
      getById: mockUserGetById,
      update: mockUserUpdate,
      updateSecurity: mockUserUpdateSecurity,
      delete: mockUserDelete,
      validatePassword: mockUserValidatePassword,
      addToFamily: mockUserAddToFamily,
      removeFromFamily: mockUserRemoveFromFamily,
    } as any);

    fastify.decorate("auth", {
      generateTokens: mockGenerateTokens,
      verifyRefreshToken: mockVerifyRefreshToken,
      verifyAccessToken: mockVerifyAccessToken,
      validateSession: mockValidateSession,
      revokeUserTokens: mockRevokeUserTokens,
    } as any);

    // Register auth routes
    await fastify.register(authRoutes);

    // Wait for all plugins to be ready
    await fastify.ready();

    // Clear all mocks and reset ValidationUtils mock
    jest.clearAllMocks();
    const mockedValidationUtils = ValidationUtils as jest.Mocked<
      typeof ValidationUtils
    >;
    mockedValidationUtils.sanitizeEmail.mockImplementation((email) =>
      email.toLowerCase().trim()
    );
  });

  afterEach(async () => {
    await fastify.close();
  });

  describe("POST /login", () => {
    const validLoginData: LoginInput = {
      email: "test@example.com",
      password: "password123",
    };

    it("should successfully login with valid credentials", async () => {
      const mockTokens = {
        accessToken: "mock-access-token",
        refreshToken: "mock-refresh-token",
      };

      mockUserGetByEmail.mockResolvedValue(mockUserWithPassword);
      mockUserValidatePassword.mockResolvedValue(true);
      mockGenerateTokens.mockResolvedValue(mockTokens);

      const response = await fastify.inject({
        method: "POST",
        url: "/login",
        payload: validLoginData,
      });

      expect(response.statusCode).toBe(200);
      const responseBody = JSON.parse(response.body);
      expect(responseBody).toEqual({
        user: mockUser,
        accessToken: mockTokens.accessToken,
        refreshToken: mockTokens.refreshToken,
      });

      expect(mockUserGetByEmail).toHaveBeenCalledWith("test@example.com");
      expect(mockUserValidatePassword).toHaveBeenCalledWith(
        mockUserWithPassword,
        "password123"
      );
      expect(mockGenerateTokens).toHaveBeenCalledWith(mockUser);
    });

    it("should return 500 for missing email when validation throws", async () => {
      const mockedValidationUtils = ValidationUtils as jest.Mocked<
        typeof ValidationUtils
      >;
      mockedValidationUtils.sanitizeEmail.mockImplementation(() => {
        throw new Error("Email is required and must be a string");
      });

      const response = await fastify.inject({
        method: "POST",
        url: "/login",
        payload: {
          password: "password123",
        },
      });

      expect(response.statusCode).toBe(500);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.error).toBe(AUTH_ERRORS.LOGIN_FAILED);
    });

    it("should return 400 for missing password", async () => {
      const response = await fastify.inject({
        method: "POST",
        url: "/login",
        payload: {
          email: "test@example.com",
        },
      });

      expect(response.statusCode).toBe(400);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.error).toBe(AUTH_ERRORS.PASSWORD_REQUIRED);
    });

    it("should return 400 for invalid password type", async () => {
      const response = await fastify.inject({
        method: "POST",
        url: "/login",
        payload: {
          email: "test@example.com",
          password: 123,
        },
      });

      expect(response.statusCode).toBe(400);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.error).toBe(AUTH_ERRORS.PASSWORD_REQUIRED);
    });

    it("should return 401 for non-existent user", async () => {
      mockUserGetByEmail.mockResolvedValue(null);

      const response = await fastify.inject({
        method: "POST",
        url: "/login",
        payload: validLoginData,
      });

      expect(response.statusCode).toBe(401);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.error).toBe(AUTH_ERRORS.INVALID_CREDENTIALS);
    });

    it("should return 401 for invalid password", async () => {
      mockUserGetByEmail.mockResolvedValue(mockUserWithPassword);
      mockUserValidatePassword.mockResolvedValue(false);

      const response = await fastify.inject({
        method: "POST",
        url: "/login",
        payload: validLoginData,
      });

      expect(response.statusCode).toBe(401);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.error).toBe(AUTH_ERRORS.INVALID_CREDENTIALS);
    });

    it("should return 400 for validation error from sanitizeEmail", async () => {
      const mockedValidationUtils = ValidationUtils as jest.Mocked<
        typeof ValidationUtils
      >;
      mockedValidationUtils.sanitizeEmail.mockImplementation(() => {
        throw new Error("Invalid email format");
      });

      const response = await fastify.inject({
        method: "POST",
        url: "/login",
        payload: {
          email: "invalid-email",
          password: "password123",
        },
      });

      expect(response.statusCode).toBe(400);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.error).toBe("Invalid email format");
    });

    it("should return 500 for unexpected database error", async () => {
      const mockedValidationUtils = ValidationUtils as jest.Mocked<
        typeof ValidationUtils
      >;
      mockedValidationUtils.sanitizeEmail.mockReturnValue("test@example.com");
      mockUserGetByEmail.mockRejectedValue(new Error("Database error"));

      const response = await fastify.inject({
        method: "POST",
        url: "/login",
        payload: validLoginData,
      });

      expect(response.statusCode).toBe(500);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.error).toBe(AUTH_ERRORS.LOGIN_FAILED);
    });
  });

  describe("POST /refresh", () => {
    const validRefreshData = {
      refreshToken: "valid-refresh-token",
    };

    it("should successfully refresh tokens with valid refresh token", async () => {
      const mockTokenPayload = { userId: "user-123" };
      const mockNewTokens = {
        accessToken: "new-access-token",
        refreshToken: "new-refresh-token",
      };

      mockVerifyRefreshToken.mockResolvedValue(mockTokenPayload);
      mockUserGetById.mockResolvedValue(mockUser);
      mockGenerateTokens.mockResolvedValue(mockNewTokens);

      const response = await fastify.inject({
        method: "POST",
        url: "/refresh",
        payload: validRefreshData,
      });

      expect(response.statusCode).toBe(200);
      const responseBody = JSON.parse(response.body);
      expect(responseBody).toEqual({
        user: mockUser,
        accessToken: mockNewTokens.accessToken,
        refreshToken: mockNewTokens.refreshToken,
      });

      expect(mockVerifyRefreshToken).toHaveBeenCalledWith(
        "valid-refresh-token"
      );
      expect(mockUserGetById).toHaveBeenCalledWith("user-123");
      expect(mockGenerateTokens).toHaveBeenCalledWith(mockUser);
    });

    it("should return 401 for missing refresh token", async () => {
      const response = await fastify.inject({
        method: "POST",
        url: "/refresh",
        payload: {},
      });

      expect(response.statusCode).toBe(401);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.error).toBe(AUTH_ERRORS.REFRESH_TOKEN_REQUIRED);
    });

    it("should return 401 for invalid refresh token", async () => {
      mockVerifyRefreshToken.mockResolvedValue(null);

      const response = await fastify.inject({
        method: "POST",
        url: "/refresh",
        payload: validRefreshData,
      });

      expect(response.statusCode).toBe(401);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.error).toBe(AUTH_ERRORS.SESSION_EXPIRED);
    });

    it("should return 401 for user not found", async () => {
      const mockTokenPayload = { userId: "user-123" };
      mockVerifyRefreshToken.mockResolvedValue(mockTokenPayload);
      mockUserGetById.mockResolvedValue(null);

      const response = await fastify.inject({
        method: "POST",
        url: "/refresh",
        payload: validRefreshData,
      });

      expect(response.statusCode).toBe(401);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.error).toBe(AUTH_ERRORS.ACCOUNT_NOT_FOUND);
    });

    it("should return 500 for unexpected error", async () => {
      mockVerifyRefreshToken.mockRejectedValue(
        new Error("Token verification error")
      );

      const response = await fastify.inject({
        method: "POST",
        url: "/refresh",
        payload: validRefreshData,
      });

      expect(response.statusCode).toBe(500);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.error).toBe(AUTH_ERRORS.REFRESH_FAILED);
    });
  });

  describe("POST /logout", () => {
    const validLogoutData = {
      userId: "user-123",
    };

    it("should successfully logout with valid user ID", async () => {
      const response = await fastify.inject({
        method: "POST",
        url: "/logout",
        payload: validLogoutData,
        headers: {
          authorization: "Bearer mock-token", // Required for auth middleware
        },
      });

      expect(response.statusCode).toBe(200);
      const responseBody = JSON.parse(response.body);
      expect(responseBody).toEqual({
        message: "Logged out successfully",
      });
    });

    it("should handle logout without user ID", async () => {
      const response = await fastify.inject({
        method: "POST",
        url: "/logout",
        payload: {},
        headers: {
          authorization: "Bearer mock-token", // Required for auth middleware
        },
      });

      expect(response.statusCode).toBe(200);
      const responseBody = JSON.parse(response.body);
      expect(responseBody).toEqual({
        message: "Logged out successfully",
      });
    });

    it("should work with mocked auth middleware", async () => {
      // This test verifies that the auth middleware mock is working
      const response = await fastify.inject({
        method: "POST",
        url: "/logout",
        payload: validLogoutData,
        headers: {
          authorization: "Bearer any-token-works-with-mock",
        },
      });

      expect(response.statusCode).toBe(200);
      const responseBody = JSON.parse(response.body);
      expect(responseBody).toEqual({
        message: "Logged out successfully",
      });
    });
  });

  describe("GET /validate", () => {
    it("should successfully validate session with valid token", async () => {
      const mockTokenPayload = { userId: "user-123" };
      mockVerifyAccessToken.mockResolvedValue(mockTokenPayload);
      mockValidateSession.mockResolvedValue(mockUser);

      const response = await fastify.inject({
        method: "GET",
        url: "/validate",
        headers: {
          authorization: "Bearer valid-access-token",
        },
      });

      expect(response.statusCode).toBe(200);
      const responseBody = JSON.parse(response.body);
      expect(responseBody).toEqual({
        user: mockUser,
      });

      expect(mockVerifyAccessToken).toHaveBeenCalledWith("valid-access-token");
      expect(mockValidateSession).toHaveBeenCalledWith("user-123");
    });

    it("should return 401 for missing authorization header", async () => {
      const response = await fastify.inject({
        method: "GET",
        url: "/validate",
      });

      expect(response.statusCode).toBe(401);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.error).toBe(AUTH_ERRORS.TOKEN_REQUIRED);
    });

    it("should return 401 for malformed authorization header", async () => {
      const response = await fastify.inject({
        method: "GET",
        url: "/validate",
        headers: {
          authorization: "InvalidFormat token",
        },
      });

      expect(response.statusCode).toBe(401);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.error).toBe(AUTH_ERRORS.TOKEN_REQUIRED);
    });

    it("should return 401 for invalid access token", async () => {
      mockVerifyAccessToken.mockResolvedValue(null);

      const response = await fastify.inject({
        method: "GET",
        url: "/validate",
        headers: {
          authorization: "Bearer invalid-token",
        },
      });

      expect(response.statusCode).toBe(401);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.error).toBe(AUTH_ERRORS.SESSION_EXPIRED);
    });

    it("should return 401 for invalid session", async () => {
      const mockTokenPayload = { userId: "user-123" };
      mockVerifyAccessToken.mockResolvedValue(mockTokenPayload);
      mockValidateSession.mockResolvedValue(null);

      const response = await fastify.inject({
        method: "GET",
        url: "/validate",
        headers: {
          authorization: "Bearer valid-token",
        },
      });

      expect(response.statusCode).toBe(401);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.error).toBe(AUTH_ERRORS.SESSION_INVALID);
    });

    it("should return 500 for unexpected error", async () => {
      mockVerifyAccessToken.mockRejectedValue(
        new Error("Token verification error")
      );

      const response = await fastify.inject({
        method: "GET",
        url: "/validate",
        headers: {
          authorization: "Bearer valid-token",
        },
      });

      expect(response.statusCode).toBe(500);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.error).toBe(AUTH_ERRORS.VALIDATION_FAILED);
    });
  });

  describe("Edge Cases and Integration", () => {
    it("should handle empty request body for login", async () => {
      const response = await fastify.inject({
        method: "POST",
        url: "/login",
        payload: {},
      });

      expect(response.statusCode).toBe(500);
    });

    it("should handle malformed JSON in request body", async () => {
      const response = await fastify.inject({
        method: "POST",
        url: "/login",
        payload: "invalid-json",
        headers: {
          "content-type": "application/json",
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it("should sanitize email input correctly", async () => {
      const mockedValidationUtils = ValidationUtils as jest.Mocked<
        typeof ValidationUtils
      >;
      mockedValidationUtils.sanitizeEmail.mockReturnValue("test@example.com");

      mockUserGetByEmail.mockResolvedValue(mockUserWithPassword);
      mockUserValidatePassword.mockResolvedValue(true);
      mockGenerateTokens.mockResolvedValue({
        accessToken: "token",
        refreshToken: "refresh",
      });

      await fastify.inject({
        method: "POST",
        url: "/login",
        payload: {
          email: "  TEST@EXAMPLE.COM  ",
          password: "password123",
        },
      });

      expect(mockedValidationUtils.sanitizeEmail).toHaveBeenCalledWith(
        "  TEST@EXAMPLE.COM  "
      );
      expect(mockUserGetByEmail).toHaveBeenCalledWith("test@example.com");
    });

    it("should not expose password hash in login response", async () => {
      mockUserGetByEmail.mockResolvedValue(mockUserWithPassword);
      mockUserValidatePassword.mockResolvedValue(true);
      mockGenerateTokens.mockResolvedValue({
        accessToken: "token",
        refreshToken: "refresh",
      });

      const response = await fastify.inject({
        method: "POST",
        url: "/login",
        payload: {
          email: "test@example.com",
          password: "password123",
        },
      });

      const responseBody = JSON.parse(response.body);
      expect(responseBody.user).not.toHaveProperty("password_hash");
      expect(responseBody.user).toEqual(mockUser);
    });
  });
});

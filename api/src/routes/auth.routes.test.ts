import Fastify, { FastifyInstance } from "fastify";
import authRoutes from "./auth.routes";
import { UserPublic, LoginInput } from "../types/user.types";
import { ValidationUtils } from "../utils/validation";

// Mock validation utilities
jest.mock("../utils/validation", () => ({
  ValidationUtils: {
    sanitizeEmail: jest.fn((email) => email.toLowerCase().trim()),
  },
}));

describe("Auth Routes", () => {
  let fastify: FastifyInstance;
  let mockUserPlugin: {
    create: jest.MockedFunction<any>;
    get: jest.MockedFunction<any>;
    getByEmail: jest.MockedFunction<any>;
    getById: jest.MockedFunction<any>;
    update: jest.MockedFunction<any>;
    updateSecurity: jest.MockedFunction<any>;
    delete: jest.MockedFunction<any>;
    validatePassword: jest.MockedFunction<any>;
    addToFamily: jest.MockedFunction<any>;
    removeFromFamily: jest.MockedFunction<any>;
  };
  let mockAuthPlugin: {
    generateTokens: jest.MockedFunction<any>;
    verifyRefreshToken: jest.MockedFunction<any>;
    verifyAccessToken: jest.MockedFunction<any>;
    validateSession: jest.MockedFunction<any>;
    revokeUserTokens: jest.MockedFunction<any>;
  };

  const mockUser: UserPublic = {
    id: "user-123",
    email: "test@example.com",
    first_name: "John",
    last_name: "Doe",
    families: ["family-1"],
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

    // Create mock plugins
    mockUserPlugin = {
      create: jest.fn(),
      get: jest.fn(),
      getByEmail: jest.fn(),
      getById: jest.fn(),
      update: jest.fn(),
      updateSecurity: jest.fn(),
      delete: jest.fn(),
      validatePassword: jest.fn(),
      addToFamily: jest.fn(),
      removeFromFamily: jest.fn(),
    };

    mockAuthPlugin = {
      generateTokens: jest.fn(),
      verifyRefreshToken: jest.fn(),
      verifyAccessToken: jest.fn(),
      validateSession: jest.fn(),
      revokeUserTokens: jest.fn(),
    };

    // Decorate the fastify instance with mock plugins
    fastify.decorate("user", mockUserPlugin);
    fastify.decorate("auth", mockAuthPlugin);

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

      mockUserPlugin.getByEmail.mockResolvedValue(mockUserWithPassword);
      mockUserPlugin.validatePassword.mockResolvedValue(true);
      mockAuthPlugin.generateTokens.mockResolvedValue(mockTokens);

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

      expect(mockUserPlugin.getByEmail).toHaveBeenCalledWith(
        "test@example.com"
      );
      expect(mockUserPlugin.validatePassword).toHaveBeenCalledWith(
        mockUserWithPassword,
        "password123"
      );
      expect(mockAuthPlugin.generateTokens).toHaveBeenCalledWith(mockUser);
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
      expect(responseBody.error).toBe("Login failed");
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
      expect(responseBody.error).toBe("Invalid password");
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
      expect(responseBody.error).toBe("Invalid password");
    });

    it("should return 401 for non-existent user", async () => {
      mockUserPlugin.getByEmail.mockResolvedValue(null);

      const response = await fastify.inject({
        method: "POST",
        url: "/login",
        payload: validLoginData,
      });

      expect(response.statusCode).toBe(401);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.error).toBe("Invalid email or password");
    });

    it("should return 401 for invalid password", async () => {
      mockUserPlugin.getByEmail.mockResolvedValue(mockUserWithPassword);
      mockUserPlugin.validatePassword.mockResolvedValue(false);

      const response = await fastify.inject({
        method: "POST",
        url: "/login",
        payload: validLoginData,
      });

      expect(response.statusCode).toBe(401);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.error).toBe("Invalid email or password");
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
      mockUserPlugin.getByEmail.mockRejectedValue(new Error("Database error"));

      const response = await fastify.inject({
        method: "POST",
        url: "/login",
        payload: validLoginData,
      });

      expect(response.statusCode).toBe(500);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.error).toBe("Login failed");
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

      mockAuthPlugin.verifyRefreshToken.mockResolvedValue(mockTokenPayload);
      mockUserPlugin.getById.mockResolvedValue(mockUser);
      mockAuthPlugin.generateTokens.mockResolvedValue(mockNewTokens);

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

      expect(mockAuthPlugin.verifyRefreshToken).toHaveBeenCalledWith(
        "valid-refresh-token"
      );
      expect(mockUserPlugin.getById).toHaveBeenCalledWith("user-123");
      expect(mockAuthPlugin.generateTokens).toHaveBeenCalledWith(mockUser);
    });

    it("should return 401 for missing refresh token", async () => {
      const response = await fastify.inject({
        method: "POST",
        url: "/refresh",
        payload: {},
      });

      expect(response.statusCode).toBe(401);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.error).toBe("Refresh token required");
    });

    it("should return 401 for invalid refresh token", async () => {
      mockAuthPlugin.verifyRefreshToken.mockResolvedValue(null);

      const response = await fastify.inject({
        method: "POST",
        url: "/refresh",
        payload: validRefreshData,
      });

      expect(response.statusCode).toBe(401);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.error).toBe("Invalid or expired refresh token");
    });

    it("should return 401 for user not found", async () => {
      const mockTokenPayload = { userId: "user-123" };
      mockAuthPlugin.verifyRefreshToken.mockResolvedValue(mockTokenPayload);
      mockUserPlugin.getById.mockResolvedValue(null);

      const response = await fastify.inject({
        method: "POST",
        url: "/refresh",
        payload: validRefreshData,
      });

      expect(response.statusCode).toBe(401);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.error).toBe("User not found");
    });

    it("should return 500 for unexpected error", async () => {
      mockAuthPlugin.verifyRefreshToken.mockRejectedValue(
        new Error("Token verification error")
      );

      const response = await fastify.inject({
        method: "POST",
        url: "/refresh",
        payload: validRefreshData,
      });

      expect(response.statusCode).toBe(500);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.error).toBe("Token refresh failed");
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
      mockAuthPlugin.verifyAccessToken.mockResolvedValue(mockTokenPayload);
      mockAuthPlugin.validateSession.mockResolvedValue(mockUser);

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

      expect(mockAuthPlugin.verifyAccessToken).toHaveBeenCalledWith(
        "valid-access-token"
      );
      expect(mockAuthPlugin.validateSession).toHaveBeenCalledWith("user-123");
    });

    it("should return 401 for missing authorization header", async () => {
      const response = await fastify.inject({
        method: "GET",
        url: "/validate",
      });

      expect(response.statusCode).toBe(401);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.error).toBe("No token provided");
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
      expect(responseBody.error).toBe("No token provided");
    });

    it("should return 401 for invalid access token", async () => {
      mockAuthPlugin.verifyAccessToken.mockResolvedValue(null);

      const response = await fastify.inject({
        method: "GET",
        url: "/validate",
        headers: {
          authorization: "Bearer invalid-token",
        },
      });

      expect(response.statusCode).toBe(401);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.error).toBe("Invalid token");
    });

    it("should return 401 for invalid session", async () => {
      const mockTokenPayload = { userId: "user-123" };
      mockAuthPlugin.verifyAccessToken.mockResolvedValue(mockTokenPayload);
      mockAuthPlugin.validateSession.mockResolvedValue(null);

      const response = await fastify.inject({
        method: "GET",
        url: "/validate",
        headers: {
          authorization: "Bearer valid-token",
        },
      });

      expect(response.statusCode).toBe(401);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.error).toBe("Session invalid");
    });

    it("should return 500 for unexpected error", async () => {
      mockAuthPlugin.verifyAccessToken.mockRejectedValue(
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
      expect(responseBody.error).toBe("Session validation failed");
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

      mockUserPlugin.getByEmail.mockResolvedValue(mockUserWithPassword);
      mockUserPlugin.validatePassword.mockResolvedValue(true);
      mockAuthPlugin.generateTokens.mockResolvedValue({
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
      expect(mockUserPlugin.getByEmail).toHaveBeenCalledWith(
        "test@example.com"
      );
    });

    it("should not expose password hash in login response", async () => {
      mockUserPlugin.getByEmail.mockResolvedValue(mockUserWithPassword);
      mockUserPlugin.validatePassword.mockResolvedValue(true);
      mockAuthPlugin.generateTokens.mockResolvedValue({
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

import { FastifyInstance } from "fastify";
import * as jwt from "jsonwebtoken";
import authPlugin from "./auth.plugin";
import { UserPublic } from "../types/user.types";
import { TEST_UUIDS } from "../test-utils/test-data";

// Mock dependencies
jest.mock("jsonwebtoken");
jest.mock("fastify-plugin", () => (plugin: any) => plugin);

describe("Auth Plugin", () => {
  let mockFastify: jest.Mocked<FastifyInstance>;
  let mockUserPlugin: {
    getById: jest.MockedFunction<any>;
  };

  const mockUser: UserPublic = {
    id: TEST_UUIDS.USER_1,
    email: "test@example.com",
    first_name: "John",
    last_name: "Doe",
    families: [TEST_UUIDS.FAMILY_1],
    created_at: "2023-01-01T00:00:00Z",
    updated_at: "2023-01-01T00:00:00Z",
  };

  const mockJwtSign = jwt.sign as jest.MockedFunction<typeof jwt.sign>;
  const mockJwtVerify = jwt.verify as jest.MockedFunction<typeof jwt.verify>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup mock user plugin
    mockUserPlugin = {
      getById: jest.fn(),
    };

    // Create mock Fastify instance
    mockFastify = {
      decorate: jest.fn(),
      log: {
        debug: jest.fn(),
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
      },
      user: mockUserPlugin,
    } as any;

    // Set default environment variables
    process.env.JWT_SECRET = "test-jwt-secret";
    process.env.JWT_REFRESH_SECRET = "test-refresh-secret";
  });

  afterEach(() => {
    delete process.env.JWT_SECRET;
    delete process.env.JWT_REFRESH_SECRET;
  });

  describe("Plugin Registration", () => {
    it("should register the auth decorator with correct methods", async () => {
      await authPlugin(mockFastify, {});

      expect(mockFastify.decorate).toHaveBeenCalledWith("auth", {
        generateTokens: expect.any(Function),
        verifyAccessToken: expect.any(Function),
        verifyRefreshToken: expect.any(Function),
        revokeUserTokens: expect.any(Function),
        validateSession: expect.any(Function),
      });
    });
  });

  describe("generateTokens", () => {
    let authDecorator: any;

    beforeEach(async () => {
      await authPlugin(mockFastify, {});
      authDecorator = (mockFastify.decorate as jest.Mock).mock.calls[0][1];
    });

    it("should generate both access and refresh tokens", async () => {
      const mockAccessToken = "mock-access-token";
      const mockRefreshToken = "mock-refresh-token";

      mockJwtSign
        .mockReturnValueOnce(mockAccessToken as any)
        .mockReturnValueOnce(mockRefreshToken as any);

      const result = await authDecorator.generateTokens(mockUser);

      expect(result).toEqual({
        accessToken: mockAccessToken,
        refreshToken: mockRefreshToken,
      });
    });

    it("should sign access token with correct payload and options", async () => {
      mockJwtSign.mockReturnValue("token" as any);

      await authDecorator.generateTokens(mockUser);

      // The plugin uses the environment variables set at module load time,
      // not at runtime, so it will use the default values
      expect(mockJwtSign).toHaveBeenCalledWith(
        {
          userId: mockUser.id,
          email: mockUser.email,
        },
        "your-super-secret-jwt-key-change-this-in-production",
        { expiresIn: "15m" }
      );
    });

    it("should sign refresh token with correct payload and options", async () => {
      mockJwtSign.mockReturnValue("token" as any);

      await authDecorator.generateTokens(mockUser);

      expect(mockJwtSign).toHaveBeenCalledWith(
        {
          userId: mockUser.id,
          tokenVersion: 1,
        },
        "your-super-secret-refresh-key-change-this-in-production",
        { expiresIn: "7d" }
      );
    });

    it("should increment token version for subsequent token generation", async () => {
      mockJwtSign.mockReturnValue("token" as any);

      // First token generation
      await authDecorator.generateTokens(mockUser);
      expect(mockJwtSign).toHaveBeenCalledWith(
        expect.objectContaining({ tokenVersion: 1 }),
        "your-super-secret-refresh-key-change-this-in-production",
        { expiresIn: "7d" }
      );

      // Second token generation
      await authDecorator.generateTokens(mockUser);
      expect(mockJwtSign).toHaveBeenCalledWith(
        expect.objectContaining({ tokenVersion: 2 }),
        "your-super-secret-refresh-key-change-this-in-production",
        { expiresIn: "7d" }
      );
    });
  });

  describe("verifyAccessToken", () => {
    let authDecorator: any;

    beforeEach(async () => {
      await authPlugin(mockFastify, {});
      authDecorator = (mockFastify.decorate as jest.Mock).mock.calls[0][1];
    });

    it("should return token payload when token is valid and user exists", async () => {
      const mockPayload = {
        userId: TEST_UUIDS.USER_1,
        email: "test@example.com",
      };

      mockJwtVerify.mockReturnValue(mockPayload as any);
      mockUserPlugin.getById.mockResolvedValue(mockUser);

      const result = await authDecorator.verifyAccessToken("valid-token");

      expect(mockJwtVerify).toHaveBeenCalledWith(
        "valid-token",
        "your-super-secret-jwt-key-change-this-in-production"
      );
      expect(mockUserPlugin.getById).toHaveBeenCalledWith(TEST_UUIDS.USER_1);
      expect(result).toEqual(mockPayload);
    });

    it("should return null when user does not exist", async () => {
      const mockPayload = {
        userId: TEST_UUIDS.USER_1,
        email: "test@example.com",
      };

      mockJwtVerify.mockReturnValue(mockPayload as any);
      mockUserPlugin.getById.mockResolvedValue(null);

      const result = await authDecorator.verifyAccessToken("valid-token");

      expect(result).toBeNull();
    });

    it("should return null when JWT verification fails", async () => {
      mockJwtVerify.mockImplementation(() => {
        throw new Error("Invalid token");
      });

      const result = await authDecorator.verifyAccessToken("invalid-token");

      expect(result).toBeNull();
      expect(mockFastify.log.debug).toHaveBeenCalledWith(
        "Access token verification failed:",
        expect.any(Error)
      );
    });

    it("should return null when user service throws error", async () => {
      const mockPayload = {
        userId: TEST_UUIDS.USER_1,
        email: "test@example.com",
      };

      mockJwtVerify.mockReturnValue(mockPayload as any);
      mockUserPlugin.getById.mockRejectedValue(new Error("Database error"));

      const result = await authDecorator.verifyAccessToken("valid-token");

      expect(result).toBeNull();
    });
  });

  describe("verifyRefreshToken", () => {
    let authDecorator: any;

    beforeEach(async () => {
      await authPlugin(mockFastify, {});
      authDecorator = (mockFastify.decorate as jest.Mock).mock.calls[0][1];
    });

    it("should return token payload when token is valid and version matches", async () => {
      const mockPayload = {
        userId: TEST_UUIDS.USER_1,
        tokenVersion: 1,
      };

      // First generate tokens to set up token version
      mockJwtSign.mockReturnValue("token" as any);
      await authDecorator.generateTokens(mockUser);

      // Then verify refresh token
      mockJwtVerify.mockReturnValue(mockPayload as any);
      mockUserPlugin.getById.mockResolvedValue(mockUser);

      const result = await authDecorator.verifyRefreshToken(
        "valid-refresh-token"
      );

      expect(mockJwtVerify).toHaveBeenCalledWith(
        "valid-refresh-token",
        "your-super-secret-refresh-key-change-this-in-production"
      );
      expect(mockUserPlugin.getById).toHaveBeenCalledWith(TEST_UUIDS.USER_1);
      expect(result).toEqual(mockPayload);
    });

    it("should return null when token version does not match", async () => {
      const mockPayload = {
        userId: TEST_UUIDS.USER_1,
        tokenVersion: 5, // Higher version than stored
      };

      mockJwtVerify.mockReturnValue(mockPayload as any);

      const result = await authDecorator.verifyRefreshToken(
        "outdated-refresh-token"
      );

      expect(result).toBeNull();
      expect(mockFastify.log.debug).toHaveBeenCalledWith(
        "Refresh token version mismatch"
      );
    });

    it("should return null when user does not exist", async () => {
      const mockPayload = {
        userId: TEST_UUIDS.USER_1,
        tokenVersion: 1,
      };

      // Generate tokens first to set version
      mockJwtSign.mockReturnValue("token" as any);
      await authDecorator.generateTokens(mockUser);

      mockJwtVerify.mockReturnValue(mockPayload as any);
      mockUserPlugin.getById.mockResolvedValue(null);

      const result = await authDecorator.verifyRefreshToken(
        "valid-refresh-token"
      );

      expect(result).toBeNull();
    });

    it("should return null when JWT verification fails", async () => {
      mockJwtVerify.mockImplementation(() => {
        throw new Error("Invalid refresh token");
      });

      const result = await authDecorator.verifyRefreshToken(
        "invalid-refresh-token"
      );

      expect(result).toBeNull();
      expect(mockFastify.log.debug).toHaveBeenCalledWith(
        "Refresh token verification failed:",
        expect.any(Error)
      );
    });
  });

  describe("revokeUserTokens", () => {
    let authDecorator: any;

    beforeEach(async () => {
      await authPlugin(mockFastify, {});
      authDecorator = (mockFastify.decorate as jest.Mock).mock.calls[0][1];
    });

    it("should increment token version and log the action", async () => {
      const userId = TEST_UUIDS.USER_1;

      // Generate initial tokens
      mockJwtSign.mockReturnValue("token" as any);
      await authDecorator.generateTokens({ ...mockUser, id: userId });

      // Verify current version works
      mockJwtVerify.mockReturnValue({ userId, tokenVersion: 1 } as any);
      mockUserPlugin.getById.mockResolvedValue(mockUser);
      let result = await authDecorator.verifyRefreshToken("token");
      expect(result).not.toBeNull();

      // Revoke tokens
      await authDecorator.revokeUserTokens(userId);

      // Verify old version no longer works
      result = await authDecorator.verifyRefreshToken("token");
      expect(result).toBeNull();

      expect(mockFastify.log.info).toHaveBeenCalledWith(
        `Revoked all tokens for user: ${userId}`
      );
    });

    it("should handle revoking tokens for user with no previous tokens", async () => {
      const userId = "new-user-456";

      await authDecorator.revokeUserTokens(userId);

      expect(mockFastify.log.info).toHaveBeenCalledWith(
        `Revoked all tokens for user: ${userId}`
      );

      // Generate new tokens should start at version 2 (1 was set by revoke)
      mockJwtSign.mockReturnValue("token" as any);
      await authDecorator.generateTokens({ ...mockUser, id: userId });

      expect(mockJwtSign).toHaveBeenCalledWith(
        expect.objectContaining({ tokenVersion: 2 }),
        "your-super-secret-refresh-key-change-this-in-production",
        { expiresIn: "7d" }
      );
    });
  });

  describe("validateSession", () => {
    let authDecorator: any;

    beforeEach(async () => {
      await authPlugin(mockFastify, {});
      authDecorator = (mockFastify.decorate as jest.Mock).mock.calls[0][1];
    });

    it("should return user when user exists", async () => {
      const userId = TEST_UUIDS.USER_1;
      mockUserPlugin.getById.mockResolvedValue(mockUser);

      const result = await authDecorator.validateSession(userId);

      expect(mockUserPlugin.getById).toHaveBeenCalledWith(userId);
      expect(result).toEqual(mockUser);
    });

    it("should return null when user does not exist", async () => {
      const userId = "nonexistent-user";
      mockUserPlugin.getById.mockResolvedValue(null);

      const result = await authDecorator.validateSession(userId);

      expect(result).toBeNull();
    });

    it("should return null when user service throws error", async () => {
      const userId = TEST_UUIDS.USER_1;
      mockUserPlugin.getById.mockRejectedValue(new Error("Database error"));

      const result = await authDecorator.validateSession(userId);

      expect(result).toBeNull();
      expect(mockFastify.log.debug).toHaveBeenCalledWith(
        "Session validation failed:",
        expect.any(Error)
      );
    });
  });

  describe("Environment Variables", () => {
    it("should use default JWT secrets when environment variables are not set", async () => {
      delete process.env.JWT_SECRET;
      delete process.env.JWT_REFRESH_SECRET;

      await authPlugin(mockFastify, {});
      const authDecorator = (mockFastify.decorate as jest.Mock).mock
        .calls[0][1];

      mockJwtSign.mockReturnValue("token" as any);
      await authDecorator.generateTokens(mockUser);

      expect(mockJwtSign).toHaveBeenCalledWith(
        expect.any(Object),
        "your-super-secret-jwt-key-change-this-in-production",
        expect.any(Object)
      );

      expect(mockJwtSign).toHaveBeenCalledWith(
        expect.any(Object),
        "your-super-secret-refresh-key-change-this-in-production",
        expect.any(Object)
      );
    });
  });

  describe("Token Version Management", () => {
    let authDecorator: any;

    beforeEach(async () => {
      await authPlugin(mockFastify, {});
      authDecorator = (mockFastify.decorate as jest.Mock).mock.calls[0][1];
    });

    it("should maintain separate token versions for different users", async () => {
      const user1 = { ...mockUser, id: "user-1" };
      const user2 = { ...mockUser, id: "user-2" };

      mockJwtSign.mockReturnValue("token" as any);

      // Generate tokens for user1
      await authDecorator.generateTokens(user1);
      expect(mockJwtSign).toHaveBeenCalledWith(
        expect.objectContaining({ tokenVersion: 1 }),
        expect.any(String),
        expect.any(Object)
      );

      // Generate tokens for user2
      await authDecorator.generateTokens(user2);
      expect(mockJwtSign).toHaveBeenCalledWith(
        expect.objectContaining({ tokenVersion: 1 }),
        expect.any(String),
        expect.any(Object)
      );

      // Generate tokens for user1 again
      await authDecorator.generateTokens(user1);
      expect(mockJwtSign).toHaveBeenCalledWith(
        expect.objectContaining({ tokenVersion: 2 }),
        expect.any(String),
        expect.any(Object)
      );
    });

    it("should invalidate only revoked user tokens", async () => {
      const user1 = { ...mockUser, id: "user-1" };
      const user2 = { ...mockUser, id: "user-2" };

      mockJwtSign.mockReturnValue("token" as any);
      mockUserPlugin.getById.mockResolvedValue(mockUser);

      // Generate tokens for both users
      await authDecorator.generateTokens(user1);
      await authDecorator.generateTokens(user2);

      // Revoke user1 tokens
      await authDecorator.revokeUserTokens("user-1");

      // User1 token should be invalid
      mockJwtVerify.mockReturnValue({
        userId: "user-1",
        tokenVersion: 1,
      } as any);
      let result = await authDecorator.verifyRefreshToken("user1-token");
      expect(result).toBeNull();

      // User2 token should still be valid
      mockJwtVerify.mockReturnValue({
        userId: "user-2",
        tokenVersion: 1,
      } as any);
      result = await authDecorator.verifyRefreshToken("user2-token");
      expect(result).toEqual({ userId: "user-2", tokenVersion: 1 });
    });
  });
});

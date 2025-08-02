import { FastifyRequest, FastifyReply } from "fastify";
import { requireAuth } from "./auth.middleware";
import {
  createMockRequest,
  createMockReply,
  createMockUserPayload,
  expectErrorResponse,
} from "../../test-utils";
import { AUTH_ERRORS } from "../types/errors";

describe("requireAuth middleware", () => {
  let mockRequest: FastifyRequest;
  let mockReply: FastifyReply;

  beforeEach(() => {
    mockRequest = createMockRequest();
    mockReply = createMockReply();
    jest.clearAllMocks();
  });

  describe("when no authorization header is provided", () => {
    it("should return 401 with error message", async () => {
      mockRequest.headers = {};

      await requireAuth(mockRequest, mockReply);

      expectErrorResponse(
        mockReply,
        401,
        AUTH_ERRORS.MIDDLEWARE_TOKEN_REQUIRED
      );
    });
  });

  describe("when authorization header does not start with Bearer", () => {
    it("should return 401 with error message", async () => {
      mockRequest.headers = {
        authorization: "Basic abc123",
      };

      await requireAuth(mockRequest, mockReply);

      expectErrorResponse(
        mockReply,
        401,
        AUTH_ERRORS.MIDDLEWARE_TOKEN_REQUIRED
      );
    });
  });

  describe("when authorization header is properly formatted", () => {
    const validToken = "valid-jwt-token";
    const authHeader = `Bearer ${validToken}`;

    beforeEach(() => {
      mockRequest.headers = {
        authorization: authHeader,
      };
    });

    it("should extract token and call verifyAccessToken", async () => {
      const mockPayload = createMockUserPayload();
      mockRequest.server.auth.verifyAccessToken = jest
        .fn()
        .mockResolvedValue(mockPayload);

      await requireAuth(mockRequest, mockReply);

      expect(mockRequest.server.auth.verifyAccessToken).toHaveBeenCalledWith(
        validToken
      );
      expect(mockRequest.user).toEqual(mockPayload);
      expect(mockReply.status).not.toHaveBeenCalled();
      expect(mockReply.send).not.toHaveBeenCalled();
    });

    it("should return 401 when token verification returns null", async () => {
      mockRequest.server.auth.verifyAccessToken = jest
        .fn()
        .mockResolvedValue(null);

      await requireAuth(mockRequest, mockReply);

      expect(mockRequest.server.auth.verifyAccessToken).toHaveBeenCalledWith(
        validToken
      );
      expectErrorResponse(
        mockReply,
        401,
        AUTH_ERRORS.MIDDLEWARE_SESSION_EXPIRED
      );
    });

    it("should return 401 when token verification returns undefined", async () => {
      mockRequest.server.auth.verifyAccessToken = jest
        .fn()
        .mockResolvedValue(undefined);

      await requireAuth(mockRequest, mockReply);

      expect(mockRequest.server.auth.verifyAccessToken).toHaveBeenCalledWith(
        validToken
      );
      expectErrorResponse(
        mockReply,
        401,
        AUTH_ERRORS.MIDDLEWARE_SESSION_EXPIRED
      );
    });

    it("should handle token verification errors gracefully", async () => {
      const error = new Error("Token verification failed");
      mockRequest.server.auth.verifyAccessToken = jest
        .fn()
        .mockRejectedValue(error);

      await requireAuth(mockRequest, mockReply);

      expect(mockRequest.server.auth.verifyAccessToken).toHaveBeenCalledWith(
        validToken
      );
      expect(mockRequest.server.log.error).toHaveBeenCalledWith(
        "Auth middleware error:",
        error
      );
      expectErrorResponse(
        mockReply,
        500,
        AUTH_ERRORS.MIDDLEWARE_SERVICE_UNAVAILABLE
      );
    });

    it("should not modify request.user when token verification fails", async () => {
      mockRequest.server.auth.verifyAccessToken = jest
        .fn()
        .mockResolvedValue(null);

      await requireAuth(mockRequest, mockReply);

      expect(mockRequest.user).toBeUndefined();
    });
  });

  describe("edge cases", () => {
    it("should handle Bearer token with only spaces", async () => {
      mockRequest.headers = {
        authorization: "Bearer    ",
      };

      const mockPayload = createMockUserPayload();
      mockRequest.server.auth.verifyAccessToken = jest
        .fn()
        .mockResolvedValue(mockPayload);

      await requireAuth(mockRequest, mockReply);

      expect(mockRequest.server.auth.verifyAccessToken).toHaveBeenCalledWith(
        "   "
      );
    });

    it("should handle authorization header with different casing", async () => {
      mockRequest.headers = {
        authorization: "bearer valid-token",
      };

      await requireAuth(mockRequest, mockReply);

      expectErrorResponse(
        mockReply,
        401,
        AUTH_ERRORS.MIDDLEWARE_TOKEN_REQUIRED
      );
    });

    it("should handle empty Bearer token", async () => {
      mockRequest.headers = {
        authorization: "Bearer ",
      };

      const mockPayload = createMockUserPayload();
      mockRequest.server.auth.verifyAccessToken = jest
        .fn()
        .mockResolvedValue(mockPayload);

      await requireAuth(mockRequest, mockReply);

      expect(mockRequest.server.auth.verifyAccessToken).toHaveBeenCalledWith(
        ""
      );
    });
  });

  describe("TypeScript interface compliance", () => {
    it("should properly extend FastifyRequest with user property", async () => {
      const mockPayload = createMockUserPayload({
        userId: "user123",
        email: "test@example.com",
      });
      mockRequest.headers = {
        authorization: "Bearer valid-token",
      };
      mockRequest.server.auth.verifyAccessToken = jest
        .fn()
        .mockResolvedValue(mockPayload);

      await requireAuth(mockRequest, mockReply);

      // TypeScript should recognize these properties exist
      expect(mockRequest.user?.userId).toBe("user123");
      expect(mockRequest.user?.email).toBe("test@example.com");
    });
  });
});

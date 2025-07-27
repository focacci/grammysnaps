import { FastifyPluginAsync, FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import * as jwt from "jsonwebtoken";
import { User, UserPublic } from "../types/user.types";

const JWT_SECRET =
  process.env.JWT_SECRET ||
  "your-super-secret-jwt-key-change-this-in-production";
const JWT_REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET ||
  "your-super-secret-refresh-key-change-this-in-production";
const JWT_EXPIRES_IN = "15m"; // Access token expires in 15 minutes
const REFRESH_EXPIRES_IN = "7d"; // Refresh token expires in 7 days

interface TokenPayload {
  userId: string;
  email: string;
}

interface RefreshTokenPayload {
  userId: string;
  tokenVersion: number;
}

declare module "fastify" {
  interface FastifyInstance {
    auth: {
      generateTokens: (
        user: UserPublic
      ) => Promise<{ accessToken: string; refreshToken: string }>;
      verifyAccessToken: (token: string) => Promise<TokenPayload | null>;
      verifyRefreshToken: (
        token: string
      ) => Promise<RefreshTokenPayload | null>;
      revokeUserTokens: (userId: string) => Promise<void>;
      validateSession: (userId: string) => Promise<UserPublic | null>;
    };
  }
}

const authPlugin: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // Store token versions in memory (in production, use Redis or database)
  const tokenVersions = new Map<string, number>();

  const incrementTokenVersion = (userId: string): number => {
    const currentVersion = tokenVersions.get(userId) || 0;
    const newVersion = currentVersion + 1;
    tokenVersions.set(userId, newVersion);
    return newVersion;
  };

  const getTokenVersion = (userId: string): number => {
    return tokenVersions.get(userId) || 0;
  };

  fastify.decorate("auth", {
    async generateTokens(
      user: UserPublic
    ): Promise<{ accessToken: string; refreshToken: string }> {
      const tokenVersion = incrementTokenVersion(user.id);

      const accessToken = jwt.sign(
        {
          userId: user.id,
          email: user.email,
        } as TokenPayload,
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
      );

      const refreshToken = jwt.sign(
        {
          userId: user.id,
          tokenVersion,
        } as RefreshTokenPayload,
        JWT_REFRESH_SECRET,
        { expiresIn: REFRESH_EXPIRES_IN }
      );

      return { accessToken, refreshToken };
    },

    async verifyAccessToken(token: string): Promise<TokenPayload | null> {
      try {
        const payload = jwt.verify(token, JWT_SECRET) as TokenPayload;

        // Validate that user still exists
        const user = await fastify.user.getById(payload.userId);
        if (!user) {
          return null;
        }

        return payload;
      } catch (error) {
        fastify.log.debug("Access token verification failed:", error);
        return null;
      }
    },

    async verifyRefreshToken(
      token: string
    ): Promise<RefreshTokenPayload | null> {
      try {
        const payload = jwt.verify(
          token,
          JWT_REFRESH_SECRET
        ) as RefreshTokenPayload;

        // Check if token version is valid
        const currentVersion = getTokenVersion(payload.userId);
        if (payload.tokenVersion !== currentVersion) {
          fastify.log.debug("Refresh token version mismatch");
          return null;
        }

        // Validate that user still exists
        const user = await fastify.user.getById(payload.userId);
        if (!user) {
          return null;
        }

        return payload;
      } catch (error) {
        fastify.log.debug("Refresh token verification failed:", error);
        return null;
      }
    },

    async revokeUserTokens(userId: string): Promise<void> {
      incrementTokenVersion(userId);
      fastify.log.info(`Revoked all tokens for user: ${userId}`);
    },

    async validateSession(userId: string): Promise<UserPublic | null> {
      try {
        const user = await fastify.user.getById(userId);
        return user;
      } catch (error) {
        fastify.log.debug("Session validation failed:", error);
        return null;
      }
    },
  });
};

export default fp(authPlugin, {
  name: "auth",
  dependencies: ["user"],
});

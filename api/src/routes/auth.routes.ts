import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { LoginInput } from "../types/user.types";

interface RefreshTokenBody {
  refreshToken: string;
}

interface LogoutBody {
  userId: string;
}

export default async function authRoutes(fastify: FastifyInstance) {
  // Login endpoint
  fastify.post<{ Body: LoginInput }>(
    "/login",
    async (
      request: FastifyRequest<{ Body: LoginInput }>,
      reply: FastifyReply
    ) => {
      try {
        const { email, password } = request.body;

        // Get user with password hash for validation
        const user = await fastify.user.getByEmail(email);
        if (!user) {
          return reply.status(401).send({ error: "Invalid email or password" });
        }

        // Validate password
        const isValid = await fastify.user.validatePassword(user, password);
        if (!isValid) {
          return reply.status(401).send({ error: "Invalid email or password" });
        }

        // Convert to public user (remove password hash)
        const { password_hash: _, ...userPublic } = user;

        // Generate tokens
        const { accessToken, refreshToken } = await fastify.auth.generateTokens(
          userPublic
        );

        fastify.log.info(`User logged in: ${user.email}`);

        return reply.send({
          user: userPublic,
          accessToken,
          refreshToken,
        });
      } catch (error) {
        fastify.log.error(error);
        return reply.status(500).send({ error: "Login failed" });
      }
    }
  );

  // Refresh token endpoint
  fastify.post<{ Body: RefreshTokenBody }>(
    "/refresh",
    async (
      request: FastifyRequest<{ Body: RefreshTokenBody }>,
      reply: FastifyReply
    ) => {
      try {
        const { refreshToken } = request.body;

        if (!refreshToken) {
          return reply.status(401).send({ error: "Refresh token required" });
        }

        // Verify refresh token
        const payload = await fastify.auth.verifyRefreshToken(refreshToken);
        if (!payload) {
          return reply
            .status(401)
            .send({ error: "Invalid or expired refresh token" });
        }

        // Get current user data
        const user = await fastify.user.getById(payload.userId);
        if (!user) {
          return reply.status(401).send({ error: "User not found" });
        }

        // Generate new tokens
        const { accessToken, refreshToken: newRefreshToken } =
          await fastify.auth.generateTokens(user);

        return reply.send({
          user,
          accessToken,
          refreshToken: newRefreshToken,
        });
      } catch (error) {
        fastify.log.error(error);
        return reply.status(500).send({ error: "Token refresh failed" });
      }
    }
  );

  // Logout endpoint
  fastify.post<{ Body: LogoutBody }>(
    "/logout",
    async (
      request: FastifyRequest<{ Body: LogoutBody }>,
      reply: FastifyReply
    ) => {
      try {
        const { userId } = request.body;

        if (!userId) {
          return reply.status(400).send({ error: "User ID required" });
        }

        // Revoke all tokens for this user
        await fastify.auth.revokeUserTokens(userId);

        fastify.log.info(`User logged out: ${userId}`);

        return reply.status(200).send({ message: "Logged out successfully" });
      } catch (error) {
        fastify.log.error(error);
        return reply.status(500).send({ error: "Logout failed" });
      }
    }
  );

  // Validate session endpoint
  fastify.get(
    "/validate",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const authHeader = request.headers.authorization;
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
          return reply.status(401).send({ error: "Access token required" });
        }

        const token = authHeader.substring(7);
        const payload = await fastify.auth.verifyAccessToken(token);

        if (!payload) {
          return reply.status(401).send({ error: "Invalid or expired token" });
        }

        // Get current user data to ensure they still exist
        const user = await fastify.auth.validateSession(payload.userId);
        if (!user) {
          return reply.status(401).send({ error: "User not found" });
        }

        return reply.send({ user, valid: true });
      } catch (error) {
        fastify.log.error(error);
        return reply.status(500).send({ error: "Session validation failed" });
      }
    }
  );
}

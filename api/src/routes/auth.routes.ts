import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import fastifyRateLimit from "@fastify/rate-limit";
import { LoginInput } from "../types/user.types";
import { ValidationUtils } from "../utils/validation";

interface RefreshTokenBody {
  refreshToken: string;
}

interface LogoutBody {
  userId: string;
}

export default async function authRoutes(fastify: FastifyInstance) {
  // Add stricter rate limiting for auth endpoints
  await fastify.register(fastifyRateLimit, {
    max: 5, // Maximum 5 login attempts per timeWindow
    timeWindow: "15 minutes", // per 15 minutes
    keyGenerator: (req: any) => req.ip, // Rate limit per IP
    errorResponseBuilder: (req: any, context: any) => {
      return {
        error: "Too many authentication attempts, please try again later.",
        expiresIn: Math.round(context.ttl / 1000),
      };
    },
  });

  // Login endpoint
  fastify.post<{ Body: LoginInput }>(
    "/login",
    async (
      request: FastifyRequest<{ Body: LoginInput }>,
      reply: FastifyReply
    ) => {
      try {
        const { email, password } = request.body;

        // Sanitize and validate inputs
        const sanitizedEmail = ValidationUtils.sanitizeEmail(email);
        // Note: Don't validate password length here as it might be an existing user with shorter password
        if (!password || typeof password !== "string") {
          return reply.status(400).send({ error: "Invalid password" });
        }

        // Get user with password hash for validation
        const user = await fastify.user.getByEmail(sanitizedEmail);
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
        if (error instanceof Error && error.message.includes("Invalid")) {
          return reply.status(400).send({ error: error.message });
        }
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

        // Here you could invalidate the refresh token in a database
        // For now, we'll just return success
        fastify.log.info(`User logged out: ${userId}`);

        return reply.send({ message: "Logged out successfully" });
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
          return reply.status(401).send({ error: "No token provided" });
        }

        const token = authHeader.substring(7);
        const payload = await fastify.auth.verifyAccessToken(token);

        if (!payload) {
          return reply.status(401).send({ error: "Invalid token" });
        }

        const user = await fastify.auth.validateSession(payload.userId);
        if (!user) {
          return reply.status(401).send({ error: "Session invalid" });
        }

        return reply.send({ user });
      } catch (error) {
        fastify.log.error(error);
        return reply.status(500).send({ error: "Session validation failed" });
      }
    }
  );
}

import { FastifyRequest, FastifyReply } from "fastify";
import { AUTH_ERRORS } from "../types/errors";
import { UUID } from "crypto";

declare module "fastify" {
  interface FastifyRequest {
    user?: {
      userId: UUID;
      email: string;
    };
  }
}

export const requireAuth = async (
  request: FastifyRequest,
  reply: FastifyReply
) => {
  try {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return reply.status(401).send({
        error: AUTH_ERRORS.MIDDLEWARE_TOKEN_REQUIRED,
      });
    }

    const token = authHeader.substring(7); // Remove "Bearer " prefix
    const payload = await request.server.auth.verifyAccessToken(token);

    if (!payload) {
      return reply.status(401).send({
        error: AUTH_ERRORS.MIDDLEWARE_SESSION_EXPIRED,
      });
    }

    request.user = payload;
  } catch (error) {
    request.server.log.error("Auth middleware error:", error);
    return reply.status(500).send({
      error: AUTH_ERRORS.MIDDLEWARE_SERVICE_UNAVAILABLE,
    });
  }
};

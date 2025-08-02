import { FastifyRequest, FastifyReply } from "fastify";

declare module "fastify" {
  interface FastifyRequest {
    user?: {
      userId: string;
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
      return reply
        .status(401)
        .send({
          error:
            "Authentication token is required. Please log in to access this resource.",
        });
    }

    const token = authHeader.substring(7); // Remove "Bearer " prefix
    const payload = await request.server.auth.verifyAccessToken(token);

    if (!payload) {
      return reply
        .status(401)
        .send({
          error: "Your session has expired or is invalid. Please log in again.",
        });
    }

    request.user = payload;
  } catch (error) {
    request.server.log.error("Auth middleware error:", error);
    return reply
      .status(500)
      .send({
        error:
          "Authentication service is temporarily unavailable. Please try again.",
      });
  }
};

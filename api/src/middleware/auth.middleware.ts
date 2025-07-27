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
      return reply.status(401).send({ error: "Access token required" });
    }

    const token = authHeader.substring(7); // Remove "Bearer " prefix
    const payload = await request.server.auth.verifyAccessToken(token);

    if (!payload) {
      return reply.status(401).send({ error: "Invalid or expired token" });
    }

    request.user = payload;
  } catch (error) {
    request.server.log.error("Auth middleware error:", error);
    return reply.status(500).send({ error: "Authentication error" });
  }
};

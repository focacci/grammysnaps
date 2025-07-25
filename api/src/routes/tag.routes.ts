import { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import { TagInput } from "../plugins/tag.plugin";

const createTagRequestBodySchema = {
  type: "object",
  required: ["type", "name"],
  properties: {
    type: { type: "string", minLength: 1 },
    name: { type: "string", minLength: 1 },
  },
  additionalProperties: false, // Prevents extra fields in the body
};

const tagRoutes: FastifyPluginAsync = async (fastify, opts) => {
  fastify.get("/", async (request: FastifyRequest, reply: FastifyReply) => {
    const tags = await fastify.tag.get();
    return reply.status(200).send({ tags });
  });

  fastify.post(
    "/",
    { schema: { body: createTagRequestBodySchema } },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { type, name } = request.body as TagInput;
      const tag = await fastify.tag.create({ type, name });
      return reply.status(200).send({ tag });
    }
  );
};

export default tagRoutes;

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

interface GetTagParams {
  tagId: string;
}
const getTagParamsSchema = {
  params: {
    type: "object",
    required: ["tagId"],
    properties: {
      tagId: { type: "string", format: "uuid" },
    },
  },
};

const tagRoutes: FastifyPluginAsync = async (fastify, opts) => {
  fastify.get("/", async (request: FastifyRequest, reply: FastifyReply) => {
    const tags = await fastify.tag.get();
    return reply.status(200).send({ tags });
  });

  fastify.get(
    "/:tagId",
    {
      schema: getTagParamsSchema,
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { tagId } = request.params as GetTagParams;
      const tag = await fastify.tag.getById(tagId);
      if (!tag) {
        return reply.status(404).send({ message: "Tag not found" });
      }
      return reply.status(200).send({ tag });
    }
  );

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

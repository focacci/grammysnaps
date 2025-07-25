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

interface UpdateTagParams {
  tagId: string;
}
const updateTagParamsSchema = {
  type: "object",
  required: ["tagId"],
  properties: {
    tagId: { type: "string", format: "uuid" },
  },
};

const updateTagBodySchema = {
  type: "object",
  required: [],
  properties: {
    type: {
      type: "string",
      enum: ["Person", "Location", "Event", "Time"],
      minLength: 1,
    },
    name: { type: "string", minLength: 1 },
  },
  additionalProperties: false, // Prevents extra fields in the body
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

  fastify.put(
    "/:tagId",
    {
      schema: {
        params: updateTagParamsSchema,
        body: createTagRequestBodySchema,
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { tagId } = request.params as UpdateTagParams;
      const { type, name } = request.body as TagInput;
      const updatedTag = await fastify.tag.update(tagId, { type, name });
      if (!updatedTag) {
        return reply.status(404).send({ message: "Tag not found" });
      }
      return reply.status(200).send({ tag: updatedTag });
    }
  );

  fastify.delete(
    "/:tagId",
    {
      schema: getTagParamsSchema,
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { tagId } = request.params as GetTagParams;
      try {
        await fastify.tag.delete(tagId);
        return reply.status(204).send();
      } catch (err) {
        fastify.log.error(err);
        return reply
          .status(500)
          .send({ message: "Failed to delete tag", error: err });
      }
    }
  );
};

export default tagRoutes;

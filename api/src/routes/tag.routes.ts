import { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import { TagInput, TagUpdateInput } from "../types/tag.types";
import { TAG_ERRORS } from "../types/errors";
import { requireAuth } from "../middleware/auth.middleware";
import { UUID } from "crypto";

const createTagRequestBodySchema = {
  type: "object",
  required: ["type", "name", "collection_id", "created_by"],
  properties: {
    type: { type: "string", minLength: 1 },
    name: { type: "string", minLength: 1 },
    collection_id: { type: "string", format: "uuid" },
    created_by: { type: "string", format: "uuid" },
  },
  additionalProperties: false, // Prevents extra fields in the body
};

const updateTagRequestBodySchema = {
  type: "object",
  required: ["type", "name", "collection_id"],
  properties: {
    type: { type: "string", minLength: 1 },
    name: { type: "string", minLength: 1 },
    collection_id: { type: "string", format: "uuid" },
  },
  additionalProperties: false, // Prevents extra fields in the body
};

interface GetTagParams {
  tagId: UUID;
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
  tagId: UUID;
}
const updateTagParamsSchema = {
  type: "object",
  required: ["tagId"],
  properties: {
    tagId: { type: "string", format: "uuid" },
  },
};

const tagRoutes: FastifyPluginAsync = async (fastify) => {
  // Add auth middleware to all tag routes
  fastify.addHook("preHandler", requireAuth);

  fastify.get("/", async (request: FastifyRequest, reply: FastifyReply) => {
    const tags = await fastify.tag.get();
    return reply.status(200).send({ tags });
  });

  // New route for getting tags by collection
  fastify.get(
    "/collection/:collectionId",
    {
      schema: {
        params: {
          type: "object",
          required: ["collectionId"],
          properties: {
            collectionId: { type: "string", format: "uuid" },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { collectionId } = request.params as { collectionId: UUID };
      const tags = await fastify.tag.getByCollection(collectionId);
      return reply.status(200).send({ tags });
    }
  );

  fastify.get(
    "/:tagId",
    {
      schema: getTagParamsSchema,
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { tagId } = request.params as GetTagParams;
      const tag = await fastify.tag.getById(tagId);
      if (!tag) {
        return reply.status(404).send({ message: TAG_ERRORS.NOT_FOUND });
      }
      return reply.status(200).send({ tag });
    }
  );

  fastify.post(
    "/",
    { schema: { body: createTagRequestBodySchema } },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { type, name, collection_id, created_by } = request.body as TagInput;
      request.log.info("Creating tag:", { type, name, collection_id, created_by });
      const tag = await fastify.tag.create({
        type,
        name,
        collection_id,
        created_by,
      });
      return reply.status(200).send({ tag });
    }
  );

  fastify.put(
    "/:tagId",
    {
      schema: {
        params: updateTagParamsSchema,
        body: updateTagRequestBodySchema,
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { tagId } = request.params as UpdateTagParams;
      const { type, name, collection_id } = request.body as TagUpdateInput;
      const updatedTag = await fastify.tag.update(tagId, {
        type,
        name,
        collection_id,
      });
      if (!updatedTag) {
        return reply.status(404).send({ message: TAG_ERRORS.NOT_FOUND });
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
        return reply.status(500).send({
          message: TAG_ERRORS.DELETE_FAILED,
          error: err,
        });
      }
    }
  );
};

export default tagRoutes;

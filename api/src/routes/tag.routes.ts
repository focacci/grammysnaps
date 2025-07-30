import { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import { TagInput, TagUpdateInput } from "../plugins/tag.plugin";

const createTagRequestBodySchema = {
  type: "object",
  required: ["type", "name", "family_id", "created_by"],
  properties: {
    type: { type: "string", minLength: 1 },
    name: { type: "string", minLength: 1 },
    family_id: { type: "string", format: "uuid" },
    created_by: { type: "string", format: "uuid" },
  },
  additionalProperties: false, // Prevents extra fields in the body
};

const updateTagRequestBodySchema = {
  type: "object",
  required: ["type", "name", "family_id"],
  properties: {
    type: { type: "string", minLength: 1 },
    name: { type: "string", minLength: 1 },
    family_id: { type: "string", format: "uuid" },
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

const tagRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/", async (request: FastifyRequest, reply: FastifyReply) => {
    const tags = await fastify.tag.get();
    return reply.status(200).send({ tags });
  });

  // New route for getting tags by family
  fastify.get(
    "/family/:familyId",
    {
      schema: {
        params: {
          type: "object",
          required: ["familyId"],
          properties: {
            familyId: { type: "string", format: "uuid" },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { familyId } = request.params as { familyId: string };
      const tags = await fastify.tag.getByFamily(familyId);
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
        return reply.status(404).send({ message: "Tag not found" });
      }
      return reply.status(200).send({ tag });
    }
  );

  fastify.post(
    "/",
    { schema: { body: createTagRequestBodySchema } },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { type, name, family_id, created_by } = request.body as TagInput;
      request.log.info("Creating tag:", { type, name, family_id, created_by });
      const tag = await fastify.tag.create({
        type,
        name,
        family_id,
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
      const { type, name, family_id } = request.body as TagUpdateInput;
      const updatedTag = await fastify.tag.update(tagId, {
        type,
        name,
        family_id,
      });
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

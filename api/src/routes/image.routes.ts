import { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import { Image, ImageInput } from "../types/image.types";

const createImageRequestBodySchema = {
  type: "object",
  required: ["filename"],
  properties: {
    filename: { type: "string", minLength: 1 },
    tags: {
      type: "array",
      items: { type: "string", format: "uuid" },
    },
  },
  additionalProperties: false, // Prevents extra fields in the body
};

interface GetImageParams {
  imageId: string;
}
const getImageParamsSchema = {
  type: "object",
  required: ["imageId"],
  properties: {
    imageId: { type: "string", format: "uuid" },
  },
};

interface UpdateImageParams {
  imageId: string;
}
const updateImageParamsSchema = {
  type: "object",
  required: ["imageId"],
  properties: {
    imageId: { type: "string", format: "uuid" },
  },
};

const updateImageBodySchema = {
  type: "object",
  required: [],
  properties: {
    imageId: { type: "string", format: "uuid" },
    tags: {
      type: "array",
      items: { type: "string", format: "uuid" },
    },
  },
};

const imageRoutes: FastifyPluginAsync = async (fastify, opts) => {
  fastify.get("/", async (request: FastifyRequest, reply: FastifyReply) => {
    const images = await fastify.image.get();
    return reply.status(200).send({ images });
  });

  fastify.get(
    "/:imageId",
    {
      schema: {
        params: getImageParamsSchema,
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { imageId } = request.params as GetImageParams;
      const image = await fastify.image.getById(imageId);
      if (!image) {
        return reply.status(404).send({ message: "Image not found" });
      }
      return reply.status(200).send({ image });
    }
  );

  fastify.post(
    "/",
    { schema: { body: createImageRequestBodySchema } },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { filename, tags } = request.body as ImageInput;
      const image = await fastify.image.create({ filename, tags });
      if (tags) await fastify.image.applyTags(image.id, tags);
      return reply.status(200).send({ image });
    }
  );

  fastify.put(
    "/:imageId",
    {
      schema: {
        body: updateImageBodySchema,
        params: updateImageParamsSchema,
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { imageId } = request.params as UpdateImageParams;
      const { filename, tags } = request.body as ImageInput;
      const image = await fastify.image.update(imageId, {
        filename,
        tags,
      });
      return reply.status(200).send({ image });
    }
  );
};

export default imageRoutes;

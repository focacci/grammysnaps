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
  required: ["imageId"],
  properties: {
    imageId: { type: "string", format: "uuid" },
  },
};

const imageRoutes: FastifyPluginAsync = async (fastify, opts) => {
  fastify.get("/", async (request: FastifyRequest, reply: FastifyReply) => {
    const images = await fastify.image.get();
    return reply.status(200).send({ images });
  });

  fastify.post(
    "/",
    { schema: { body: createImageRequestBodySchema } },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { filename, tags } = request.body as ImageInput;
      const image = await fastify.image.create({ filename });
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
      if (tags) await fastify.image.applyTags(imageId, tags);
      return reply.status(204).send();
    }
  );
};

export default imageRoutes;

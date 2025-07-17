import { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";

const createImageRequestBodySchema = {
  type: "object",
  required: ["filename"],
  properties: {
    filename: { type: "string", minLength: 1 },
  },
  additionalProperties: false, // Prevents extra fields in the body
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
      const { filename } = request.body as { filename: string };
      const file = await fastify.image.create({ filename });
      return reply.status(200).send({ file });
    }
  );
};

export default imageRoutes;

import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';

const imageRoutes: FastifyPluginAsync = async (fastify, opts) => {
  fastify.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    return reply.status(200).send({ message: 'TODO: build api' });
  });
};

export default imageRoutes;
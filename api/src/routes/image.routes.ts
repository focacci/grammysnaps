import { FastifyPluginAsync } from 'fastify';

const imageRoutes: FastifyPluginAsync = async (fastify, opts) => {
  fastify.get('/', async (request, reply) => {
    return { message: 'TODO: build api' };
  });
};

export default imageRoutes;
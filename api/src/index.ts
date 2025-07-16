import Fastify, { FastifyInstance } from 'fastify';
import imageRoutes from './routes/image.routes';

const server: FastifyInstance = Fastify({ logger: true });

server.register(imageRoutes, { prefix: '/image' });

const start = async () => {
  try {
    await server.listen({ port: 3000 });
    console.log('Server running at http://localhost:3000');
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
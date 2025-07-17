import Fastify, { FastifyInstance } from 'fastify';
import fastifyPostgres from '@fastify/postgres';
import imageRoutes from './routes/image.routes';

const server: FastifyInstance = Fastify({ logger: true });

// Connect database
server.register(fastifyPostgres, {
  connectionString: process.env.DATABASE_URL || 'postgres://grammysnaps:password@localhost:5432/grammysnaps',
});

// Routes and plugins
server.register(imageRoutes, { prefix: '/image' });

// Health check
server.get('/health', async (request, reply) => {
  try {
    const client = await server.pg.connect();
    await client.query('SELECT NOW()');
    client.release();
    return { status: 'ok', database: 'connected' };
  } catch (err) {
    console.log(err);
    reply.status(500).send({ status: 'error', message: 'Database connection failed' });
  }
});

const start = async () => {
  try {
    await server.listen({ port: 3000, host: '0.0.0.0' });
    console.log('Server running at http://0.0.0.0:3000');
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
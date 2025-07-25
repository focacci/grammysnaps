import Fastify, { fastify, FastifyInstance } from "fastify";
import fastifyPostgres from "@fastify/postgres";

import imagePlugin from "./plugins/image.plugin";
import imageRoutes from "./routes/image.routes";
import tagPlugin from "./plugins/tag.plugin";
import tagRoutes from "./routes/tag.routes";

const server: FastifyInstance = Fastify({ logger: true });

const main = async () => {
  // Connect database
  server.register(fastifyPostgres, {
    connectionString:
      process.env.DATABASE_URL ||
      "postgres://grammysnaps:password@localhost:5432/grammysnaps",
  });

  // Utility plugins
  server.register(imagePlugin);
  server.register(tagPlugin);

  // Routes
  server.register(imageRoutes, { prefix: "/image" });
  server.register(tagRoutes, { prefix: "/tag" });

  // Health check
  server.get("/health", async (request, reply) => {
    try {
      const client = await server.pg.connect();
      await client.query("SELECT NOW()");
      client.release();
      return reply.status(200).send({ status: "ok", database: "connected" });
    } catch (err) {
      return reply.status(500).send({
        status: "error",
        message: "Database connection failed",
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });

  const start = async () => {
    try {
      await server.listen({ port: 3000, host: "0.0.0.0" });
      console.log("Server running at http://0.0.0.0:3000");
    } catch (err) {
      server.log.error(err);
      process.exit(1);
    }
  };

  await start();
};

main();

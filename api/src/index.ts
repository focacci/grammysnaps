import Fastify, { fastify, FastifyInstance } from "fastify";
import fastifyPostgres from "@fastify/postgres";
import fastifyMultipart from "@fastify/multipart";

import imagePlugin from "./plugins/image.plugin";
import imageRoutes from "./routes/image.routes";
import tagPlugin from "./plugins/tag.plugin";
import tagRoutes from "./routes/tag.routes";
import s3Plugin from "./plugins/s3.plugin";

const server: FastifyInstance = Fastify({ logger: true });

const main = async () => {
  // Register multipart for file uploads
  server.register(fastifyMultipart, {
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB limit
      files: 1, // Only allow 1 file
      fields: 10, // Allow up to 10 form fields
    },
    attachFieldsToBody: true, // Attach form fields to request.body
  });

  // Connect data stores
  server.register(fastifyPostgres, {
    connectionString:
      process.env.DATABASE_URL ||
      "postgres://grammysnaps:password@localhost:5432/grammysnaps",
  });
  server.register(s3Plugin, {
    region: "us-east-2",
    bucket: "grammysnaps",
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
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

      // Test S3 connection
      let s3Status = "unknown";
      try {
        await server.s3.listImages("");
        s3Status = "connected";
      } catch (s3Error) {
        server.log.error("S3 connection failed:", s3Error);
        s3Status = "failed";
      }

      return reply.status(200).send({
        status: "ok",
        database: "connected",
        s3: s3Status,
      });
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

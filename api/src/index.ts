import Fastify, { FastifyInstance } from "fastify";
import fastifyPostgres from "@fastify/postgres";
import fastifyMultipart from "@fastify/multipart";
import fastifyRateLimit from "@fastify/rate-limit";

import imagePlugin from "./plugins/image.plugin";
import imageRoutes from "./routes/image.routes";
import tagPlugin from "./plugins/tag.plugin";
import tagRoutes from "./routes/tag.routes";
import s3Plugin from "./plugins/s3.plugin";
import userPlugin from "./plugins/user.plugin";
import userRoutes from "./routes/user.routes";
import familyPlugin from "./plugins/family.plugin";
import familyRoutes from "./routes/family.routes";
import authPlugin from "./plugins/auth.plugin";
import authRoutes from "./routes/auth.routes";
import { SERVER_ERRORS, RATE_LIMIT_ERRORS } from "./types/errors";

const server: FastifyInstance = Fastify({ logger: true });

const main = async () => {
  // Load environment variables from .env file in development only
  if (process.env.NODE_ENV && process.env.NODE_ENV !== "production") {
    const { config } = await import("dotenv");
    config({
      path: process.env.NODE_ENV === "testing" ? "./.testing.env" : "./.env",
    });
  }

  // Add CORS headers manually
  server.addHook("preHandler", async (request, reply) => {
    const allowedOrigins = [
      "http://localhost:5173",
      "http://localhost:8080",
      "http://localhost:3000",
      "http://localhost:4173",
      "http://192.168.1.156:8080",
      "http://192.168.1.156:5173",
      "http://192.168.1.156:3000",
    ];

    const origin = request.headers.origin;

    // Allow origins from localhost or the 192.168.1.x network
    const isLocalhost = origin && origin.includes("localhost");
    const isLocalNetwork = origin && origin.includes("192.168.1.");

    if (
      origin &&
      (allowedOrigins.includes(origin) || isLocalhost || isLocalNetwork)
    ) {
      reply.header("Access-Control-Allow-Origin", origin);
    }

    reply.header(
      "Access-Control-Allow-Methods",
      "GET, POST, PUT, DELETE, OPTIONS"
    );
    reply.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
    reply.header("Access-Control-Allow-Credentials", "true");

    if (request.method === "OPTIONS") {
      reply.code(200).send();
    }
  });

  // Register rate limiting for security
  if (
    process.env.NODE_ENV &&
    (process.env.NODE_ENV === "dev" || process.env.NODE_ENV === "production")
  ) {
    server.register(fastifyRateLimit, {
      max: 300, // Maximum 300 requests per timeWindow
      timeWindow: "1 minute", // per 1 minute
      errorResponseBuilder: (context: any) => {
        return {
          error: RATE_LIMIT_ERRORS.TOO_MANY_REQUESTS,
          expiresIn: Math.round(context.ttl / 1000), // seconds
        };
      },
    });
  }

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
    bucket: process.env.S3_BUCKET_NAME!,
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  });

  // Utility plugins
  server.register(imagePlugin);
  server.register(tagPlugin);
  server.register(userPlugin);
  server.register(familyPlugin);
  server.register(authPlugin);

  // Routes
  await server.register(imageRoutes, { prefix: "/image" });
  await server.register(tagRoutes, { prefix: "/tag" });
  await server.register(userRoutes, { prefix: "/user" });
  await server.register(familyRoutes, { prefix: "/family" });
  await server.register(authRoutes, { prefix: "/auth" });

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
        message: SERVER_ERRORS.HEALTH_CHECK_FAILED,
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

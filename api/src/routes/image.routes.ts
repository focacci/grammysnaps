import { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import { Image, ImageInput } from "../types/image.types";
import { MultipartFile } from "@fastify/multipart";
import path from "path";
import { v4 as uuidv4 } from "uuid";

const createImageRequestBodySchema = {
  type: "object",
  required: ["filename", "family_ids"],
  properties: {
    filename: { type: "string", minLength: 1 },
    tags: {
      type: "array",
      items: { type: "string", format: "uuid" },
    },
    family_ids: {
      type: "array",
      items: { type: "string", format: "uuid" },
      minItems: 1,
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
    title: { type: "string" },
    tags: {
      type: "array",
      items: { type: "string", format: "uuid" },
    },
    family_ids: {
      type: "array",
      items: { type: "string", format: "uuid" },
      minItems: 1,
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

  // Download image endpoint
  fastify.get(
    "/:imageId/download",
    {
      schema: {
        params: getImageParamsSchema,
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { imageId } = request.params as GetImageParams;
      try {
        // Get the image to extract S3 key
        const image = await fastify.image.getById(imageId);
        if (!image) {
          return reply.status(404).send({ message: "Image not found" });
        }

        if (!image.s3_url) {
          return reply
            .status(404)
            .send({ message: "Image file not found in storage" });
        }

        // Extract S3 key from the public URL
        const url = new URL(image.s3_url);
        const s3Key = url.pathname.substring(1); // Remove leading slash

        // Download the file from S3
        const buffer = await fastify.s3.download(s3Key);

        // Set appropriate headers for download
        reply.header(
          "Content-Disposition",
          `attachment; filename="${image.filename}"`
        );
        reply.header("Content-Type", "application/octet-stream");
        reply.header("Content-Length", buffer.length);

        return reply.send(buffer);
      } catch (err) {
        fastify.log.error(err);
        return reply
          .status(500)
          .send({ message: "Failed to download image", error: err });
      }
    }
  );

  // Simple upload endpoint for testing
  fastify.post(
    "/upload",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        fastify.log.info("Simple upload endpoint called");

        if (!request.isMultipart()) {
          return reply
            .status(400)
            .send({ message: "Request must be multipart" });
        }

        const data = await request.file();
        if (!data) {
          return reply.status(400).send({ message: "No file provided" });
        }

        fastify.log.info(
          `Received file: ${data.filename}, size: ${data.file.bytesRead}`
        );

        return reply.status(200).send({
          message: "File received successfully",
          filename: data.filename,
          mimetype: data.mimetype,
        });
      } catch (error) {
        fastify.log.error("Upload error:", error);
        return reply
          .status(500)
          .send({ message: "Upload failed", error: String(error) });
      }
    }
  );

  fastify.post("/", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      fastify.log.info("Starting image upload request");

      // Check if request is multipart
      if (!request.isMultipart()) {
        return reply.status(400).send({
          message: "Request must be multipart/form-data",
        });
      }

      // Parse multipart form data - with attachFieldsToBody: true
      let fileData: MultipartFile | null = null;
      let tags: string[] = [];
      let family_ids: string[] = [];
      let title: string | undefined = undefined;

      try {
        // With attachFieldsToBody: true, files are in request.body too
        const body = request.body as any;
        fastify.log.info(`Request body keys:`, Object.keys(body || {}));

        // Find the file field in the body
        if (body) {
          for (const [key, value] of Object.entries(body)) {
            fastify.log.info(`Body field ${key}:`, typeof value, value);

            // Check if this is a file (has file property)
            if (value && typeof value === "object" && "file" in value) {
              fileData = value as MultipartFile;
              fastify.log.info(
                `Found file in ${key}: ${fileData.filename}, mimetype=${fileData.mimetype}`
              );
              break;
            }
          }

          // Get title from body
          if (body.title) {
            const titleValue = body.title.value || body.title;
            title = titleValue && titleValue !== "" ? titleValue : undefined;
            fastify.log.info(`Parsed title: ${title}`);
          }

          // Get tags from body
          if (body.tags) {
            try {
              const tagsValue = body.tags.value || body.tags;
              fastify.log.info(`Raw tags value: ${tagsValue}`);
              tags = tagsValue && tagsValue !== "" ? JSON.parse(tagsValue) : [];
              fastify.log.info(`Parsed tags: ${JSON.stringify(tags)}`);
            } catch (err) {
              fastify.log.warn("Failed to parse tags:", err);
              tags = [];
            }
          }

          // Get family_ids from body
          if (body.family_ids) {
            try {
              const familyIdsValue = body.family_ids.value || body.family_ids;
              fastify.log.info(`Raw family_ids value: ${familyIdsValue}`);
              family_ids =
                familyIdsValue && familyIdsValue !== ""
                  ? JSON.parse(familyIdsValue)
                  : [];
              fastify.log.info(
                `Parsed family_ids: ${JSON.stringify(family_ids)}`
              );
            } catch (err) {
              fastify.log.warn("Failed to parse family_ids:", err);
              family_ids = [];
            }
          }
        }
      } catch (error) {
        fastify.log.error("Error parsing multipart data:", error);
        return reply.status(400).send({
          message: "Error processing form data",
        });
      }

      if (!fileData) {
        return reply.status(400).send({
          message: "No file uploaded. Please provide an image file.",
        });
      }

      // Validate family_ids
      if (!family_ids || family_ids.length === 0) {
        return reply.status(400).send({
          message: "At least one family must be associated with the image.",
        });
      }

      // Validate file type
      const allowedTypes = [
        "image/jpeg",
        "image/jpg",
        "image/png",
        "image/gif",
        "image/webp",
      ];
      if (!allowedTypes.includes(fileData.mimetype)) {
        return reply.status(400).send({
          message:
            "Invalid file type. Only JPEG, PNG, GIF, and WebP images are allowed.",
        });
      }

      // Convert file stream to buffer and check size
      const buffer = await fileData.toBuffer();
      const maxSize = 10 * 1024 * 1024; // 10MB
      if (buffer.length > maxSize) {
        return reply.status(400).send({
          message: "File too large. Maximum size is 10MB.",
        });
      }

      fastify.log.info(
        `Uploading file: ${fileData.filename}, size: ${buffer.length} bytes`
      );

      // Generate S3 key first
      const s3Key = fastify.s3.createKey(
        "family_photos",
        uuidv4(),
        fileData.filename
      );

      // Upload to S3 first
      await fastify.s3.upload({
        key: s3Key,
        buffer: buffer,
        contentType: fileData.mimetype,
        metadata: {
          originalName: fileData.filename || "unknown",
          uploadedAt: new Date().toISOString(),
        },
      });

      // Get public URL for immediate access
      const publicUrl = fastify.s3.getPublicUrl(s3Key);

      // Create image record in database with S3 key
      const image = await fastify.image.create({
        filename: fileData.filename,
        title,
        tags,
        family_ids,
        s3Url: publicUrl, // Store the public S3 url
      });

      return reply.status(201).send({ image });
    } catch (error) {
      fastify.log.error("Error uploading image:", error);
      return reply.status(500).send({
        message: "Failed to upload image",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

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
      const { title, tags, family_ids } = request.body as ImageInput;

      // First get the existing image to preserve s3_url and filename
      const existingImage = await fastify.image.getById(imageId);
      if (!existingImage) {
        return reply.status(404).send({ message: "Image not found" });
      }

      // Update with preserved s3_url and filename
      const image = await fastify.image.update(imageId, {
        title,
        tags,
        family_ids,
        s3Url: existingImage.s3_url, // Preserve existing s3_url
      });
      return reply.status(200).send({ image });
    }
  );

  // Get images by family
  fastify.get(
    "/family/:familyId",
    {
      schema: {
        params: {
          type: "object",
          required: ["familyId"],
          properties: {
            familyId: { type: "string", format: "uuid" },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { familyId } = request.params as { familyId: string };
      try {
        const images = await fastify.image.getByFamily(familyId);
        return reply.status(200).send({ images });
      } catch (error) {
        fastify.log.error("Error getting images by family:", error);
        return reply.status(500).send({
          message: "Failed to get images for family",
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }
  );

  fastify.delete(
    "/:imageId",
    {
      schema: {
        params: getImageParamsSchema,
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { imageId } = request.params as GetImageParams;
      try {
        // First get the image to extract S3 key
        const image = await fastify.image.getById(imageId);
        if (!image) {
          return reply.status(404).send({ message: "Image not found" });
        }

        // Delete from S3 if s3_url exists
        if (image.s3_url) {
          try {
            // Extract S3 key from the public URL
            // URL format: https://grammysnaps.s3.us-east-2.amazonaws.com/grammysnaps/familyId/imageId/filename
            const url = new URL(image.s3_url);
            let s3Key = url.pathname.substring(1); // Remove leading slash

            fastify.log.info(`Deleting S3 object with key: ${s3Key}`);
            await fastify.s3.delete(s3Key);
          } catch (s3Error) {
            fastify.log.warn(`Failed to delete S3 object: ${s3Error}`);
            // Continue with database deletion even if S3 deletion fails
          }
        }

        // Delete from database
        await fastify.image.delete(imageId);
        return reply.status(204).send();
      } catch (err) {
        fastify.log.error(err);
        return reply
          .status(500)
          .send({ message: "Failed to delete image", error: err });
      }
    }
  );

  /* Get images by tag */
  fastify.get(
    "/tag/:tagId",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { tagId } = request.params as { tagId: string };
      const images = await fastify.image.getAllWithTag(tagId);
      return reply.status(200).send({ images });
    }
  );
};

export default imageRoutes;

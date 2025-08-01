import { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import { ImageInput } from "../types/image.types";
import { MultipartFile } from "@fastify/multipart";
import { v4 as uuidv4 } from "uuid";
import { IMAGE_ERRORS } from "../types/errors";

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

const imageRoutes: FastifyPluginAsync = async (fastify) => {
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
        return reply.status(404).send({ message: IMAGE_ERRORS.NOT_FOUND });
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
          return reply.status(404).send({ message: IMAGE_ERRORS.NOT_FOUND });
        }

        if (!image.s3_url) {
          return reply
            .status(404)
            .send({ message: IMAGE_ERRORS.FILE_NOT_FOUND });
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
        return reply.status(500).send({
          message: IMAGE_ERRORS.DOWNLOAD_FAILED,
          error: err,
        });
      }
    }
  );

  fastify.post("/", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      fastify.log.info("Starting image upload request");

      // Check if request is multipart
      if (!request.isMultipart()) {
        return reply.status(400).send({
          message: IMAGE_ERRORS.MULTIPART_REQUIRED,
        });
      }

      // Parse multipart form data - with attachFieldsToBody: true
      let fileData: MultipartFile | null = null;
      let tags: string[] = [];
      let family_ids: string[] = [];
      let title: string | undefined = undefined;

      try {
        // With attachFieldsToBody: true, files are in request.body too
        const body = request.body as Record<string, unknown>;
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
            const titleData = body.title as { value?: string } | string;
            const titleValue =
              typeof titleData === "object" && titleData.value
                ? titleData.value
                : titleData;
            title =
              typeof titleValue === "string" && titleValue !== ""
                ? titleValue
                : undefined;
            fastify.log.info(`Parsed title: ${title}`);
          }

          // Get tags from body
          if (body.tags) {
            try {
              const tagsData = body.tags as { value?: string } | string;
              const tagsValue =
                typeof tagsData === "object" && tagsData.value
                  ? tagsData.value
                  : tagsData;
              fastify.log.info(`Raw tags value: ${tagsValue}`);
              tags =
                typeof tagsValue === "string" && tagsValue !== ""
                  ? JSON.parse(tagsValue)
                  : [];
              fastify.log.info(`Parsed tags: ${JSON.stringify(tags)}`);
            } catch (err) {
              fastify.log.warn("Failed to parse tags:", err);
              tags = [];
            }
          }

          // Get family_ids from body
          if (body.family_ids) {
            try {
              const familyIdsData = body.family_ids as
                | { value?: string }
                | string;
              const familyIdsValue =
                typeof familyIdsData === "object" && familyIdsData.value
                  ? familyIdsData.value
                  : familyIdsData;
              fastify.log.info(`Raw family_ids value: ${familyIdsValue}`);
              family_ids =
                familyIdsValue &&
                typeof familyIdsValue === "string" &&
                familyIdsValue !== ""
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
          message: IMAGE_ERRORS.PROCESSING_ERROR,
        });
      }

      if (!fileData) {
        return reply.status(400).send({
          message: IMAGE_ERRORS.NO_FILE,
        });
      }

      // Validate family_ids
      if (!family_ids || family_ids.length === 0) {
        return reply.status(400).send({
          message: IMAGE_ERRORS.FAMILY_REQUIRED,
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
          message: IMAGE_ERRORS.INVALID_TYPE,
        });
      }

      // Convert file stream to buffer and check size
      const buffer = await fileData.toBuffer();
      const maxSize = 10 * 1024 * 1024; // 10MB
      if (buffer.length > maxSize) {
        return reply.status(400).send({
          message: IMAGE_ERRORS.TOO_LARGE,
        });
      }

      fastify.log.info(
        `Uploading file: ${fileData.filename}, size: ${buffer.length} bytes`
      );

      // Generate S3 key first
      const s3Key = fastify.s3.createKey(
        "family-photos",
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
        message: IMAGE_ERRORS.UPLOAD_FAILED,
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
        return reply.status(404).send({ message: IMAGE_ERRORS.NOT_FOUND });
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
          message: IMAGE_ERRORS.GET_BY_FAMILY_FAILED,
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
          return reply.status(404).send({ message: IMAGE_ERRORS.NOT_FOUND });
        }

        // Delete from S3 if s3_url exists
        if (image.s3_url) {
          try {
            // Extract S3 key from the public URL
            // URL format: https://grammysnaps.s3.us-east-2.amazonaws.com/grammysnaps/familyId/imageId/filename
            const url = new URL(image.s3_url);
            const s3Key = url.pathname.substring(1); // Remove leading slash

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
        return reply.status(500).send({
          message: IMAGE_ERRORS.DELETE_FAILED,
          error: err,
        });
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

  /* Get images by multiple families */
  fastify.post(
    "/families",
    {
      schema: {
        body: {
          type: "object",
          required: ["family_ids"],
          properties: {
            family_ids: {
              type: "array",
              items: { type: "string", format: "uuid" },
              minItems: 1,
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { family_ids } = request.body as { family_ids: string[] };
      try {
        const images = await fastify.image.getByFamilies(family_ids);
        return reply.status(200).send({ images });
      } catch (error) {
        fastify.log.error("Error getting images by families:", error);
        return reply.status(500).send({
          message: IMAGE_ERRORS.GET_BY_FAMILIES_FAILED,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }
  );
};

export default imageRoutes;

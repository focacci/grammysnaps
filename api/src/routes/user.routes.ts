import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import {
  UserInput,
  UserUpdate,
  SecurityUpdateInput,
} from "../types/user.types";
import { ValidationUtils } from "../utils/validation";
import { MultipartFile } from "@fastify/multipart";
import { USER_ERRORS } from "../types/errors";
import { requireAuth } from "../middleware/auth.middleware";
import sharp from "sharp";

interface UserParams {
  id: string;
}

interface UserQueryParams {
  email?: string;
}

interface FamilyParams {
  userId: string;
  familyId: string;
}

export default async function userRoutes(fastify: FastifyInstance) {
  // Create a new user
  fastify.post<{ Body: UserInput }>(
    "/",
    async (
      request: FastifyRequest<{ Body: UserInput }>,
      reply: FastifyReply
    ) => {
      try {
        // Check if invite key is required in dev environment
        if (process.env.NODE_ENV === "dev") {
          if (!request.body.invite_key) {
            return reply.status(400).send({
              error: USER_ERRORS.INVITE_KEY_REQUIRED,
            });
          }

          // Validate invite key (you can customize this validation logic)
          const validInviteKey = process.env.DEV_INVITE_KEY || "dev123";
          if (request.body.invite_key !== validInviteKey) {
            return reply.status(400).send({
              error: USER_ERRORS.INVITE_KEY_INVALID,
            });
          }
        }

        const user = await fastify.user.create(request.body);
        return reply.status(201).send(user);
      } catch (error) {
        fastify.log.error(error);
        if (
          error instanceof Error &&
          error.message.includes("already exists")
        ) {
          return reply.status(409).send({
            error: USER_ERRORS.ACCOUNT_EXISTS,
          });
        }
        return reply.status(500).send({
          error: USER_ERRORS.CREATE_FAILED,
        });
      }
    }
  );

  // Get all users
  fastify.get<{ Querystring: UserQueryParams }>(
    "/",
    { preHandler: requireAuth },
    async (
      request: FastifyRequest<{ Querystring: UserQueryParams }>,
      reply: FastifyReply
    ) => {
      try {
        const users = await fastify.user.get();
        return reply.send(users);
      } catch (error) {
        fastify.log.error(error);
        return reply.status(500).send({
          error: USER_ERRORS.RETRIEVE_FAILED,
        });
      }
    }
  );

  // Get user by ID
  fastify.get<{ Params: UserParams }>(
    "/:id",
    { preHandler: requireAuth },
    async (
      request: FastifyRequest<{ Params: UserParams }>,
      reply: FastifyReply
    ) => {
      try {
        const sanitizedId = ValidationUtils.sanitizeUUID(
          request.params.id,
          "User ID"
        );
        const user = await fastify.user.getById(sanitizedId);
        if (!user) {
          return reply.status(404).send({
            error: USER_ERRORS.NOT_FOUND,
          });
        }
        return reply.send(user);
      } catch (error) {
        fastify.log.error(error);
        if (error instanceof Error && error.message.includes("Invalid")) {
          return reply.status(400).send({ error: error.message });
        }
        return reply.status(500).send({
          error: USER_ERRORS.GET_BY_ID_FAILED,
        });
      }
    }
  );

  // Get user by email
  fastify.get<{ Params: { email: string } }>(
    "/email/:email",
    { preHandler: requireAuth },
    async (
      request: FastifyRequest<{ Params: { email: string } }>,
      reply: FastifyReply
    ) => {
      try {
        const sanitizedEmail = ValidationUtils.sanitizeEmail(
          request.params.email
        );
        const user = await fastify.user.getByEmail(sanitizedEmail);
        if (!user) {
          return reply.status(404).send({
            error: USER_ERRORS.EMAIL_NOT_FOUND,
          });
        }
        return reply.send(user);
      } catch (error) {
        fastify.log.error(error);
        if (error instanceof Error && error.message.includes("Invalid")) {
          return reply.status(400).send({ error: error.message });
        }
        return reply.status(500).send({
          error: USER_ERRORS.GET_BY_EMAIL_FAILED,
        });
      }
    }
  );

  // Update user
  fastify.put<{ Params: UserParams; Body: UserUpdate }>(
    "/:id",
    { preHandler: requireAuth },
    async (
      request: FastifyRequest<{ Params: UserParams; Body: UserUpdate }>,
      reply: FastifyReply
    ) => {
      try {
        console.log(request.body);
        const user = await fastify.user.update(request.params.id, request.body);
        if (!user) {
          return reply.status(404).send({
            error: USER_ERRORS.UPDATE_NOT_FOUND,
          });
        }
        return reply.send(user);
      } catch (error) {
        fastify.log.error(error);
        if (
          error instanceof Error &&
          error.message.includes("already exists")
        ) {
          return reply.status(409).send({
            error: USER_ERRORS.EMAIL_IN_USE,
          });
        }
        return reply.status(500).send({
          error: USER_ERRORS.UPDATE_FAILED,
        });
      }
    }
  );

  // Update user security (email/password)
  fastify.put<{ Params: UserParams; Body: SecurityUpdateInput }>(
    "/:id/security",
    { preHandler: requireAuth },
    async (
      request: FastifyRequest<{
        Params: UserParams;
        Body: SecurityUpdateInput;
      }>,
      reply: FastifyReply
    ) => {
      try {
        const user = await fastify.user.updateSecurity(
          request.params.id,
          request.body
        );
        if (!user) {
          return reply.status(404).send({
            error: USER_ERRORS.SECURITY_UPDATE_NOT_FOUND,
          });
        }
        return reply.send(user);
      } catch (error) {
        fastify.log.error(error);
        if (error instanceof Error) {
          if (error.message.includes("already exists")) {
            return reply.status(409).send({
              error: USER_ERRORS.EMAIL_IN_USE,
            });
          }
          if (error.message.includes("Current password is incorrect")) {
            return reply.status(401).send({
              error: USER_ERRORS.INCORRECT_PASSWORD,
            });
          }
          if (error.message.includes("Current password is required")) {
            return reply.status(400).send({
              error: USER_ERRORS.CURRENT_PASSWORD_REQUIRED,
            });
          }
        }
        return reply.status(500).send({
          error: USER_ERRORS.SECURITY_UPDATE_FAILED,
        });
      }
    }
  );

  // Delete user
  fastify.delete<{ Params: UserParams }>(
    "/:id",
    { preHandler: requireAuth },
    async (
      request: FastifyRequest<{ Params: UserParams }>,
      reply: FastifyReply
    ) => {
      try {
        // Revoke all tokens for this user before deletion
        await fastify.auth.revokeUserTokens(request.params.id);

        await fastify.user.delete(request.params.id);
        return reply.status(204).send();
      } catch (error) {
        fastify.log.error(error);
        if (error instanceof Error && error.message.includes("not found")) {
          return reply.status(404).send({
            error: USER_ERRORS.DELETE_NOT_FOUND,
          });
        }
        return reply.status(500).send({
          error: USER_ERRORS.DELETE_FAILED,
        });
      }
    }
  );

  // Add user to family
  fastify.post<{ Params: FamilyParams }>(
    "/:userId/family/:familyId",
    { preHandler: requireAuth },
    async (
      request: FastifyRequest<{ Params: FamilyParams }>,
      reply: FastifyReply
    ) => {
      try {
        const { userId, familyId } = request.params;

        await fastify.user.addToFamily(userId, familyId);

        return reply
          .status(201)
          .send({ message: "User added to family successfully" });
      } catch (error) {
        fastify.log.error(error);
        if (error instanceof Error && error.message.includes("not found")) {
          if (error.message.includes("User")) {
            return reply.status(404).send({
              error: USER_ERRORS.ADD_TO_FAMILY_USER_NOT_FOUND,
            });
          } else {
            return reply.status(404).send({
              error: USER_ERRORS.ADD_TO_FAMILY_FAMILY_NOT_FOUND,
            });
          }
        }
        return reply.status(500).send({
          error: USER_ERRORS.ADD_TO_FAMILY_FAILED,
        });
      }
    }
  );

  // Remove user from family
  fastify.delete<{ Params: FamilyParams }>(
    "/:userId/family/:familyId",
    { preHandler: requireAuth },
    async (
      request: FastifyRequest<{ Params: FamilyParams }>,
      reply: FastifyReply
    ) => {
      try {
        const { userId, familyId } = request.params;

        await fastify.user.removeFromFamily(userId, familyId);

        return reply
          .status(200)
          .send({ message: "User removed from family successfully" });
      } catch (error) {
        fastify.log.error(error);
        if (error instanceof Error && error.message.includes("not found")) {
          if (error.message.includes("User")) {
            return reply.status(404).send({
              error: USER_ERRORS.REMOVE_FROM_FAMILY_USER_NOT_FOUND,
            });
          } else {
            return reply.status(404).send({
              error: USER_ERRORS.REMOVE_FROM_FAMILY_FAMILY_NOT_FOUND,
            });
          }
        }
        return reply.status(500).send({
          error: USER_ERRORS.REMOVE_FROM_FAMILY_FAILED,
        });
      }
    }
  );

  // Set profile picture
  fastify.post(
    "/:id/profile-picture",
    {
      preHandler: requireAuth,
      schema: {
        consumes: ["multipart/form-data"],
        params: {
          type: "object",
          properties: {
            id: { type: "string" },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      try {
        // Log request headers for debugging
        fastify.log.info(`Content-Type: ${request.headers["content-type"]}`);
        fastify.log.info(
          `Content-Length: ${request.headers["content-length"]}`
        );

        // Check if request is multipart
        if (!request.isMultipart()) {
          return reply.status(400).send({
            message: USER_ERRORS.PROFILE_PICTURE_MULTIPART_REQUIRED,
          });
        }

        // Parse multipart form data and get the file
        let file: MultipartFile | undefined;

        try {
          fastify.log.info("Starting profile picture upload parsing");

          // With attachFieldsToBody: true, files are in request.body
          const body = request.body as Record<string, unknown>;
          fastify.log.info(`Request body keys:`, Object.keys(body || {}));

          // Find the file field in the body
          if (body) {
            for (const [key, value] of Object.entries(body)) {
              fastify.log.info(`Body field ${key}:`, typeof value);

              // Check if this is a file (has file property)
              if (value && typeof value === "object" && "file" in value) {
                file = value as MultipartFile;
                fastify.log.info(
                  `Found file in ${key}: ${file.filename}, mimetype=${file.mimetype}`
                );
                break;
              }
            }
          }
        } catch (parseError) {
          fastify.log.error("Error parsing multipart data:", parseError);
          return reply.status(400).send({
            message: USER_ERRORS.PROFILE_PICTURE_PROCESSING_ERROR,
          });
        }

        if (!file) {
          return reply.status(400).send({
            message: USER_ERRORS.PROFILE_PICTURE_NO_FILE,
          });
        }

        fastify.log.info(
          `Processing file: ${file.filename}, mimetype: ${file.mimetype}`
        );

        // Validate file type
        const allowedTypes = [
          "image/jpeg",
          "image/jpg",
          "image/png",
          "image/gif",
          "image/webp",
        ];
        if (!allowedTypes.includes(file.mimetype)) {
          return reply.status(400).send({
            message: USER_ERRORS.PROFILE_PICTURE_INVALID_TYPE,
          });
        }

        // Convert file stream to buffer and check size
        const buffer = await file.toBuffer();
        fastify.log.info(`File buffer created, size: ${buffer.length} bytes`);

        const maxSize = 5 * 1024 * 1024; // 5 MB
        if (buffer.length === 0) {
          return reply
            .status(400)
            .send({ message: USER_ERRORS.PROFILE_PICTURE_EMPTY });
        }

        if (buffer.length > maxSize) {
          return reply
            .status(400)
            .send({ message: USER_ERRORS.PROFILE_PICTURE_TOO_LARGE });
        }

        fastify.log.info(
          `Uploading file: ${file.filename}, size: ${buffer.length} bytes`
        );

        // Generate a unique key for S3 (original)
        const fileExtension = file.filename?.split(".").pop() || "jpg";
        const originalS3Key = fastify.s3.createKey(
          process.env.NODE_ENV || "local",
          "profile-pictures",
          id,
          `profile.${fileExtension}`
        );

        // Generate thumbnail key
        const thumbnailS3Key = fastify.s3.createKey(
          process.env.NODE_ENV || "local",
          "profile-pictures",
          id,
          `thumb_profile.${fileExtension}`
        );

        // Create 400x400 thumbnail using Sharp
        const thumbnailBuffer = await sharp(buffer)
          .resize(400, 400, {
            fit: "cover",
            position: "center",
          })
          .jpeg({ quality: 80 })
          .toBuffer();

        // Upload original to S3
        await fastify.s3.upload({
          key: originalS3Key,
          buffer: buffer,
          contentType: file.mimetype,
          metadata: {
            userId: id,
            uploadedAt: new Date().toISOString(),
            type: "original",
          },
        });

        // Upload thumbnail to S3
        await fastify.s3.upload({
          key: thumbnailS3Key,
          buffer: thumbnailBuffer,
          contentType: "image/jpeg",
          metadata: {
            userId: id,
            uploadedAt: new Date().toISOString(),
            type: "thumbnail",
          },
        });

        const publicUrl = fastify.s3.getPublicUrl(originalS3Key);
        const thumbnailUrl = fastify.s3.getPublicUrl(thumbnailS3Key);

        // Update user record with both URLs
        await fastify.user.update(id, {
          profile_picture_url: publicUrl,
          profile_picture_thumbnail_url: thumbnailUrl,
        });

        return reply.send({
          url: publicUrl,
          thumbnail_url: thumbnailUrl,
        });
      } catch (error) {
        fastify.log.error("Profile picture upload error:", error);

        if (error instanceof Error) {
          // Handle specific S3 errors
          if (error.message.includes("S3") || error.message.includes("AWS")) {
            return reply.status(500).send({
              message: USER_ERRORS.PROFILE_PICTURE_UPLOAD_FAILED,
              error: error.message,
            });
          }

          // Handle user update errors
          if (error.message.includes("User not found")) {
            return reply.status(404).send({
              message: USER_ERRORS.PROFILE_PICTURE_USER_NOT_FOUND,
              error: error.message,
            });
          }
        }

        return reply.status(500).send({
          message: USER_ERRORS.PROFILE_PICTURE_GENERAL_FAILED,
          error: String(error),
        });
      }
    }
  );
}

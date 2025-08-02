import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import {
  UserInput,
  UserUpdate,
  SecurityUpdateInput,
} from "../types/user.types";
import { ValidationUtils } from "../utils/validation";
import { MultipartFile } from "@fastify/multipart";

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
        const user = await fastify.user.create(request.body);
        return reply.status(201).send(user);
      } catch (error) {
        fastify.log.error(error);
        if (
          error instanceof Error &&
          error.message.includes("already exists")
        ) {
          return reply
            .status(409)
            .send({
              error:
                "An account with this email address already exists. Please use a different email or try logging in instead.",
            });
        }
        return reply
          .status(500)
          .send({
            error:
              "Unable to create your account at this time. Please try again later.",
          });
      }
    }
  );

  // Get all users
  fastify.get(
    "/",
    async (
      request: FastifyRequest<{ Querystring: UserQueryParams }>,
      reply: FastifyReply
    ) => {
      try {
        const users = await fastify.user.get();
        return reply.send(users);
      } catch (error) {
        fastify.log.error(error);
        return reply
          .status(500)
          .send({
            error:
              "Unable to retrieve users at this time. Please try again later.",
          });
      }
    }
  );

  // Get user by ID
  fastify.get<{ Params: UserParams }>(
    "/:id",
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
          return reply
            .status(404)
            .send({
              error:
                "The requested user could not be found. They may have been deleted or the ID is incorrect.",
            });
        }
        return reply.send(user);
      } catch (error) {
        fastify.log.error(error);
        if (error instanceof Error && error.message.includes("Invalid")) {
          return reply.status(400).send({ error: error.message });
        }
        return reply
          .status(500)
          .send({
            error:
              "Unable to retrieve the user by ID at this time. Please try again later.",
          });
      }
    }
  );

  // Get user by email
  fastify.get(
    "/email/:email",
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
          return reply
            .status(404)
            .send({
              error:
                "No user found with this email address. Please check the email and try again.",
            });
        }
        return reply.send(user);
      } catch (error) {
        fastify.log.error(error);
        if (error instanceof Error && error.message.includes("Invalid")) {
          return reply.status(400).send({ error: error.message });
        }
        return reply
          .status(500)
          .send({
            error:
              "Unable to retrieve the user by email at this time. Please try again later.",
          });
      }
    }
  );

  // Update user
  fastify.put<{ Params: UserParams; Body: UserUpdate }>(
    "/:id",
    async (
      request: FastifyRequest<{ Params: UserParams; Body: UserUpdate }>,
      reply: FastifyReply
    ) => {
      try {
        console.log(request.body);
        const user = await fastify.user.update(request.params.id, request.body);
        if (!user) {
          return reply
            .status(404)
            .send({
              error:
                "The user you're trying to update could not be found. They may have been deleted.",
            });
        }
        return reply.send(user);
      } catch (error) {
        fastify.log.error(error);
        if (
          error instanceof Error &&
          error.message.includes("already exists")
        ) {
          return reply
            .status(409)
            .send({
              error:
                "This email address is already in use by another account. Please choose a different email.",
            });
        }
        return reply
          .status(500)
          .send({
            error:
              "Unable to update your profile at this time. Please try again later.",
          });
      }
    }
  );

  // Update user security (email/password)
  fastify.put<{ Params: UserParams; Body: SecurityUpdateInput }>(
    "/:id/security",
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
          return reply
            .status(404)
            .send({
              error:
                "The user account could not be found. Please try logging in again.",
            });
        }
        return reply.send(user);
      } catch (error) {
        fastify.log.error(error);
        if (error instanceof Error) {
          if (error.message.includes("already exists")) {
            return reply
              .status(409)
              .send({
                error:
                  "This email address is already in use by another account. Please choose a different email.",
              });
          }
          if (error.message.includes("Current password is incorrect")) {
            return reply
              .status(401)
              .send({
                error:
                  "The current password you entered is incorrect. Please try again.",
              });
          }
          if (error.message.includes("Current password is required")) {
            return reply
              .status(400)
              .send({
                error:
                  "Your current password is required to make security changes.",
              });
          }
        }
        return reply
          .status(500)
          .send({
            error:
              "Unable to update your security settings at this time. Please try again later.",
          });
      }
    }
  );

  // Delete user
  fastify.delete<{ Params: UserParams }>(
    "/:id",
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
          return reply
            .status(404)
            .send({
              error:
                "The user account could not be found or has already been deleted.",
            });
        }
        return reply
          .status(500)
          .send({
            error:
              "Unable to delete the user account at this time. Please try again later.",
          });
      }
    }
  );

  // Add user to family
  fastify.post<{ Params: FamilyParams }>(
    "/:userId/family/:familyId",
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
            return reply
              .status(404)
              .send({
                error:
                  "The user could not be found. They may have been deleted.",
              });
          } else {
            return reply
              .status(404)
              .send({
                error:
                  "The family could not be found. It may have been deleted.",
              });
          }
        }
        return reply
          .status(500)
          .send({
            error:
              "Unable to add the user to the family at this time. Please try again later.",
          });
      }
    }
  );

  // Remove user from family
  fastify.delete<{ Params: FamilyParams }>(
    "/:userId/family/:familyId",
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
            return reply
              .status(404)
              .send({
                error:
                  "The user could not be found. They may have been deleted.",
              });
          } else {
            return reply
              .status(404)
              .send({
                error:
                  "The family could not be found. It may have been deleted.",
              });
          }
        }
        return reply
          .status(500)
          .send({
            error:
              "Unable to remove the user from the family at this time. Please try again later.",
          });
      }
    }
  );

  // Set profile picture
  fastify.post(
    "/:id/profile-picture",
    {
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
            message: "Request must be multipart/form-data",
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
            message: "Error processing form data",
          });
        }

        if (!file) {
          return reply.status(400).send({
            message: "No file uploaded. Please provide a profile picture.",
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
            message:
              "Invalid file type. Only JPEG, PNG, GIF, and WebP images are allowed.",
          });
        }

        // Convert file stream to buffer and check size
        const buffer = await file.toBuffer();
        fastify.log.info(`File buffer created, size: ${buffer.length} bytes`);

        const maxSize = 5 * 1024 * 1024; // 5 MB
        if (buffer.length === 0) {
          return reply.status(400).send({ message: "Uploaded file is empty" });
        }

        if (buffer.length > maxSize) {
          return reply
            .status(400)
            .send({ message: "File size exceeds 5 MB limit" });
        }

        fastify.log.info(
          `Uploading file: ${file.filename}, size: ${buffer.length} bytes`
        );

        // Generate a unique key for S3
        const fileExtension = file.filename?.split(".").pop() || "jpg";
        const s3Key = fastify.s3.createKey(
          "profile-pictures",
          id,
          `profile.${fileExtension}`
        );

        // Upload to S3 (assumes fastify.s3 is configured)
        await fastify.s3.upload({
          key: s3Key,
          buffer: buffer,
          contentType: file.mimetype,
          metadata: {
            userId: id,
            uploadedAt: new Date().toISOString(),
          },
        });

        const publicUrl = fastify.s3.getPublicUrl(s3Key);

        // Optionally, update user record with the S3 URL
        await fastify.user.update(id, {
          profile_picture_url: publicUrl,
        });

        return reply.send({ url: publicUrl });
      } catch (error) {
        fastify.log.error("Profile picture upload error:", error);

        if (error instanceof Error) {
          // Handle specific S3 errors
          if (error.message.includes("S3") || error.message.includes("AWS")) {
            return reply.status(500).send({
              message:
                "Unable to save profile picture. Please try again later.",
              error: error.message,
            });
          }

          // Handle user update errors
          if (error.message.includes("User not found")) {
            return reply
              .status(404)
              .send({ message: "User not found", error: error.message });
          }
        }

        return reply.status(500).send({
          message: "Profile picture upload failed",
          error: String(error),
        });
      }
    }
  );
}

import { FastifyPluginAsync } from "fastify";
import { CollectionInput, CollectionUpdate } from "../types/collection.types";
import { COLLECTION_ERRORS } from "../types/errors";
import { requireAuth } from "../middleware/auth.middleware";
import { UUID } from "crypto";

const collectionRoutes: FastifyPluginAsync = async (fastify) => {
  // Add auth middleware to all collection routes
  fastify.addHook("preHandler", requireAuth);
  // Get all collections (admin only)
  fastify.get("/", async (request, reply) => {
    try {
      const collections = await fastify.collection.get();
      return collections;
    } catch {
      reply.code(500).send({
        error: COLLECTION_ERRORS.RETRIEVE_FAILED,
      });
    }
  });

  // Get collections for a specific user
  fastify.get("/user/:userId", async (request, reply) => {
    try {
      const { userId } = request.params as { userId: UUID };
      const collections = await fastify.collection.getUserCollections(userId);
      return collections;
    } catch (error) {
      fastify.log.error(error);
      reply.code(500).send({
        error: COLLECTION_ERRORS.RETRIEVE_USER_COLLECTIONS_FAILED,
      });
    }
  });

  // Get collection by ID
  fastify.get("/:id", async (request, reply) => {
    try {
      const { id } = request.params as { id: UUID };
      const collection = await fastify.collection.getById(id);

      if (!collection) {
        return reply.code(404).send({
          error: COLLECTION_ERRORS.NOT_FOUND,
        });
      }

      return collection;
    } catch (error) {
      fastify.log.error(error);
      reply.code(500).send({
        error: COLLECTION_ERRORS.GET_BY_ID_FAILED,
      });
    }
  });

  // Get collection members
  fastify.get("/:id/members", async (request, reply) => {
    try {
      const { id } = request.params as { id: UUID };
      const members = await fastify.collection.getMembers(id);
      return members;
    } catch (error) {
      fastify.log.error(error);
      reply.code(500).send({
        error: COLLECTION_ERRORS.GET_MEMBERS_FAILED,
      });
    }
  });

  // Create a new collection
  fastify.post("/", async (request, reply) => {
    try {
      const collectionData = request.body as CollectionInput & { owner_id: UUID };
      const { owner_id, ...collectionInput } = collectionData;

      if (!owner_id) {
        return reply.code(400).send({
          error: COLLECTION_ERRORS.OWNER_ID_REQUIRED,
        });
      }

      if (!collectionInput.name || collectionInput.name.trim().length === 0) {
        return reply.code(400).send({ error: COLLECTION_ERRORS.NAME_REQUIRED });
      }

      const collection = await fastify.collection.create(collectionInput, owner_id);
      reply.code(201).send(collection);
    } catch (error) {
      fastify.log.error(error);
      reply.code(500).send({
        error:
          error instanceof Error ? error.message : COLLECTION_ERRORS.CREATE_FAILED,
      });
    }
  });

  // Update collection
  fastify.put("/:id", async (request, reply) => {
    try {
      const { id } = request.params as { id: UUID };
      const updateData = request.body as CollectionUpdate;

      const collection = await fastify.collection.update(id, updateData);

      if (!collection) {
        return reply.code(404).send({
          error: COLLECTION_ERRORS.UPDATE_NOT_FOUND,
        });
      }

      return collection;
    } catch (error) {
      fastify.log.error(error);
      reply.code(500).send({
        error:
          error instanceof Error ? error.message : COLLECTION_ERRORS.UPDATE_FAILED,
      });
    }
  });

  // Delete collection
  fastify.delete("/:id", async (request, reply) => {
    try {
      const { id } = request.params as { id: UUID };

      await fastify.collection.delete(id);
      reply.code(204).send();
    } catch (error) {
      fastify.log.error(error);
      reply.code(500).send({
        error:
          error instanceof Error ? error.message : COLLECTION_ERRORS.DELETE_FAILED,
      });
    }
  });

  // Add member to collection
  fastify.post("/:id/members", async (request, reply) => {
    try {
      const { id } = request.params as { id: UUID };
      const { user_id } = request.body as { user_id: UUID };

      if (!user_id) {
        return reply.code(400).send({ error: COLLECTION_ERRORS.USER_ID_REQUIRED });
      }

      await fastify.collection.addMember(id, user_id);
      reply.code(200).send({ message: "Member added successfully" });
    } catch (error) {
      fastify.log.error(error);
      reply.code(500).send({
        error:
          error instanceof Error
            ? error.message
            : COLLECTION_ERRORS.ADD_MEMBER_FAILED,
      });
    }
  });

  // Remove member from collection
  fastify.delete("/:id/members/:userId", async (request, reply) => {
    try {
      const { id, userId } = request.params as { id: UUID; userId: UUID };

      await fastify.collection.removeMember(id, userId);
      reply.code(200).send({ message: "Member removed successfully" });
    } catch (error) {
      fastify.log.error(error);
      reply.code(500).send({
        error:
          error instanceof Error
            ? error.message
            : COLLECTION_ERRORS.REMOVE_MEMBER_FAILED,
      });
    }
  });

  // Get related collections
  fastify.get("/:id/related", async (request, reply) => {
    try {
      const { id } = request.params as { id: UUID };
      const relatedCollections = await fastify.collection.getRelatedCollections(id);
      return relatedCollections;
    } catch (error) {
      fastify.log.error(error);
      reply.code(500).send({
        error: COLLECTION_ERRORS.GET_RELATED_FAILED,
      });
    }
  });

  // Add related collection
  fastify.post("/:id/related", async (request, reply) => {
    try {
      const { id } = request.params as { id: UUID };
      const { collection_id } = request.body as { collection_id: UUID };

      if (!collection_id) {
        return reply
          .code(400)
          .send({ error: COLLECTION_ERRORS.COLLECTION_ID_REQUIRED });
      }

      await fastify.collection.addRelatedCollection(id, collection_id);
      reply.code(201).send({ message: "Related collection added successfully" });
    } catch (error) {
      fastify.log.error(error);
      reply.code(500).send({
        error:
          error instanceof Error
            ? error.message
            : COLLECTION_ERRORS.ADD_RELATED_FAILED,
      });
    }
  });

  // Remove related collection
  fastify.delete("/:id/related/:relatedId", async (request, reply) => {
    try {
      const { id, relatedId } = request.params as {
        id: UUID;
        relatedId: UUID;
      };

      await fastify.collection.removeRelatedCollection(id, relatedId);
      reply.code(200).send({ message: "Related collection removed successfully" });
    } catch (error) {
      fastify.log.error(error);
      reply.code(500).send({
        error:
          error instanceof Error
            ? error.message
            : COLLECTION_ERRORS.REMOVE_RELATED_FAILED,
      });
    }
  });
};

export default collectionRoutes;

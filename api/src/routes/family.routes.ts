import { FastifyPluginAsync } from "fastify";
import { FamilyInput, FamilyUpdate } from "../types/family.types";
import { FAMILY_ERRORS } from "../types/errors";

const familyRoutes: FastifyPluginAsync = async (fastify) => {
  // Get all families (admin only)
  fastify.get("/", async (request, reply) => {
    try {
      const families = await fastify.family.get();
      return families;
    } catch {
      reply.code(500).send({
        error: FAMILY_ERRORS.RETRIEVE_FAILED,
      });
    }
  });

  // Get families for a specific user
  fastify.get("/user/:userId", async (request, reply) => {
    try {
      const { userId } = request.params as { userId: string };
      const families = await fastify.family.getUserFamilies(userId);
      return families;
    } catch (error) {
      fastify.log.error(error);
      reply.code(500).send({
        error: FAMILY_ERRORS.RETRIEVE_USER_FAMILIES_FAILED,
      });
    }
  });

  // Get family by ID
  fastify.get("/:id", async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const family = await fastify.family.getById(id);

      if (!family) {
        return reply.code(404).send({
          error: FAMILY_ERRORS.NOT_FOUND,
        });
      }

      return family;
    } catch (error) {
      fastify.log.error(error);
      reply.code(500).send({
        error: FAMILY_ERRORS.GET_BY_ID_FAILED,
      });
    }
  });

  // Get family members
  fastify.get("/:id/members", async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const members = await fastify.family.getMembers(id);
      return members;
    } catch (error) {
      fastify.log.error(error);
      reply.code(500).send({
        error: FAMILY_ERRORS.GET_MEMBERS_FAILED,
      });
    }
  });

  // Create a new family
  fastify.post("/", async (request, reply) => {
    try {
      const familyData = request.body as FamilyInput & { owner_id: string };
      const { owner_id, ...familyInput } = familyData;

      if (!owner_id) {
        return reply.code(400).send({
          error: FAMILY_ERRORS.OWNER_ID_REQUIRED,
        });
      }

      if (!familyInput.name || familyInput.name.trim().length === 0) {
        return reply.code(400).send({ error: FAMILY_ERRORS.NAME_REQUIRED });
      }

      const family = await fastify.family.create(familyInput, owner_id);
      reply.code(201).send(family);
    } catch (error) {
      fastify.log.error(error);
      reply.code(500).send({
        error:
          error instanceof Error ? error.message : FAMILY_ERRORS.CREATE_FAILED,
      });
    }
  });

  // Update family
  fastify.put("/:id", async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const updateData = request.body as FamilyUpdate;

      const family = await fastify.family.update(id, updateData);

      if (!family) {
        return reply.code(404).send({
          error: FAMILY_ERRORS.UPDATE_NOT_FOUND,
        });
      }

      return family;
    } catch (error) {
      fastify.log.error(error);
      reply.code(500).send({
        error:
          error instanceof Error ? error.message : FAMILY_ERRORS.UPDATE_FAILED,
      });
    }
  });

  // Delete family
  fastify.delete("/:id", async (request, reply) => {
    try {
      const { id } = request.params as { id: string };

      await fastify.family.delete(id);
      reply.code(204).send();
    } catch (error) {
      fastify.log.error(error);
      reply.code(500).send({
        error:
          error instanceof Error ? error.message : FAMILY_ERRORS.DELETE_FAILED,
      });
    }
  });

  // Add member to family
  fastify.post("/:id/members", async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const { user_id } = request.body as { user_id: string };

      if (!user_id) {
        return reply.code(400).send({ error: FAMILY_ERRORS.USER_ID_REQUIRED });
      }

      await fastify.family.addMember(id, user_id);
      reply.code(200).send({ message: "Member added successfully" });
    } catch (error) {
      fastify.log.error(error);
      reply.code(500).send({
        error:
          error instanceof Error
            ? error.message
            : FAMILY_ERRORS.ADD_MEMBER_FAILED,
      });
    }
  });

  // Remove member from family
  fastify.delete("/:id/members/:userId", async (request, reply) => {
    try {
      const { id, userId } = request.params as { id: string; userId: string };

      await fastify.family.removeMember(id, userId);
      reply.code(200).send({ message: "Member removed successfully" });
    } catch (error) {
      fastify.log.error(error);
      reply.code(500).send({
        error:
          error instanceof Error
            ? error.message
            : FAMILY_ERRORS.REMOVE_MEMBER_FAILED,
      });
    }
  });

  // Get related families
  fastify.get("/:id/related", async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const relatedFamilies = await fastify.family.getRelatedFamilies(id);
      return relatedFamilies;
    } catch (error) {
      fastify.log.error(error);
      reply.code(500).send({
        error: FAMILY_ERRORS.GET_RELATED_FAILED,
      });
    }
  });

  // Add related family
  fastify.post("/:id/related", async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const { family_id } = request.body as { family_id: string };

      if (!family_id) {
        return reply
          .code(400)
          .send({ error: FAMILY_ERRORS.FAMILY_ID_REQUIRED });
      }

      await fastify.family.addRelatedFamily(id, family_id);
      reply.code(201).send({ message: "Related family added successfully" });
    } catch (error) {
      fastify.log.error(error);
      reply.code(500).send({
        error:
          error instanceof Error
            ? error.message
            : FAMILY_ERRORS.ADD_RELATED_FAILED,
      });
    }
  });

  // Remove related family
  fastify.delete("/:id/related/:relatedId", async (request, reply) => {
    try {
      const { id, relatedId } = request.params as {
        id: string;
        relatedId: string;
      };

      await fastify.family.removeRelatedFamily(id, relatedId);
      reply.code(200).send({ message: "Related family removed successfully" });
    } catch (error) {
      fastify.log.error(error);
      reply.code(500).send({
        error:
          error instanceof Error
            ? error.message
            : FAMILY_ERRORS.REMOVE_RELATED_FAILED,
      });
    }
  });
};

export default familyRoutes;

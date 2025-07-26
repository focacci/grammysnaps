import { FastifyPluginAsync } from "fastify";
import { FamilyInput, FamilyUpdate } from "../types/family.types";

const familyRoutes: FastifyPluginAsync = async (fastify) => {
  // Get all families (admin only)
  fastify.get("/families", async (request, reply) => {
    try {
      const families = await fastify.family.get();
      return families;
    } catch (error) {
      reply.code(500).send({ error: "Failed to fetch families" });
    }
  });

  // Get families for a specific user
  fastify.get("/user/:userId/families", async (request, reply) => {
    try {
      const { userId } = request.params as { userId: string };
      const families = await fastify.family.getUserFamilies(userId);
      return families;
    } catch (error) {
      fastify.log.error(error);
      reply.code(500).send({ error: "Failed to fetch user families" });
    }
  });

  // Get family by ID
  fastify.get("/family/:id", async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const family = await fastify.family.getById(id);

      if (!family) {
        return reply.code(404).send({ error: "Family not found" });
      }

      return family;
    } catch (error) {
      fastify.log.error(error);
      reply.code(500).send({ error: "Failed to fetch family" });
    }
  });

  // Get family members
  fastify.get("/family/:id/members", async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const members = await fastify.family.getMembers(id);
      return members;
    } catch (error) {
      fastify.log.error(error);
      reply.code(500).send({ error: "Failed to fetch family members" });
    }
  });

  // Create a new family
  fastify.post("/family", async (request, reply) => {
    try {
      const familyData = request.body as FamilyInput & { owner_id: string };
      const { owner_id, ...familyInput } = familyData;

      if (!owner_id) {
        return reply.code(400).send({ error: "owner_id is required" });
      }

      if (!familyInput.name || familyInput.name.trim().length === 0) {
        return reply.code(400).send({ error: "Family name is required" });
      }

      const family = await fastify.family.create(familyInput, owner_id);
      reply.code(201).send(family);
    } catch (error) {
      fastify.log.error(error);
      reply.code(500).send({
        error:
          error instanceof Error ? error.message : "Failed to create family",
      });
    }
  });

  // Update family
  fastify.put("/family/:id", async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const updateData = request.body as FamilyUpdate;

      const family = await fastify.family.update(id, updateData);

      if (!family) {
        return reply.code(404).send({ error: "Family not found" });
      }

      return family;
    } catch (error) {
      fastify.log.error(error);
      reply.code(500).send({
        error:
          error instanceof Error ? error.message : "Failed to update family",
      });
    }
  });

  // Delete family
  fastify.delete("/family/:id", async (request, reply) => {
    try {
      const { id } = request.params as { id: string };

      await fastify.family.delete(id);
      reply.code(204).send();
    } catch (error) {
      fastify.log.error(error);
      reply.code(500).send({
        error:
          error instanceof Error ? error.message : "Failed to delete family",
      });
    }
  });

  // Add member to family
  fastify.post("/family/:id/members", async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const { user_id } = request.body as { user_id: string };

      if (!user_id) {
        return reply.code(400).send({ error: "user_id is required" });
      }

      await fastify.family.addMember(id, user_id);
      reply.code(200).send({ message: "Member added successfully" });
    } catch (error) {
      fastify.log.error(error);
      reply.code(500).send({
        error: error instanceof Error ? error.message : "Failed to add member",
      });
    }
  });

  // Remove member from family
  fastify.delete("/family/:id/members/:userId", async (request, reply) => {
    try {
      const { id, userId } = request.params as { id: string; userId: string };

      await fastify.family.removeMember(id, userId);
      reply.code(200).send({ message: "Member removed successfully" });
    } catch (error) {
      fastify.log.error(error);
      reply.code(500).send({
        error:
          error instanceof Error ? error.message : "Failed to remove member",
      });
    }
  });
};

export default familyRoutes;

import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { UserInput, UserUpdate, LoginInput } from "../types/user.types";

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
          return reply.status(409).send({ error: error.message });
        }
        return reply.status(500).send({ error: "Failed to create user" });
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
        return reply.status(500).send({ error: "Failed to fetch users" });
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
        const user = await fastify.user.getById(request.params.id);
        if (!user) {
          return reply.status(404).send({ error: "User not found" });
        }
        return reply.send(user);
      } catch (error) {
        fastify.log.error(error);
        return reply.status(500).send({ error: "Failed to fetch user" });
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
        const user = await fastify.user.getByEmail(request.params.email);
        if (!user) {
          return reply.status(404).send({ error: "User not found" });
        }
        return reply.send(user);
      } catch (error) {
        fastify.log.error(error);
        return reply.status(500).send({ error: "Failed to fetch user" });
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
        const user = await fastify.user.update(request.params.id, request.body);
        if (!user) {
          return reply.status(404).send({ error: "User not found" });
        }
        return reply.send(user);
      } catch (error) {
        fastify.log.error(error);
        if (
          error instanceof Error &&
          error.message.includes("already exists")
        ) {
          return reply.status(409).send({ error: error.message });
        }
        return reply.status(500).send({ error: "Failed to update user" });
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
        await fastify.user.delete(request.params.id);
        return reply.status(204).send();
      } catch (error) {
        fastify.log.error(error);
        if (error instanceof Error && error.message.includes("not found")) {
          return reply.status(404).send({ error: error.message });
        }
        return reply.status(500).send({ error: "Failed to delete user" });
      }
    }
  );

  // Login endpoint
  fastify.post<{ Body: LoginInput }>(
    "/login",
    async (
      request: FastifyRequest<{ Body: LoginInput }>,
      reply: FastifyReply
    ) => {
      try {
        const { email, password } = request.body;

        // Find user by email
        const user = await fastify.user.getByEmail(email);

        if (!user) {
          return reply.status(401).send({ error: "Invalid credentials" });
        }

        const isValid = await fastify.user.validatePassword(user, password);
        if (!isValid) {
          return reply.status(401).send({ error: "Invalid credentials" });
        }

        // Remove password from response
        const { password_hash: _, ...userPublic } = user;
        return reply.send({
          message: "Login successful",
          user: userPublic,
        });
      } catch (error) {
        fastify.log.error(error);
        return reply.status(500).send({ error: "Login failed" });
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
          return reply.status(404).send({ error: error.message });
        }
        return reply
          .status(500)
          .send({ error: "Failed to add user to family" });
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
          return reply.status(404).send({ error: error.message });
        }
        return reply
          .status(500)
          .send({ error: "Failed to remove user from family" });
      }
    }
  );
}

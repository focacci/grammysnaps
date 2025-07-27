import { FastifyPluginAsync, FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import { Tag } from "../types/tag.types";

export interface TagInput {
  type: "Person" | "Location" | "Event" | "Time";
  name: string;
  family_id: string;
}

declare module "fastify" {
  interface FastifyInstance {
    tag: {
      create: (input: TagInput) => Promise<Tag>;
      get: () => Promise<Tag[]>;
      getByFamily: (familyId: string) => Promise<Tag[]>;
      getById: (id: string) => Promise<Tag | null>;
      update: (id: string, input: TagInput) => Promise<Tag | null>;
      delete: (id: string) => Promise<void>;
    };
  }
}

const tagPlugin: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  if (!fastify.pg) {
    throw new Error("fastify-postgres must be registered before this plugin");
  }

  fastify.decorate("tag", {
    async create(input: TagInput): Promise<Tag> {
      const { type, name, family_id } = input;
      try {
        const { rows } = await fastify.pg.query<Tag>(
          "INSERT INTO tags (type, name, family_id) VALUES ($1, $2, $3) RETURNING *",
          [type, name, family_id]
        );
        return rows[0];
      } catch (err) {
        fastify.log.error(err);
        throw new Error("Failed to create tag");
      }
    },

    async get(): Promise<Tag[]> {
      try {
        const { rows } = await fastify.pg.query<Tag>("SELECT * FROM tags");
        return rows;
      } catch (err) {
        fastify.log.error(err);
        throw new Error("Failed to fetch tags");
      }
    },

    async getByFamily(familyId: string): Promise<Tag[]> {
      try {
        const { rows } = await fastify.pg.query<Tag>(
          "SELECT * FROM tags WHERE family_id = $1",
          [familyId]
        );
        return rows;
      } catch (err) {
        fastify.log.error(err);
        throw new Error("Failed to fetch tags by family");
      }
    },

    async getById(id: string): Promise<Tag | null> {
      try {
        const {
          rows: [tag],
        } = await fastify.pg.query<Tag>("SELECT * FROM tags WHERE id = $1", [
          id,
        ]);
        return tag || null;
      } catch (err) {
        fastify.log.error(err);
        throw new Error("Failed to fetch tag by ID");
      }
    },

    async update(id: string, input: TagInput): Promise<Tag | null> {
      try {
        const {
          rows: [tag],
        } = await fastify.pg.query<Tag>(
          "UPDATE tags SET type = $1, name = $2, family_id = $3, updated_at = NOW() WHERE id = $4 RETURNING *",
          [input.type, input.name, input.family_id, id]
        );
        return tag || null;
      } catch (err) {
        fastify.log.error(err);
        throw new Error("Failed to update tag");
      }
    },

    async delete(id: string): Promise<void> {
      try {
        // Remove the tag from the tags array in all images that have it
        await fastify.pg.query(
          "UPDATE images SET tags = array_remove(tags, $1), updated_at = NOW() WHERE $1 = ANY(tags)",
          [id]
        );

        // Delete the tag from the tags table (CASCADE will handle image_tags)
        await fastify.pg.query("DELETE FROM tags WHERE id = $1", [id]);
      } catch (err) {
        fastify.log.error(err);
        throw new Error("Failed to delete tag");
      }
    },
  });
};

export default fp(tagPlugin, {
  name: "tag",
  dependencies: ["@fastify/postgres"],
});

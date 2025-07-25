import { FastifyPluginAsync, FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import { Tag } from "../types/tag.types";

export interface TagInput {
  type: "Person" | "Location" | "Event" | "Time";
  name: string;
}

declare module "fastify" {
  interface FastifyInstance {
    tag: {
      create: (input: TagInput) => Promise<Tag>;
      get: () => Promise<Tag[]>;
      getById: (id: string) => Promise<Tag | null>;
      update: (id: string, input: TagInput) => Promise<Tag | null>;
      // delete: (id: number) => Promise<boolean>
    };
  }
}

const tagPlugin: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  if (!fastify.pg) {
    throw new Error("fastify-postgres must be registered before this plugin");
  }

  fastify.decorate("tag", {
    async create(input: TagInput): Promise<Tag> {
      const { type, name } = input;
      try {
        const { rows } = await fastify.pg.query<Tag>(
          "INSERT INTO tags (type, name) VALUES ($1, $2) RETURNING *",
          [type, name]
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
          "UPDATE tags SET type = $1, name = $2, updated_at = NOW() WHERE id = $3 RETURNING *",
          [input.type, input.name, id]
        );
        return tag || null;
      } catch (err) {
        fastify.log.error(err);
        throw new Error("Failed to update tag");
      }
    },

    // async delete(id: number): Promise<boolean> {}
  });
};

export default fp(tagPlugin, {
  name: "tag",
  dependencies: ["@fastify/postgres"],
});

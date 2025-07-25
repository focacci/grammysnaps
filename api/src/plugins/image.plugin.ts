import { FastifyPluginAsync, FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import { Image } from "../types/image.types";
import { ImageInput } from "../types/image.types";

declare module "fastify" {
  interface FastifyInstance {
    image: {
      create: (input: ImageInput) => Promise<Image>;
      get: () => Promise<Image[]>;
      getById: (id: string) => Promise<Image | null>;
      update: (id: string, input: ImageInput) => Promise<Image | null>;
      delete: (id: string) => Promise<void>;
      applyTags: (imageId: string, tags: string[]) => Promise<void>;
    };
  }
}

const imagePlugin: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  if (!fastify.pg) {
    throw new Error("fastify-postgres must be registered before this plugin");
  }

  fastify.decorate("image", {
    async create(input: ImageInput): Promise<Image> {
      const { filename, tags } = input;
      try {
        const {
          rows: [image],
        } = await fastify.pg.query<Image>(
          "INSERT INTO images (filename, tags) VALUES ($1, $2) RETURNING *",
          [filename, tags ?? []]
        );
        // if tags apply tag relations
        if (tags) await fastify.image.applyTags(image.id, tags);
        return image;
      } catch (err) {
        fastify.log.error(err);
        throw new Error("Failed to create image");
      }
    },

    async get(): Promise<Image[]> {
      try {
        const { rows } = await fastify.pg.query<Image>("SELECT * FROM images");
        return rows;
      } catch (err) {
        fastify.log.error(err);
        throw new Error("Failed to fetch images");
      }
    },

    async getById(id: string): Promise<Image | null> {
      try {
        const {
          rows: [image],
        } = await fastify.pg.query<Image>(
          "SELECT * FROM images WHERE id = $1",
          [id]
        );
        return image || null;
      } catch (err) {
        fastify.log.error(err);
        throw new Error("Failed to fetch image by ID");
      }
    },

    async update(id: string, input: ImageInput): Promise<Image | null> {
      const { filename, tags } = input;
      try {
        const {
          rows: [image],
        } = await fastify.pg.query<Image>(
          "UPDATE images SET filename = $1, tags = $2, updated_at = NOW() WHERE id = $3 RETURNING *",
          [filename, tags ?? [], id]
        );
        if (tags) {
          await fastify.pg.query("DELETE FROM image_tags WHERE image_id = $1", [
            id,
          ]);
          if (tags.length > 0) {
            await fastify.image.applyTags(id, tags);
          }
        }
        return image;
      } catch (err) {
        fastify.log.error(err);
        throw new Error("Failed to update image");
      }
    },

    async delete(id: string): Promise<void> {
      try {
        await fastify.pg.query("DELETE FROM images WHERE id = $1", [id]);
      } catch (err) {
        fastify.log.error(err);
        throw new Error("Failed to delete image");
      }
    },

    /** Utilities */

    async applyTags(imageId: string, tags: string[]): Promise<void> {
      try {
        for (const tagId of tags) {
          fastify.pg.query(
            "INSERT INTO image_tags (image_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
            [imageId, tagId]
          );
        }
      } catch (err) {
        fastify.log.error(err);
        throw new Error("Failed to add tag to image");
      }
    },
  });
};

export default fp(imagePlugin, {
  name: "image",
  dependencies: ["@fastify/postgres"],
});

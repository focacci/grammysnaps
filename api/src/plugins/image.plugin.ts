import { FastifyPluginAsync, FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import { Image } from "../types/image.types";
import { ImageInput } from "../types/image.types";

declare module "fastify" {
  interface FastifyInstance {
    image: {
      create: (input: ImageInput) => Promise<Image>;
      get: () => Promise<Image[]>;
      applyTags: (imageId: string, tags: string[]) => Promise<void>;
      // getById: (id: number) => Promise<Image | null>
      // update: (id: number, input: ImageInput) => Promise<Image | null>
      // delete: (id: number) => Promise<boolean>
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

    // async getById(id: number): Promise<Image | null> {},

    // async update(id: number, input: ImageInput): Promise<Image | null> {},

    // async delete(id: number): Promise<boolean> {}
  });
};

export default fp(imagePlugin, {
  name: "image",
  dependencies: ["@fastify/postgres"],
});

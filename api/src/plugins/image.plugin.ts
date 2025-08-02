import { FastifyPluginAsync, FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import { Image, ImageInput } from "../types/image.types";

declare module "fastify" {
  interface FastifyInstance {
    image: {
      create: (input: ImageInput) => Promise<Image>;
      get: () => Promise<Image[]>;
      getById: (id: string) => Promise<Image | null>;
      update: (id: string, input: ImageInput) => Promise<Image | null>;
      delete: (id: string) => Promise<void>;
      applyTags: (imageId: string, tags: string[]) => Promise<void>;
      applyFamilies: (imageId: string, familyIds: string[]) => Promise<void>;
      getAllWithTag: (tagId: string) => Promise<Image[]>;
      getByFamily: (familyId: string) => Promise<Image[]>;
      getByFamilies: (familyIds: string[]) => Promise<Image[]>;
      getOrphanedByFamily: (familyId: string) => Promise<Image[]>;
    };
  }
}

const imagePlugin: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  if (!fastify.pg) {
    throw new Error("fastify-postgres must be registered before this plugin");
  }

  fastify.decorate("image", {
    async create(input: ImageInput): Promise<Image> {
      const { title, filename, tags, family_ids, s3Url } = input;

      if (!family_ids || family_ids.length === 0) {
        throw new Error(
          "At least one family must be associated with the image"
        );
      }

      try {
        const {
          rows: [image],
        } = await fastify.pg.query<Image>(
          "INSERT INTO images (title, filename, tags, family_ids, s3_url) VALUES ($1, $2, $3, $4, $5) RETURNING *",
          [title ?? null, filename, tags ?? [], family_ids, s3Url ?? null]
        );

        // Apply tag relations
        if (tags && tags.length > 0) {
          await fastify.image.applyTags(image.id, tags);
        }

        // Apply family relations
        await fastify.image.applyFamilies(image.id, family_ids);

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
      const { title, tags, family_ids } = input;

      // Validate family_ids if provided
      if (family_ids !== undefined && family_ids.length === 0) {
        throw new Error("Image must belong to at least one family");
      }

      try {
        const {
          rows: [image],
        } = await fastify.pg.query<Image>(
          "UPDATE images SET title = $1, tags = $2, family_ids = $3, updated_at = NOW() WHERE id = $4 RETURNING *",
          [title ?? null, tags ?? [], family_ids ?? [], id]
        );

        // Update tag relations
        if (tags) {
          await fastify.pg.query("DELETE FROM image_tags WHERE image_id = $1", [
            id,
          ]);
          if (tags.length > 0) {
            await fastify.image.applyTags(id, tags);
          }
        }

        // Update family relations
        if (family_ids) {
          await fastify.image.applyFamilies(id, family_ids);
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
          await fastify.pg.query(
            "INSERT INTO image_tags (image_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
            [imageId, tagId]
          );
        }
      } catch (err) {
        fastify.log.error(err);
        throw new Error("Failed to add tag to image");
      }
    },

    async applyFamilies(imageId: string, familyIds: string[]): Promise<void> {
      try {
        // First, remove existing family associations
        await fastify.pg.query(
          "DELETE FROM image_families WHERE image_id = $1",
          [imageId]
        );

        // Then add new family associations
        if (familyIds.length > 0) {
          const values = familyIds
            .map((_, index) => `($1, $${index + 2})`)
            .join(", ");
          const query = `INSERT INTO image_families (image_id, family_id) VALUES ${values}`;
          await fastify.pg.query(query, [imageId, ...familyIds]);
        }
      } catch (err) {
        fastify.log.error(err);
        throw new Error("Failed to apply family associations");
      }
    },

    async getAllWithTag(tagId: string): Promise<Image[]> {
      try {
        const { rows } = await fastify.pg.query<Image>(
          "SELECT i.* FROM images i INNER JOIN image_tags it ON i.id = it.image_id WHERE it.tag_id = $1",
          [tagId]
        );
        return rows;
      } catch (err) {
        fastify.log.error(err);
        throw new Error("Failed to get all images with tag");
      }
    },

    async getByFamily(familyId: string): Promise<Image[]> {
      try {
        const { rows } = await fastify.pg.query<Image>(
          `SELECT i.* FROM images i 
           JOIN image_families if ON i.id = if.image_id 
           WHERE if.family_id = $1`,
          [familyId]
        );
        return rows;
      } catch (err) {
        fastify.log.error(err);
        throw new Error("Failed to get images by family");
      }
    },

    async getByFamilies(familyIds: string[]): Promise<Image[]> {
      try {
        if (familyIds.length === 0) {
          return [];
        }

        // Create placeholders for the IN clause
        const placeholders = familyIds
          .map((_, index) => `$${index + 1}`)
          .join(", ");

        const { rows } = await fastify.pg.query<Image>(
          `SELECT DISTINCT i.* FROM images i 
           JOIN image_families if ON i.id = if.image_id 
           WHERE if.family_id IN (${placeholders})
           ORDER BY i.created_at DESC`,
          familyIds
        );
        return rows;
      } catch (err) {
        fastify.log.error(err);
        throw new Error("Failed to get images by families");
      }
    },

    async getOrphanedByFamily(familyId: string): Promise<Image[]> {
      try {
        const { rows } = await fastify.pg.query<Image>(
          `SELECT i.* FROM images i 
           JOIN image_families if ON i.id = if.image_id 
           WHERE if.family_id = $1 
           AND i.id NOT IN (
             SELECT DISTINCT if2.image_id 
             FROM image_families if2 
             WHERE if2.family_id != $1
           )`,
          [familyId]
        );
        return rows;
      } catch (err) {
        fastify.log.error(err);
        throw new Error("Failed to get orphaned images by family");
      }
    },
  });
};

export default fp(imagePlugin, {
  name: "image",
  // dependencies: ["@fastify/postgres"],
});

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
      applyCollections: (imageId: string, collectionIds: string[]) => Promise<void>;
      getAllWithTag: (tagId: string) => Promise<Image[]>;
      getByCollection: (collectionId: string) => Promise<Image[]>;
      getByCollections: (collectionIds: string[]) => Promise<Image[]>;
      getOrphanedByCollection: (collectionId: string) => Promise<Image[]>;
      getForUser: (
        userId: string,
        tags: string[],
        limit: number,
        offset: number,
        order: "asc" | "desc"
      ) => Promise<Image[]>;
    };
  }
}

const imagePlugin: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  if (!fastify.pg) {
    throw new Error("fastify-postgres must be registered before this plugin");
  }

  fastify.decorate("image", {
    async create(input: ImageInput): Promise<Image> {
      const { title, filename, tags, collection_ids, original_key, thumbnail_key } =
        input;

      if (!collection_ids || collection_ids.length === 0) {
        throw new Error(
          "At least one collection must be associated with the image"
        );
      }

      try {
        const {
          rows: [image],
        } = await fastify.pg.query<Image>(
          "INSERT INTO images (title, filename, tags, collection_ids, original_key, thumbnail_key) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *",
          [
            title ?? null,
            filename,
            tags ?? [],
            collection_ids,
            original_key ?? null,
            thumbnail_key ?? null,
          ]
        );

        // Apply tag relations
        if (tags && tags.length > 0) {
          await fastify.image.applyTags(image.id, tags);
        }

        // Apply collection relations
        await fastify.image.applyCollections(image.id, collection_ids);

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
      const { title, tags, collection_ids, original_key, thumbnail_key } = input;

      // Validate collection_ids if provided
      if (collection_ids !== undefined && collection_ids.length === 0) {
        throw new Error("Image must belong to at least one collection");
      }

      try {
        const {
          rows: [image],
        } = await fastify.pg.query<Image>(
          "UPDATE images SET title = $1, tags = $2, collection_ids = $3, original_key = $4, thumbnail_key = $5, updated_at = NOW() WHERE id = $6 RETURNING *",
          [
            title ?? null,
            tags ?? [],
            collection_ids ?? [],
            original_key ?? null,
            thumbnail_key ?? null,
            id,
          ]
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

        // Update collection relations
        if (collection_ids) {
          await fastify.image.applyCollections(id, collection_ids);
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

    async applyCollections(imageId: string, collectionIds: string[]): Promise<void> {
      try {
        // First, remove existing collection associations
        await fastify.pg.query(
          "DELETE FROM image_collections WHERE image_id = $1",
          [imageId]
        );

        // Then add new collection associations
        if (collectionIds.length > 0) {
          const values = collectionIds
            .map((_, index) => `($1, $${index + 2})`)
            .join(", ");
          const query = `INSERT INTO image_collections (image_id, collection_id) VALUES ${values}`;
          await fastify.pg.query(query, [imageId, ...collectionIds]);
        }
      } catch (err) {
        fastify.log.error(err);
        throw new Error("Failed to apply collection associations");
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

    async getByCollection(collectionId: string): Promise<Image[]> {
      try {
        const { rows } = await fastify.pg.query<Image>(
          `SELECT i.* FROM images i
           JOIN image_collections ic ON i.id = ic.image_id
           WHERE ic.collection_id = $1`,
          [collectionId]
        );
        return rows;
      } catch (err) {
        fastify.log.error(err);
        throw new Error("Failed to get images by collection");
      }
    },

    async getByCollections(collectionIds: string[]): Promise<Image[]> {
      try {
        if (collectionIds.length === 0) {
          return [];
        }

        // Create placeholders for the IN clause
        const placeholders = collectionIds
          .map((_, index) => `$${index + 1}`)
          .join(", ");

        const { rows } = await fastify.pg.query<Image>(
          `SELECT DISTINCT i.* FROM images i 
           JOIN image_collections ic ON i.id = ic.image_id 
           WHERE ic.collection_id IN (${placeholders})
           ORDER BY i.created_at DESC`,
          collectionIds
        );
        return rows;
      } catch (err) {
        fastify.log.error(err);
        throw new Error("Failed to get images by collections");
      }
    },

    async getOrphanedByCollection(collectionId: string): Promise<Image[]> {
      try {
        const { rows } = await fastify.pg.query<Image>(
          `SELECT i.* FROM images i 
           JOIN image_collections ic ON i.id = ic.image_id 
           WHERE ic.collection_id = $1 
           AND i.id NOT IN (
             SELECT DISTINCT ic2.image_id 
             FROM image_collections ic2 
             WHERE ic2.collection_id != $1
           )`,
          [collectionId]
        );
        return rows;
      } catch (err) {
        fastify.log.error(err);
        throw new Error("Failed to get orphaned images by collection");
      }
    },

    async getForUser(
      userId: string,
      tags: string[],
      limit: number,
      offset: number,
      order: "asc" | "desc"
    ): Promise<Image[]> {
      try {
        // Build the query dynamically based on whether tags are provided
        let query = `
          SELECT DISTINCT i.* FROM images i 
          JOIN image_collections ic ON i.id = ic.image_id 
          JOIN collection_members cm ON ic.collection_id = cm.collection_id 
          WHERE cm.user_id = $1
        `;

        const params: (string | number)[] = [userId];
        let paramCount = 1;

        // Add tag filtering if tags are provided
        if (tags && tags.length > 0) {
          query += ` AND i.id IN (
            SELECT it.image_id FROM image_tags it 
            WHERE it.tag_id IN (${tags
              .map(() => `$${++paramCount}`)
              .join(", ")})
          )`;
          params.push(...tags);
        }

        // Add ordering
        query += ` ORDER BY i.created_at ${order.toUpperCase()}`;

        // Add pagination
        query += ` LIMIT $${++paramCount} OFFSET $${++paramCount}`;
        params.push(limit, offset);

        const { rows } = await fastify.pg.query<Image>(query, params);
        return rows;
      } catch (err) {
        fastify.log.error(err);
        throw new Error("Failed to get images for user");
      }
    },
  });
};

export default fp(imagePlugin, {
  name: "image",
  // dependencies: ["@fastify/postgres"],
});

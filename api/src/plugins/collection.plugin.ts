import { FastifyPluginAsync, FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import {
  Collection,
  CollectionInput,
  CollectionUpdate,
  CollectionPublic,
  CollectionMember,
  RelatedCollection,
} from "../types/collection.types";
import { UUID } from "crypto";

declare module "fastify" {
  interface FastifyInstance {
    collection: {
      create: (input: CollectionInput, ownerId: UUID) => Promise<CollectionPublic>;
      get: () => Promise<CollectionPublic[]>;
      getById: (id: UUID) => Promise<Collection | null>;
      exists: (id: UUID) => Promise<boolean>;
      getUserCollections: (userId: UUID) => Promise<CollectionPublic[]>;
      getMembers: (collectionId: UUID) => Promise<CollectionMember[]>;
      getRelatedCollections: (collectionId: UUID) => Promise<RelatedCollection[]>;
      addRelatedCollection: (
        collectionId: UUID,
        relatedCollectionId: UUID
      ) => Promise<void>;
      removeRelatedCollection: (
        collectionId: UUID,
        relatedCollectionId: UUID
      ) => Promise<void>;
      update: (id: UUID, input: CollectionUpdate) => Promise<Collection | null>;
      delete: (id: UUID) => Promise<void>;
      addMember: (collectionId: UUID, userId: UUID) => Promise<void>;
      removeMember: (collectionId: UUID, userId: UUID) => Promise<void>;
    };
  }
}

const collectionPlugin: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  if (!fastify.pg) {
    throw new Error("fastify-postgres must be registered before this plugin");
  }

  // Helper function to convert Collection to CollectionPublic with user role
  const toPublicCollection = async (
    collection: Collection,
    userId: string
  ): Promise<CollectionPublic> => {
    const userRole = collection.owner_id === userId ? "owner" : "member";

    return {
      id: collection.id,
      name: collection.name,
      member_count: collection.members.length,
      owner_id: collection.owner_id,
      user_role: userRole,
      related_collections: collection.related_collections || [],
      created_at: collection.created_at,
      updated_at: collection.updated_at,
    };
  };

  fastify.decorate("collection", {
    async create(input: CollectionInput, ownerId: UUID): Promise<CollectionPublic> {
      const { name, related_collections } = input;

      try {
        // Create the collection
        const {
          rows: [collection],
        } = await fastify.pg.query<Collection>(
          "INSERT INTO collections (name, members, owner_id, related_collections) VALUES ($1, $2, $3, $4) RETURNING *",
          [name, [ownerId], ownerId, related_collections || []]
        );

        // Add the owner to the collection_members junction table
        await fastify.pg.query(
          "INSERT INTO collection_members (collection_id, user_id) VALUES ($1, $2)",
          [collection.id, ownerId]
        );

        // Add collection ID to user's collections array
        await fastify.user.addToCollection(ownerId, collection.id);

        fastify.log.info(`Created collection: ${collection.name} by user ${ownerId}`);
        return toPublicCollection(collection, ownerId);
      } catch (err) {
        fastify.log.error(err);
        if (err instanceof Error) {
          throw err;
        }
        throw new Error("Failed to create collection");
      }
    },

    async get(): Promise<CollectionPublic[]> {
      try {
        const { rows } = await fastify.pg.query<Collection>(
          "SELECT * FROM collections ORDER BY created_at DESC"
        );
        // Note: This returns collections without user context, so role will be "member" by default
        return Promise.all(
          rows.map((collection: Collection) => toPublicCollection(collection, ""))
        );
      } catch (err) {
        fastify.log.error(err);
        throw new Error("Failed to fetch collections");
      }
    },

    async getById(id: UUID): Promise<Collection | null> {
      try {
        const { rows } = await fastify.pg.query<Collection>(
          "SELECT * FROM collections WHERE id = $1",
          [id]
        );
        return rows.length > 0 ? rows[0] : null;
      } catch (err) {
        fastify.log.error(err);
        throw new Error("Failed to fetch collection by ID");
      }
    },

    async exists(id: UUID): Promise<boolean> {
      try {
        const { rows } = await fastify.pg.query(
          "SELECT 1 FROM collections WHERE id = $1 LIMIT 1",
          [id]
        );
        return rows.length > 0;
      } catch (err) {
        fastify.log.error(err);
        throw new Error("Failed to check if collection exists");
      }
    },

    async getUserCollections(userId: UUID): Promise<CollectionPublic[]> {
      try {
        const { rows } = await fastify.pg.query<Collection>(
          `SELECT f.* FROM collections f
           JOIN collection_members fm ON f.id = fm.collection_id
           WHERE fm.user_id = $1
           ORDER BY f.created_at DESC`,
          [userId]
        );
        return Promise.all(
          rows.map((collection: Collection) => toPublicCollection(collection, userId))
        );
      } catch (err) {
        fastify.log.error(err);
        throw new Error("Failed to fetch user collections");
      }
    },

    async getMembers(collectionId: UUID): Promise<CollectionMember[]> {
      try {
        interface MemberRow {
          id: UUID;
          email: string;
          password_hash: string;
          first_name: string | null;
          middle_name: string | null;
          last_name: string | null;
          birthday: Date | null;
          collections: UUID[];
          profile_picture_key: string | null;
          profile_picture_thumbnail_key: string | null;
          created_at: Date;
          updated_at: Date;
          owner_id: UUID;
          joined_at: Date;
        }

        const { rows } = await fastify.pg.query<MemberRow>(
          `SELECT u.id, u.email, u.password_hash, u.first_name, u.middle_name, u.last_name, 
                  u.birthday, u.collections, u.profile_picture_key, u.profile_picture_thumbnail_key, 
                  u.created_at, u.updated_at, f.owner_id, f.created_at as joined_at
           FROM users u
           JOIN collection_members fm ON u.id = fm.user_id
           JOIN collections f ON fm.collection_id = f.id
           WHERE fm.collection_id = $1
           ORDER BY u.first_name, u.last_name`,
          [collectionId]
        );

        return rows.map((row: MemberRow) => ({
          id: row.id,
          email: row.email,
          password_hash: row.password_hash,
          first_name: row.first_name,
          middle_name: row.middle_name,
          last_name: row.last_name,
          birthday: row.birthday
            ? new Date(row.birthday).toISOString().split("T")[0]
            : null,
          collections: row.collections,
          profile_picture_key: row.profile_picture_key,
          profile_picture_thumbnail_key: row.profile_picture_thumbnail_key,
          created_at: new Date(row.created_at).toISOString(),
          updated_at: new Date(row.updated_at).toISOString(),
          role: row.id === row.owner_id ? "owner" : "member",
          joined_at: new Date(row.joined_at).toISOString(),
        }));
      } catch (err) {
        fastify.log.error(err);
        throw new Error("Failed to fetch collection members");
      }
    },

    async update(id: UUID, input: CollectionUpdate): Promise<Collection | null> {
      const { name } = input;

      try {
        // Check if the collection exists
        const existingCollection = await fastify.collection.getById(id);
        if (!existingCollection) {
          return null;
        }

        // Build dynamic update query
        const updateFields: string[] = [];
        const values: (string | UUID)[] = [];
        let paramCount = 1;

        if (name !== undefined) {
          updateFields.push(`name = $${paramCount}`);
          values.push(name);
          paramCount++;
        }

        // Add updated_at timestamp
        updateFields.push(`updated_at = CURRENT_TIMESTAMP`);

        // Add ID parameter
        values.push(id);

        const query = `UPDATE collections SET ${updateFields.join(
          ", "
        )} WHERE id = $${paramCount} RETURNING *`;

        const {
          rows: [collection],
        } = await fastify.pg.query<Collection>(query, values);

        fastify.log.info(`Updated collection: ${collection.name}`);
        return collection;
      } catch (err) {
        fastify.log.error(err);
        if (err instanceof Error) {
          throw err;
        }
        throw new Error("Failed to update collection");
      }
    },

    async delete(id: UUID): Promise<void> {
      try {
        const collection = await fastify.collection.getById(id);
        if (!collection) {
          throw new Error("Collection not found");
        }

        // Find images that only belong to this collection and delete them
        const orphanedImages = await fastify.image.getOrphanedByCollection(id);

        // Delete orphaned images from S3 and database
        for (const image of orphanedImages) {
          try {
            // Delete from S3 if original_key exists
            if (image.original_key) {
              await fastify.s3.delete(image.original_key);
            }

            // Delete thumbnail from S3 if thumbnail_key exists
            if (image.thumbnail_key) {
              await fastify.s3.delete(image.thumbnail_key);
            }

            // Delete from database (will cascade delete image_tags and image_collections)
            await fastify.pg.query("DELETE FROM images WHERE id = $1", [
              image.id,
            ]);
            fastify.log.info(`Deleted orphaned image: ${image.id}`);
          } catch (imageErr) {
            fastify.log.error(`Failed to delete image ${image.id}:`, imageErr);
            // Continue with other images even if one fails
          }
        }

        fastify.log.info(
          `Deleted ${orphanedImages.length} orphaned images for collection: ${collection.name}`
        );

        // Remove collection from all users' collections arrays
        for (const memberId of collection.members) {
          await fastify.user.removeFromCollection(memberId, id);
        }

        // Delete collection (collection_members will be cascade deleted)
        await fastify.pg.query("DELETE FROM collections WHERE id = $1", [id]);
        fastify.log.info(`Deleted collection: ${collection.name}`);
      } catch (err) {
        fastify.log.error(err);
        if (err instanceof Error) {
          throw err;
        }
        throw new Error("Failed to delete collection");
      }
    },

    async addMember(collectionId: UUID, userId: UUID): Promise<void> {
      try {
        const collection = await fastify.collection.getById(collectionId);
        if (!collection) {
          throw new Error("Collection not found");
        }

        // Check if user is already a member
        if (collection.members.includes(userId)) {
          return; // Already a member
        }

        // Add to collection_members junction table
        await fastify.pg.query(
          "INSERT INTO collection_members (collection_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
          [collectionId, userId]
        );

        // Update collection members array
        const updatedMembers = [...collection.members, userId];
        await fastify.pg.query(
          "UPDATE collections SET members = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2",
          [updatedMembers, collectionId]
        );

        // Add collection to user's collections array
        await fastify.user.addToCollection(userId, collectionId);

        fastify.log.info(`Added user ${userId} to collection ${collectionId}`);
      } catch (err) {
        fastify.log.error(err);
        if (err instanceof Error) {
          throw err;
        }
        throw new Error("Failed to add member to collection");
      }
    },

    async removeMember(collectionId: UUID, userId: UUID): Promise<void> {
      try {
        const collection = await fastify.collection.getById(collectionId);
        if (!collection) {
          throw new Error("Collection not found");
        }

        // Cannot remove the owner
        if (collection.owner_id === userId) {
          throw new Error("Cannot remove collection owner");
        }

        // Remove from collection_members junction table
        await fastify.pg.query(
          "DELETE FROM collection_members WHERE collection_id = $1 AND user_id = $2",
          [collectionId, userId]
        );

        // Update collection members array
        const updatedMembers = collection.members.filter((id) => id !== userId);
        await fastify.pg.query(
          "UPDATE collections SET members = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2",
          [updatedMembers, collectionId]
        );

        // Remove collection from user's collections array
        await fastify.user.removeFromCollection(userId, collectionId);

        fastify.log.info(`Removed user ${userId} from collection ${collectionId}`);
      } catch (err) {
        fastify.log.error(err);
        if (err instanceof Error) {
          throw err;
        }
        throw new Error("Failed to remove member from collection");
      }
    },

    async getRelatedCollections(collectionId: UUID): Promise<RelatedCollection[]> {
      try {
        const { rows } = await fastify.pg.query<RelatedCollection>(
          `SELECT c.id, c.name, array_length(c.members, 1) as member_count, c.created_at
           FROM collections c
           JOIN collection_relations cr ON (c.id = cr.collection_id_1 OR c.id = cr.collection_id_2)
           WHERE (cr.collection_id_1 = $1 OR cr.collection_id_2 = $1) AND c.id != $1
           ORDER BY c.name`,
          [collectionId]
        );

        return rows;
      } catch (err) {
        fastify.log.error(err);
        throw new Error("Failed to fetch related collections");
      }
    },

    async addRelatedCollection(
      collectionId: UUID,
      relatedCollectionId: UUID
    ): Promise<void> {
      try {
        // Check if both collections exist
        const collection1 = await fastify.collection.getById(collectionId);
        const collection2 = await fastify.collection.getById(relatedCollectionId);

        if (!collection1) {
          throw new Error("Source collection not found");
        }
        if (!collection2) {
          throw new Error("Target collection not found");
        }

        if (collectionId === relatedCollectionId) {
          throw new Error("Cannot relate collection to itself");
        }

        // Check if relation already exists
        const { rows: existing } = await fastify.pg.query(
          `SELECT 1 FROM collection_relations
           WHERE (collection_id_1 = $1 AND collection_id_2 = $2) 
              OR (collection_id_1 = $2 AND collection_id_2 = $1)`,
          [collectionId, relatedCollectionId]
        );

        if (existing.length > 0) {
          throw new Error("Collections are already related");
        }

        // Add bidirectional relation in collection_relations table
        await fastify.pg.query(
          "INSERT INTO collection_relations (collection_id_1, collection_id_2) VALUES ($1, $2)",
          [collectionId, relatedCollectionId]
        );

        // Update both collections' related_collections arrays
        const collection1Relations = collection1.related_collections || [];
        const collection2Relations = collection2.related_collections || [];

        if (!collection1Relations.includes(relatedCollectionId)) {
          collection1Relations.push(relatedCollectionId);
          await fastify.pg.query(
            "UPDATE collections SET related_collections = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2",
            [collection1Relations, collectionId]
          );
        }

        if (!collection2Relations.includes(collectionId)) {
          collection2Relations.push(collectionId);
          await fastify.pg.query(
            "UPDATE collections SET related_collections = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2",
            [collection2Relations, relatedCollectionId]
          );
        }

        fastify.log.info(
          `Added relation between collections ${collectionId} and ${relatedCollectionId}`
        );
      } catch (err) {
        fastify.log.error(err);
        if (err instanceof Error) {
          throw err;
        }
        throw new Error("Failed to add collection relation");
      }
    },

    async removeRelatedCollection(
      collectionId: string,
      relatedCollectionId: string
    ): Promise<void> {
      try {
        // Remove from collection_relations table
        await fastify.pg.query(
          `DELETE FROM collection_relations
           WHERE (collection_id_1 = $1 AND collection_id_2 = $2)
              OR (collection_id_1 = $2 AND collection_id_2 = $1)`,
          [collectionId, relatedCollectionId]
        );

        // Update both collections' related_collections arrays
        const collection1 = await fastify.collection.getById(collectionId as UUID);
        const collection2 = await fastify.collection.getById(relatedCollectionId as UUID);

        if (collection1 && collection1.related_collections) {
          const updatedRelations1 = collection1.related_collections.filter(
            (id) => id !== relatedCollectionId
          );
          await fastify.pg.query(
            "UPDATE collections SET related_collections = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2",
            [updatedRelations1, collectionId]
          );
        }

        if (collection2 && collection2.related_collections) {
          const updatedRelations2 = collection2.related_collections.filter(
            (id) => id !== collectionId
          );
          await fastify.pg.query(
            "UPDATE collections SET related_collections = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2",
            [updatedRelations2, relatedCollectionId]
          );
        }

        fastify.log.info(
          `Removed relation between collections ${collectionId} and ${relatedCollectionId}`
        );
      } catch (err) {
        fastify.log.error(err);
        if (err instanceof Error) {
          throw err;
        }
        throw new Error("Failed to remove collection relation");
      }
    },
  });
};

export default fp(collectionPlugin, { name: "collection" });

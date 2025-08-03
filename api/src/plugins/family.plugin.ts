import { FastifyPluginAsync, FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import {
  Family,
  FamilyInput,
  FamilyUpdate,
  FamilyPublic,
  FamilyMember,
  RelatedFamily,
} from "../types/family.types";

declare module "fastify" {
  interface FastifyInstance {
    family: {
      create: (input: FamilyInput, ownerId: string) => Promise<FamilyPublic>;
      get: () => Promise<FamilyPublic[]>;
      getById: (id: string) => Promise<Family | null>;
      exists: (id: string) => Promise<boolean>;
      getUserFamilies: (userId: string) => Promise<FamilyPublic[]>;
      getMembers: (familyId: string) => Promise<FamilyMember[]>;
      getRelatedFamilies: (familyId: string) => Promise<RelatedFamily[]>;
      addRelatedFamily: (
        familyId: string,
        relatedFamilyId: string
      ) => Promise<void>;
      removeRelatedFamily: (
        familyId: string,
        relatedFamilyId: string
      ) => Promise<void>;
      update: (id: string, input: FamilyUpdate) => Promise<Family | null>;
      delete: (id: string) => Promise<void>;
      addMember: (familyId: string, userId: string) => Promise<void>;
      removeMember: (familyId: string, userId: string) => Promise<void>;
    };
  }
}

const familyPlugin: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  if (!fastify.pg) {
    throw new Error("fastify-postgres must be registered before this plugin");
  }

  // Helper function to convert Family to FamilyPublic with user role
  const toPublicFamily = async (
    family: Family,
    userId: string
  ): Promise<FamilyPublic> => {
    const userRole = family.owner_id === userId ? "owner" : "member";

    return {
      id: family.id,
      name: family.name,
      member_count: family.members.length,
      owner_id: family.owner_id,
      user_role: userRole,
      related_families: family.related_families || [],
      created_at: family.created_at,
      updated_at: family.updated_at,
    };
  };

  fastify.decorate("family", {
    async create(input: FamilyInput, ownerId: string): Promise<FamilyPublic> {
      const { name, related_families } = input;

      try {
        // Create the family
        const {
          rows: [family],
        } = await fastify.pg.query<Family>(
          "INSERT INTO families (name, members, owner_id, related_families) VALUES ($1, $2, $3, $4) RETURNING *",
          [name, [ownerId], ownerId, related_families || []]
        );

        // Add the owner to the family_members junction table
        await fastify.pg.query(
          "INSERT INTO family_members (family_id, user_id) VALUES ($1, $2)",
          [family.id, ownerId]
        );

        // Add family ID to user's families array
        await fastify.user.addToFamily(ownerId, family.id);

        fastify.log.info(`Created family: ${family.name} by user ${ownerId}`);
        return toPublicFamily(family, ownerId);
      } catch (err) {
        fastify.log.error(err);
        if (err instanceof Error) {
          throw err;
        }
        throw new Error("Failed to create family");
      }
    },

    async get(): Promise<FamilyPublic[]> {
      try {
        const { rows } = await fastify.pg.query<Family>(
          "SELECT * FROM families ORDER BY created_at DESC"
        );
        // Note: This returns families without user context, so role will be "member" by default
        return Promise.all(
          rows.map((family: Family) => toPublicFamily(family, ""))
        );
      } catch (err) {
        fastify.log.error(err);
        throw new Error("Failed to fetch families");
      }
    },

    async getById(id: string): Promise<Family | null> {
      try {
        const { rows } = await fastify.pg.query<Family>(
          "SELECT * FROM families WHERE id = $1",
          [id]
        );
        return rows.length > 0 ? rows[0] : null;
      } catch (err) {
        fastify.log.error(err);
        throw new Error("Failed to fetch family by ID");
      }
    },

    async exists(id: string): Promise<boolean> {
      try {
        const { rows } = await fastify.pg.query(
          "SELECT 1 FROM families WHERE id = $1 LIMIT 1",
          [id]
        );
        return rows.length > 0;
      } catch (err) {
        fastify.log.error(err);
        throw new Error("Failed to check if family exists");
      }
    },

    async getUserFamilies(userId: string): Promise<FamilyPublic[]> {
      try {
        const { rows } = await fastify.pg.query<Family>(
          `SELECT f.* FROM families f 
           JOIN family_members fm ON f.id = fm.family_id 
           WHERE fm.user_id = $1 
           ORDER BY f.created_at DESC`,
          [userId]
        );
        return Promise.all(
          rows.map((family: Family) => toPublicFamily(family, userId))
        );
      } catch (err) {
        fastify.log.error(err);
        throw new Error("Failed to fetch user families");
      }
    },

    async getMembers(familyId: string): Promise<FamilyMember[]> {
      try {
        const { rows } = await fastify.pg.query<any>(
          `SELECT u.id, u.first_name, u.last_name, u.email, u.birthday, f.owner_id,
                  f.created_at as joined_at
           FROM users u
           JOIN family_members fm ON u.id = fm.user_id
           JOIN families f ON fm.family_id = f.id
           WHERE fm.family_id = $1
           ORDER BY u.first_name, u.last_name`,
          [familyId]
        );

        return rows.map((row: any) => ({
          id: row.id,
          first_name: row.first_name,
          last_name: row.last_name,
          email: row.email,
          birthday: row.birthday
            ? new Date(row.birthday).toISOString().split("T")[0]
            : undefined,
          role: row.id === row.owner_id ? "owner" : "member",
          joined_at: row.joined_at,
        }));
      } catch (err) {
        fastify.log.error(err);
        throw new Error("Failed to fetch family members");
      }
    },

    async update(id: string, input: FamilyUpdate): Promise<Family | null> {
      const { name } = input;

      try {
        // Check if the family exists
        const existingFamily = await fastify.family.getById(id);
        if (!existingFamily) {
          return null;
        }

        // Build dynamic update query
        const updateFields: string[] = [];
        const values: any[] = [];
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

        const query = `UPDATE families SET ${updateFields.join(
          ", "
        )} WHERE id = $${paramCount} RETURNING *`;

        const {
          rows: [family],
        } = await fastify.pg.query<Family>(query, values);

        fastify.log.info(`Updated family: ${family.name}`);
        return family;
      } catch (err) {
        fastify.log.error(err);
        if (err instanceof Error) {
          throw err;
        }
        throw new Error("Failed to update family");
      }
    },

    async delete(id: string): Promise<void> {
      try {
        const family = await fastify.family.getById(id);
        if (!family) {
          throw new Error("Family not found");
        }

        // Find images that only belong to this family and delete them
        const orphanedImages = await fastify.image.getOrphanedByFamily(id);

        // Delete orphaned images from S3 and database
        for (const image of orphanedImages) {
          try {
            // Delete from S3 if original_url exists
            if (image.original_url) {
              // Extract S3 key from the public URL
              const url = new URL(image.original_url);
              const s3Key = url.pathname.substring(1); // Remove leading slash
              await fastify.s3.delete(s3Key);
            }

            // Delete thumbnail from S3 if thumbnail_url exists
            if (image.thumbnail_url) {
              // Extract S3 key from the public URL
              const thumbnailUrl = new URL(image.thumbnail_url);
              const thumbnailS3Key = thumbnailUrl.pathname.substring(1); // Remove leading slash
              await fastify.s3.delete(thumbnailS3Key);
            }

            // Delete from database (will cascade delete image_tags and image_families)
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
          `Deleted ${orphanedImages.length} orphaned images for family: ${family.name}`
        );

        // Remove family from all users' families arrays
        for (const memberId of family.members) {
          await fastify.user.removeFromFamily(memberId, id);
        }

        // Delete family (family_members will be cascade deleted)
        await fastify.pg.query("DELETE FROM families WHERE id = $1", [id]);
        fastify.log.info(`Deleted family: ${family.name}`);
      } catch (err) {
        fastify.log.error(err);
        if (err instanceof Error) {
          throw err;
        }
        throw new Error("Failed to delete family");
      }
    },

    async addMember(familyId: string, userId: string): Promise<void> {
      try {
        const family = await fastify.family.getById(familyId);
        if (!family) {
          throw new Error("Family not found");
        }

        // Check if user is already a member
        if (family.members.includes(userId)) {
          return; // Already a member
        }

        // Add to family_members junction table
        await fastify.pg.query(
          "INSERT INTO family_members (family_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
          [familyId, userId]
        );

        // Update family members array
        const updatedMembers = [...family.members, userId];
        await fastify.pg.query(
          "UPDATE families SET members = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2",
          [updatedMembers, familyId]
        );

        // Add family to user's families array
        await fastify.user.addToFamily(userId, familyId);

        fastify.log.info(`Added user ${userId} to family ${familyId}`);
      } catch (err) {
        fastify.log.error(err);
        if (err instanceof Error) {
          throw err;
        }
        throw new Error("Failed to add member to family");
      }
    },

    async removeMember(familyId: string, userId: string): Promise<void> {
      try {
        const family = await fastify.family.getById(familyId);
        if (!family) {
          throw new Error("Family not found");
        }

        // Cannot remove the owner
        if (family.owner_id === userId) {
          throw new Error("Cannot remove family owner");
        }

        // Remove from family_members junction table
        await fastify.pg.query(
          "DELETE FROM family_members WHERE family_id = $1 AND user_id = $2",
          [familyId, userId]
        );

        // Update family members array
        const updatedMembers = family.members.filter((id) => id !== userId);
        await fastify.pg.query(
          "UPDATE families SET members = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2",
          [updatedMembers, familyId]
        );

        // Remove family from user's families array
        await fastify.user.removeFromFamily(userId, familyId);

        fastify.log.info(`Removed user ${userId} from family ${familyId}`);
      } catch (err) {
        fastify.log.error(err);
        if (err instanceof Error) {
          throw err;
        }
        throw new Error("Failed to remove member from family");
      }
    },

    async getRelatedFamilies(familyId: string): Promise<RelatedFamily[]> {
      try {
        const { rows } = await fastify.pg.query<RelatedFamily>(
          `SELECT f.id, f.name, array_length(f.members, 1) as member_count, f.created_at
           FROM families f
           JOIN family_relations fr ON (f.id = fr.family_id_1 OR f.id = fr.family_id_2)
           WHERE (fr.family_id_1 = $1 OR fr.family_id_2 = $1) AND f.id != $1
           ORDER BY f.name`,
          [familyId]
        );

        return rows;
      } catch (err) {
        fastify.log.error(err);
        throw new Error("Failed to fetch related families");
      }
    },

    async addRelatedFamily(
      familyId: string,
      relatedFamilyId: string
    ): Promise<void> {
      try {
        // Check if both families exist
        const family1 = await fastify.family.getById(familyId);
        const family2 = await fastify.family.getById(relatedFamilyId);

        if (!family1) {
          throw new Error("Source family not found");
        }
        if (!family2) {
          throw new Error("Target family not found");
        }

        if (familyId === relatedFamilyId) {
          throw new Error("Cannot relate family to itself");
        }

        // Check if relation already exists
        const { rows: existing } = await fastify.pg.query(
          `SELECT 1 FROM family_relations 
           WHERE (family_id_1 = $1 AND family_id_2 = $2) 
              OR (family_id_1 = $2 AND family_id_2 = $1)`,
          [familyId, relatedFamilyId]
        );

        if (existing.length > 0) {
          throw new Error("Families are already related");
        }

        // Add bidirectional relation in family_relations table
        await fastify.pg.query(
          "INSERT INTO family_relations (family_id_1, family_id_2) VALUES ($1, $2)",
          [familyId, relatedFamilyId]
        );

        // Update both families' related_families arrays
        const family1Relations = family1.related_families || [];
        const family2Relations = family2.related_families || [];

        if (!family1Relations.includes(relatedFamilyId)) {
          family1Relations.push(relatedFamilyId);
          await fastify.pg.query(
            "UPDATE families SET related_families = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2",
            [family1Relations, familyId]
          );
        }

        if (!family2Relations.includes(familyId)) {
          family2Relations.push(familyId);
          await fastify.pg.query(
            "UPDATE families SET related_families = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2",
            [family2Relations, relatedFamilyId]
          );
        }

        fastify.log.info(
          `Added relation between families ${familyId} and ${relatedFamilyId}`
        );
      } catch (err) {
        fastify.log.error(err);
        if (err instanceof Error) {
          throw err;
        }
        throw new Error("Failed to add family relation");
      }
    },

    async removeRelatedFamily(
      familyId: string,
      relatedFamilyId: string
    ): Promise<void> {
      try {
        // Remove from family_relations table
        await fastify.pg.query(
          `DELETE FROM family_relations 
           WHERE (family_id_1 = $1 AND family_id_2 = $2) 
              OR (family_id_1 = $2 AND family_id_2 = $1)`,
          [familyId, relatedFamilyId]
        );

        // Update both families' related_families arrays
        const family1 = await fastify.family.getById(familyId);
        const family2 = await fastify.family.getById(relatedFamilyId);

        if (family1 && family1.related_families) {
          const updatedRelations1 = family1.related_families.filter(
            (id) => id !== relatedFamilyId
          );
          await fastify.pg.query(
            "UPDATE families SET related_families = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2",
            [updatedRelations1, familyId]
          );
        }

        if (family2 && family2.related_families) {
          const updatedRelations2 = family2.related_families.filter(
            (id) => id !== familyId
          );
          await fastify.pg.query(
            "UPDATE families SET related_families = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2",
            [updatedRelations2, relatedFamilyId]
          );
        }

        fastify.log.info(
          `Removed relation between families ${familyId} and ${relatedFamilyId}`
        );
      } catch (err) {
        fastify.log.error(err);
        if (err instanceof Error) {
          throw err;
        }
        throw new Error("Failed to remove family relation");
      }
    },
  });
};

export default fp(familyPlugin, {
  name: "family",
  // dependencies: ["@fastify/postgres", "user"], // commented out for tests
});

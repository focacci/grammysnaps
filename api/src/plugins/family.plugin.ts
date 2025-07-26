import { FastifyPluginAsync, FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import {
  Family,
  FamilyInput,
  FamilyUpdate,
  FamilyPublic,
  FamilyMember,
} from "../types/family.types";

declare module "fastify" {
  interface FastifyInstance {
    family: {
      create: (input: FamilyInput, ownerId: string) => Promise<FamilyPublic>;
      get: () => Promise<FamilyPublic[]>;
      getById: (id: string) => Promise<Family | null>;
      getUserFamilies: (userId: string) => Promise<FamilyPublic[]>;
      getMembers: (familyId: string) => Promise<FamilyMember[]>;
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
      created_at: family.created_at,
      updated_at: family.updated_at,
    };
  };

  fastify.decorate("family", {
    async create(input: FamilyInput, ownerId: string): Promise<FamilyPublic> {
      const { name } = input;

      try {
        // Create the family
        const {
          rows: [family],
        } = await fastify.pg.query<Family>(
          "INSERT INTO families (name, members, owner_id) VALUES ($1, $2, $3) RETURNING *",
          [name, [ownerId], ownerId]
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
  });
};

export default fp(familyPlugin, {
  name: "family",
  dependencies: ["@fastify/postgres", "user"],
});

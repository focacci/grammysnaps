import { FastifyPluginAsync, FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import argon2 from "argon2";
import { User, UserInput, UserUpdate, UserPublic } from "../types/user.types";

declare module "fastify" {
  interface FastifyInstance {
    user: {
      create: (input: UserInput) => Promise<UserPublic>;
      get: () => Promise<UserPublic[]>;
      getById: (id: string) => Promise<UserPublic | null>;
      getByEmail: (email: string) => Promise<User | null>;
      update: (id: string, input: UserUpdate) => Promise<UserPublic | null>;
      delete: (id: string) => Promise<void>;
      validatePassword: (user: User, password: string) => Promise<boolean>;
      addToFamily: (userId: string, familyId: string) => Promise<void>;
      removeFromFamily: (userId: string, familyId: string) => Promise<void>;
    };
  }
}

const userPlugin: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  if (!fastify.pg) {
    throw new Error("fastify-postgres must be registered before this plugin");
  }

  // Helper function to convert User to UserPublic (remove password_hash)
  const toPublicUser = (user: User): UserPublic => {
    const { password_hash, ...publicUser } = user;

    // Ensure birthday is consistently formatted as YYYY-MM-DD
    if (publicUser.birthday) {
      publicUser.birthday = new Date(publicUser.birthday)
        .toISOString()
        .split("T")[0];
    }

    return publicUser;
  };

  fastify.decorate("user", {
    async create(input: UserInput): Promise<UserPublic> {
      const {
        email,
        password,
        first_name,
        middle_name,
        last_name,
        birthday,
        families,
      } = input;

      try {
        // Check if email already exists
        const existingUserByEmail = await fastify.user.getByEmail(email);
        if (existingUserByEmail) {
          throw new Error("User with this email already exists");
        }

        // Hash the password
        const password_hash = await argon2.hash(password);

        const {
          rows: [user],
        } = await fastify.pg.query<User>(
          "INSERT INTO users (email, password_hash, first_name, middle_name, last_name, birthday, families) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *",
          [
            email,
            password_hash,
            first_name,
            middle_name || null,
            last_name,
            birthday || null,
            families ?? [],
          ]
        );

        // Format birthday for consistent frontend display
        if (user.birthday) {
          user.birthday = new Date(user.birthday).toISOString().split("T")[0];
        }

        fastify.log.info(
          `Created user: ${user.email} (${user.first_name} ${user.last_name})`
        );
        return toPublicUser(user);
      } catch (err) {
        fastify.log.error(err);
        if (err instanceof Error) {
          throw err;
        }
        throw new Error("Failed to create user");
      }
    },

    async get(): Promise<UserPublic[]> {
      try {
        const { rows } = await fastify.pg.query<User>(
          "SELECT * FROM users ORDER BY created_at DESC"
        );
        return rows.map(toPublicUser);
      } catch (err) {
        fastify.log.error(err);
        throw new Error("Failed to fetch users");
      }
    },

    async getById(id: string): Promise<UserPublic | null> {
      try {
        const { rows } = await fastify.pg.query<User>(
          "SELECT * FROM users WHERE id = $1",
          [id]
        );
        return rows.length > 0 ? toPublicUser(rows[0]) : null;
      } catch (err) {
        fastify.log.error(err);
        throw new Error("Failed to fetch user by ID");
      }
    },

    async getByEmail(email: string): Promise<User | null> {
      try {
        const { rows } = await fastify.pg.query<User>(
          "SELECT * FROM users WHERE email = $1",
          [email]
        );
        return rows.length > 0 ? rows[0] : null;
      } catch (err) {
        fastify.log.error(err);
        throw new Error("Failed to fetch user by email");
      }
    },

    async update(id: string, input: UserUpdate): Promise<UserPublic | null> {
      const { email, first_name, middle_name, last_name, birthday, families } =
        input;

      try {
        // Check if the user exists
        const existingUser = await fastify.user.getById(id);
        if (!existingUser) {
          return null;
        }

        // Check for conflicts with other users if updating email
        if (email && email !== existingUser.email) {
          const userWithEmail = await fastify.user.getByEmail(email);
          if (userWithEmail) {
            throw new Error("Another user with this email already exists");
          }
        }

        // Build dynamic update query
        const updateFields: string[] = [];
        const values: any[] = [];
        let paramCount = 1;

        if (email !== undefined) {
          updateFields.push(`email = $${paramCount}`);
          values.push(email);
          paramCount++;
        }

        if (first_name !== undefined) {
          updateFields.push(`first_name = $${paramCount}`);
          values.push(first_name);
          paramCount++;
        }

        if (middle_name !== undefined) {
          updateFields.push(`middle_name = $${paramCount}`);
          values.push(middle_name);
          paramCount++;
        }

        if (last_name !== undefined) {
          updateFields.push(`last_name = $${paramCount}`);
          values.push(last_name);
          paramCount++;
        }

        if (birthday !== undefined) {
          updateFields.push(`birthday = $${paramCount}`);
          values.push(birthday);
          paramCount++;
        }

        if (families !== undefined) {
          updateFields.push(`families = $${paramCount}`);
          values.push(families);
          paramCount++;
        }

        // Add updated_at timestamp
        updateFields.push(`updated_at = CURRENT_TIMESTAMP`);

        // Add ID parameter
        values.push(id);

        const query = `UPDATE users SET ${updateFields.join(
          ", "
        )} WHERE id = $${paramCount} RETURNING *`;

        const {
          rows: [user],
        } = await fastify.pg.query<User>(query, values);

        // Format birthday for consistent frontend display
        if (user.birthday) {
          user.birthday = new Date(user.birthday).toISOString().split("T")[0];
        }

        fastify.log.info(`Updated user: ${user.email}`);
        return toPublicUser(user);
      } catch (err) {
        fastify.log.error(err);
        if (err instanceof Error) {
          throw err;
        }
        throw new Error("Failed to update user");
      }
    },

    async delete(id: string): Promise<void> {
      try {
        const user = await fastify.user.getById(id);
        if (!user) {
          throw new Error("User not found");
        }

        await fastify.pg.query("DELETE FROM users WHERE id = $1", [id]);
        fastify.log.info(`Deleted user: ${user.email}`);
      } catch (err) {
        fastify.log.error(err);
        if (err instanceof Error) {
          throw err;
        }
        throw new Error("Failed to delete user");
      }
    },

    async validatePassword(user: User, password: string): Promise<boolean> {
      try {
        return await argon2.verify(user.password_hash, password);
      } catch (err) {
        fastify.log.error(err);
        throw new Error("Failed to validate password");
      }
    },

    async addToFamily(userId: string, familyId: string): Promise<void> {
      try {
        const user = await fastify.user.getById(userId);
        if (!user) {
          throw new Error("User not found");
        }

        // Check if user is already in the family
        if (user.families.includes(familyId)) {
          return; // Already in family, no need to add
        }

        const updatedFamilies = [...user.families, familyId];

        await fastify.pg.query(
          "UPDATE users SET families = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2",
          [updatedFamilies, userId]
        );

        fastify.log.info(`Added user ${userId} to family ${familyId}`);
      } catch (err) {
        fastify.log.error(err);
        if (err instanceof Error) {
          throw err;
        }
        throw new Error("Failed to add user to family");
      }
    },

    async removeFromFamily(userId: string, familyId: string): Promise<void> {
      try {
        const user = await fastify.user.getById(userId);
        if (!user) {
          throw new Error("User not found");
        }

        const updatedFamilies = user.families.filter((id) => id !== familyId);

        await fastify.pg.query(
          "UPDATE users SET families = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2",
          [updatedFamilies, userId]
        );

        fastify.log.info(`Removed user ${userId} from family ${familyId}`);
      } catch (err) {
        fastify.log.error(err);
        if (err instanceof Error) {
          throw err;
        }
        throw new Error("Failed to remove user from family");
      }
    },
  });
};

export default fp(userPlugin, {
  name: "user",
  dependencies: ["@fastify/postgres"],
});

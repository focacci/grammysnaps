import { FastifyPluginAsync, FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import argon2 from "argon2";
import {
  User,
  UserInput,
  UserUpdate,
  UserPublic,
  SecurityUpdateInput,
} from "../types/user.types";
import { ValidationUtils } from "../utils/validation";
import { UUID } from "crypto";

declare module "fastify" {
  interface FastifyInstance {
    user: {
      create: (input: UserInput) => Promise<UserPublic>;
      get: () => Promise<UserPublic[]>;
      getById: (id: UUID) => Promise<UserPublic | null>;
      getByEmail: (email: string) => Promise<User | null>;
      update: (id: UUID, input: UserUpdate) => Promise<UserPublic | null>;
      updateSecurity: (
        id: UUID,
        input: SecurityUpdateInput
      ) => Promise<UserPublic | null>;
      delete: (id: UUID) => Promise<void>;
      validatePassword: (user: User, password: string) => Promise<boolean>;
      addToFamily: (userId: UUID, familyId: UUID) => Promise<void>;
      removeFromFamily: (userId: UUID, familyId: UUID) => Promise<void>;
    };
  }
}

const userPlugin: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  if (!fastify.pg) {
    throw new Error("fastify-postgres must be registered before this plugin");
  }

  // Helper function to convert User to UserPublic (remove password_hash)
  const toPublicUser = (user: User): UserPublic => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password_hash, ...publicUser } = user;

    // Ensure birthday is consistently formatted as YYYY-MM-DD
    if (publicUser.birthday) {
      publicUser.birthday = new Date(publicUser.birthday)
        .toISOString()
        .split("T")[0];
    }

    return publicUser;
  };

  const filterValidFamilies = async (families: UUID[]): Promise<UUID[]> => {
    const validFamilies: UUID[] = [];
    for (const familyId of families) {
      if (await fastify.family.exists(familyId)) {
        validFamilies.push(familyId);
      }
    }
    return validFamilies;
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
        // Sanitize and validate all inputs
        const sanitizedEmail = ValidationUtils.sanitizeEmail(email);
        const sanitizedPassword = ValidationUtils.sanitizePassword(password);
        const sanitizedFirstName = first_name
          ? ValidationUtils.sanitizeText(first_name, "First name", false, 50)
          : null;
        const sanitizedMiddleName = middle_name
          ? ValidationUtils.sanitizeText(middle_name, "Middle name", false, 50)
          : null;
        const sanitizedLastName = last_name
          ? ValidationUtils.sanitizeText(last_name, "Last name", false, 50)
          : null;
        const sanitizedBirthday = birthday
          ? ValidationUtils.sanitizeDate(birthday)
          : null;
        const sanitizedFamilies = ValidationUtils.sanitizeFamilyIds(
          families || []
        );

        // Validate family IDs
        const sanitizedAndValidFamilies = sanitizedFamilies.length
          ? await filterValidFamilies(sanitizedFamilies)
          : [];

        // Check if email already exists
        const existingUserByEmail = await fastify.user.getByEmail(
          sanitizedEmail
        );
        if (existingUserByEmail) {
          throw new Error("User with this email already exists");
        }

        // Hash the password
        const password_hash = await argon2.hash(sanitizedPassword);

        const {
          rows: [user],
        } = await fastify.pg.query<User>(
          "INSERT INTO users (email, password_hash, first_name, middle_name, last_name, birthday, families) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *",
          [
            sanitizedEmail,
            password_hash,
            sanitizedFirstName,
            sanitizedMiddleName,
            sanitizedLastName,
            sanitizedBirthday,
            sanitizedAndValidFamilies,
          ]
        );

        // Create "My Collection" family for the new user
        try {
          const myCollectionFamily = await fastify.family.create(
            { name: "My Collection" },
            user.id
          );
          
          fastify.log.info(
            `Created "My Collection" family for user: ${user.email} (Family ID: ${myCollectionFamily.id})`
          );
        } catch (familyError) {
          // Log the error but don't fail user creation
          fastify.log.error(
            `Failed to create "My Collection" family for user ${user.id}:`, 
            familyError
          );
        }

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
        return rows.length > 0 ? await toPublicUser(rows[0]) : null;
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

    async update(id: UUID, input: UserUpdate): Promise<UserPublic | null> {
      const {
        email,
        first_name,
        middle_name,
        last_name,
        birthday,
        families,
        profile_picture_key,
        profile_picture_thumbnail_key,
      } = input;
      fastify.log.info(`Updating user: ${input}`);

      try {
        // Sanitize and validate the ID
        const sanitizedId = ValidationUtils.sanitizeUUID(id, "User ID");

        // Check if the user exists
        const existingUser = await fastify.user.getById(sanitizedId);
        if (!existingUser) {
          return null;
        }

        // Sanitize and validate inputs
        const sanitizedEmail = email?.trim()
          ? ValidationUtils.sanitizeEmail(email)
          : null;
        const sanitizedFirstName = first_name?.trim()
          ? ValidationUtils.sanitizeText(first_name, "First name", false, 50)
          : null;
        const sanitizedMiddleName = middle_name?.trim()
          ? ValidationUtils.sanitizeText(middle_name, "Middle name", false, 50)
          : null;
        const sanitizedLastName = last_name?.trim()
          ? ValidationUtils.sanitizeText(last_name, "Last name", false, 50)
          : null;
        const sanitizedBirthday = birthday?.trim().split("T")[0]
          ? ValidationUtils.sanitizeDate(birthday?.trim().split("T")[0])
          : null;
        const sanitizedFamilies = families
          ? ValidationUtils.sanitizeFamilyIds(families)
          : null;
        const sanitizedProfilePictureKey = profile_picture_key ?? null;
        const sanitizedProfilePictureThumbnailKey =
          profile_picture_thumbnail_key ?? null;

        // Validate family IDs
        const sanitizedAndValidFamilies = sanitizedFamilies?.length
          ? await filterValidFamilies(sanitizedFamilies)
          : [];

        // Check for conflicts with other users if updating email
        if (sanitizedEmail && sanitizedEmail !== existingUser.email) {
          const userWithEmail = await fastify.user.getByEmail(sanitizedEmail);
          if (userWithEmail) {
            throw new Error("Another user with this email already exists");
          }
        }

        // Build dynamic update query
        const updateFields: string[] = [];
        const values: (string | string[] | null)[] = [];
        let paramCount = 1;

        updateFields.push(`first_name = $${paramCount}`);
        values.push(sanitizedFirstName);
        paramCount++;

        updateFields.push(`middle_name = $${paramCount}`);
        values.push(sanitizedMiddleName);
        paramCount++;

        updateFields.push(`last_name = $${paramCount}`);
        values.push(sanitizedLastName);
        paramCount++;

        updateFields.push(`birthday = $${paramCount}`);
        values.push(sanitizedBirthday);
        paramCount++;

        if (sanitizedAndValidFamilies) {
          updateFields.push(`families = $${paramCount}`);
          values.push(sanitizedAndValidFamilies);
          paramCount++;
        }

        if (sanitizedProfilePictureKey) {
          updateFields.push(`profile_picture_key = $${paramCount}`);
          values.push(sanitizedProfilePictureKey);
          paramCount++;
        }

        if (sanitizedProfilePictureThumbnailKey) {
          updateFields.push(`profile_picture_thumbnail_key = $${paramCount}`);
          values.push(sanitizedProfilePictureThumbnailKey);
          paramCount++;
        }

        // Add updated_at timestamp
        updateFields.push(`updated_at = CURRENT_TIMESTAMP`);

        // Add ID parameter
        values.push(sanitizedId);

        const query = `UPDATE users SET ${updateFields.join(
          ", "
        )} WHERE id = $${paramCount} RETURNING *`;

        const {
          rows: [user],
        } = await fastify.pg.query<User>(query, values);

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

    async delete(id: UUID): Promise<void> {
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

    async updateSecurity(
      id: UUID,
      input: SecurityUpdateInput
    ): Promise<UserPublic | null> {
      try {
        // Get the existing user with password hash for validation
        const {
          rows: [existingUser],
        } = await fastify.pg.query<User>("SELECT * FROM users WHERE id = $1", [
          id,
        ]);

        if (!existingUser) {
          throw new Error("User not found");
        }

        // If changing password, validate current password
        if (input.new_password) {
          if (!input.current_password) {
            throw new Error("Current password is required to change password");
          }

          const isCurrentPasswordValid = await fastify.user.validatePassword(
            existingUser as User,
            input.current_password
          );
          if (!isCurrentPasswordValid) {
            throw new Error("Current password is incorrect");
          }
        }

        // Build dynamic update query
        const updateFields: string[] = [];
        const values: (string | number)[] = [];
        let paramCount = 1;

        if (input.new_password !== undefined) {
          // Hash the new password
          const password_hash = await argon2.hash(input.new_password);
          updateFields.push(`password_hash = $${paramCount}`);
          values.push(password_hash);
          paramCount++;
        }

        // If no fields to update, return current user
        if (updateFields.length === 0) {
          if (existingUser.birthday) {
            existingUser.birthday = new Date(existingUser.birthday)
              .toISOString()
              .split("T")[0];
          }
          return toPublicUser(existingUser);
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

        if (user.birthday) {
          user.birthday = new Date(user.birthday).toISOString().split("T")[0];
        }

        // If password was changed, revoke all existing tokens to log user out everywhere
        if (input.new_password) {
          await fastify.auth.revokeUserTokens(user.id);
          fastify.log.info(
            `Revoked all tokens for user after password change: ${user.email}`
          );
        }

        fastify.log.info(`Updated security settings for user: ${user.email}`);
        return toPublicUser(user);
      } catch (err) {
        fastify.log.error(err);
        if (err instanceof Error) {
          throw err;
        }
        throw new Error("Failed to update security settings");
      }
    },

    async addToFamily(userId: UUID, familyId: UUID): Promise<void> {
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

    async removeFromFamily(userId: UUID, familyId: UUID): Promise<void> {
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
  // dependencies: ["@fastify/postgres"], // commented out for testing
});

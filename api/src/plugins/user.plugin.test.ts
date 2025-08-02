import Fastify, { FastifyInstance } from "fastify";
import userPlugin from "./user.plugin";
import {
  User,
  UserInput,
  UserUpdate,
  UserPublic,
  SecurityUpdateInput,
} from "../types/user.types";
import argon2 from "argon2";

// Mock argon2
jest.mock("argon2");
const mockArgon2 = argon2 as jest.Mocked<typeof argon2>;

// Mock validation utilities
jest.mock("../utils/validation", () => ({
  ValidationUtils: {
    sanitizeEmail: jest.fn((email) => email.toLowerCase().trim()),
    sanitizePassword: jest.fn((password) => password),
    sanitizeText: jest.fn((text) => text),
    sanitizeDate: jest.fn((date) => date),
    sanitizeFamilyIds: jest.fn((families) => families || []),
    sanitizeUUID: jest.fn((uuid) => uuid),
    sanitizeURL: jest.fn((url) => url),
  },
}));

// Mock the postgres query function
const mockQuery = jest.fn();

// Mock the family plugin
const mockFamilyExists = jest.fn();

// Mock the auth plugin
const mockRevokeUserTokens = jest.fn();

describe("User Plugin", () => {
  let fastify: FastifyInstance;

  beforeEach(async () => {
    // Create a new Fastify instance for each test
    fastify = Fastify({ logger: false });

    // Decorate the fastify instance with the required dependencies
    fastify.decorate("pg", {
      query: mockQuery,
    } as any);

    fastify.decorate("family", {
      exists: mockFamilyExists,
    } as any);

    fastify.decorate("auth", {
      revokeUserTokens: mockRevokeUserTokens,
    } as any);

    // Register user plugin
    await fastify.register(userPlugin);

    // Wait for all plugins to be ready
    await fastify.ready();

    // Clear all mocks
    jest.clearAllMocks();
  });

  afterEach(async () => {
    await fastify.close();
  });

  describe("Plugin Registration", () => {
    it("should register user plugin successfully", async () => {
      expect(fastify.user).toBeDefined();
      expect(typeof fastify.user.create).toBe("function");
      expect(typeof fastify.user.get).toBe("function");
      expect(typeof fastify.user.getById).toBe("function");
      expect(typeof fastify.user.getByEmail).toBe("function");
      expect(typeof fastify.user.update).toBe("function");
      expect(typeof fastify.user.updateSecurity).toBe("function");
      expect(typeof fastify.user.delete).toBe("function");
      expect(typeof fastify.user.validatePassword).toBe("function");
      expect(typeof fastify.user.addToFamily).toBe("function");
      expect(typeof fastify.user.removeFromFamily).toBe("function");
    });
  });

  describe("create", () => {
    const mockUser: User = {
      id: "550e8400-e29b-41d4-a716-446655440000",
      email: "test@example.com",
      password_hash: "hashed-password",
      first_name: "John",
      middle_name: "M",
      last_name: "Doe",
      birthday: "1990-01-01",
      families: ["550e8400-e29b-41d4-a716-446655440001"],
      profile_picture_url: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    it("should create a user successfully", async () => {
      const userInput: UserInput = {
        email: "test@example.com",
        password: "StrongPassword123!",
        first_name: "John",
        middle_name: "M",
        last_name: "Doe",
        birthday: "1990-01-01",
        families: ["550e8400-e29b-41d4-a716-446655440001"],
      };

      // Mock family validation
      mockFamilyExists.mockResolvedValueOnce(true);

      // Mock getByEmail to return null (no existing user)
      mockQuery.mockResolvedValueOnce({ rows: [] }); // getByEmail

      // Mock password hashing
      mockArgon2.hash.mockResolvedValueOnce("hashed-password");

      // Mock user creation
      mockQuery.mockResolvedValueOnce({ rows: [mockUser] }); // INSERT

      const result = await fastify.user.create(userInput);

      expect(mockArgon2.hash).toHaveBeenCalledWith("StrongPassword123!");
      expect(result).toEqual({
        id: "550e8400-e29b-41d4-a716-446655440000",
        email: "test@example.com",
        first_name: "John",
        middle_name: "M",
        last_name: "Doe",
        birthday: "1990-01-01",
        families: ["550e8400-e29b-41d4-a716-446655440001"],
        profile_picture_url: null,
        created_at: mockUser.created_at,
        updated_at: mockUser.updated_at,
      });
    });

    it("should create a user with minimal data", async () => {
      const userInput: UserInput = {
        email: "minimal@example.com",
        password: "StrongPassword123!",
        first_name: null,
        middle_name: null,
        last_name: null,
        birthday: null,
        families: [],
      };

      const minimalUser: User = {
        id: "550e8400-e29b-41d4-a716-446655440002",
        email: "minimal@example.com",
        password_hash: "hashed-password",
        first_name: null,
        middle_name: null,
        last_name: null,
        birthday: null,
        families: [],
        profile_picture_url: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      mockQuery.mockResolvedValueOnce({ rows: [] }); // getByEmail
      mockArgon2.hash.mockResolvedValueOnce("hashed-password");
      mockQuery.mockResolvedValueOnce({ rows: [minimalUser] }); // INSERT

      const result = await fastify.user.create(userInput);

      expect(result.email).toBe("minimal@example.com");
      expect(result.families).toEqual([]);
      expect(result.first_name).toBeNull();
    });

    it("should filter out invalid families", async () => {
      const userInput: UserInput = {
        email: "test@example.com",
        password: "StrongPassword123!",
        first_name: "John",
        middle_name: null,
        last_name: "Doe",
        birthday: null,
        families: [
          "550e8400-e29b-41d4-a716-446655440001",
          "invalid-family",
          "550e8400-e29b-41d4-a716-446655440002",
        ],
      };

      // Mock family validation - only valid UUIDs exist
      mockFamilyExists
        .mockResolvedValueOnce(true) // first family
        .mockResolvedValueOnce(false) // invalid-family
        .mockResolvedValueOnce(true); // second family

      mockQuery.mockResolvedValueOnce({ rows: [] }); // getByEmail
      mockArgon2.hash.mockResolvedValueOnce("hashed-password");
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            ...mockUser,
            families: [
              "550e8400-e29b-41d4-a716-446655440001",
              "550e8400-e29b-41d4-a716-446655440002",
            ],
          },
        ],
      }); // INSERT

      const result = await fastify.user.create(userInput);

      expect(result.families).toEqual([
        "550e8400-e29b-41d4-a716-446655440001",
        "550e8400-e29b-41d4-a716-446655440002",
      ]);
    });

    it("should throw error when email already exists", async () => {
      const userInput: UserInput = {
        email: "existing@example.com",
        password: "StrongPassword123!",
        first_name: "John",
        middle_name: null,
        last_name: "Doe",
        birthday: null,
        families: [],
      };

      // Mock getByEmail to return existing user
      mockQuery.mockResolvedValueOnce({ rows: [mockUser] });

      await expect(fastify.user.create(userInput)).rejects.toThrow(
        "User with this email already exists"
      );
    });

    it("should throw error when database fails", async () => {
      const userInput: UserInput = {
        email: "test@example.com",
        password: "StrongPassword123!",
        first_name: "John",
        middle_name: null,
        last_name: "Doe",
        birthday: null,
        families: [],
      };

      mockQuery.mockResolvedValueOnce({ rows: [] }); // getByEmail
      mockArgon2.hash.mockResolvedValueOnce("hashed-password");
      mockQuery.mockRejectedValueOnce(new Error("Database error")); // INSERT

      await expect(fastify.user.create(userInput)).rejects.toThrow(
        "Database error"
      );
    });
  });

  describe("get", () => {
    it("should return all users", async () => {
      const mockUsers: User[] = [
        {
          id: "550e8400-e29b-41d4-a716-446655440000",
          email: "user1@example.com",
          password_hash: "hash1",
          first_name: "User",
          middle_name: null,
          last_name: "One",
          birthday: "1990-01-01",
          families: ["550e8400-e29b-41d4-a716-446655440001"],
          profile_picture_url: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: "550e8400-e29b-41d4-a716-446655440002",
          email: "user2@example.com",
          password_hash: "hash2",
          first_name: "User",
          middle_name: null,
          last_name: "Two",
          birthday: null,
          families: [],
          profile_picture_url: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];

      mockQuery.mockResolvedValueOnce({ rows: mockUsers });

      const result = await fastify.user.get();

      expect(mockQuery).toHaveBeenCalledWith(
        "SELECT * FROM users ORDER BY created_at DESC"
      );
      expect(result).toHaveLength(2);
      expect(result[0]).not.toHaveProperty("password_hash");
      expect(result[1]).not.toHaveProperty("password_hash");
    });

    it("should return empty array when no users exist", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const result = await fastify.user.get();

      expect(result).toHaveLength(0);
    });

    it("should throw error when database fails", async () => {
      mockQuery.mockRejectedValueOnce(new Error("Database error"));

      await expect(fastify.user.get()).rejects.toThrow("Failed to fetch users");
    });
  });

  describe("getById", () => {
    const mockUser: User = {
      id: "550e8400-e29b-41d4-a716-446655440000",
      email: "test@example.com",
      password_hash: "hashed-password",
      first_name: "John",
      middle_name: null,
      last_name: "Doe",
      birthday: "1990-01-01",
      families: ["550e8400-e29b-41d4-a716-446655440001"],
      profile_picture_url: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    it("should return user by ID", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [mockUser] });

      const result = await fastify.user.getById(
        "550e8400-e29b-41d4-a716-446655440000"
      );

      expect(mockQuery).toHaveBeenCalledWith(
        "SELECT * FROM users WHERE id = $1",
        ["550e8400-e29b-41d4-a716-446655440000"]
      );
      expect(result).not.toBeNull();
      expect(result?.id).toBe("550e8400-e29b-41d4-a716-446655440000");
      expect(result).not.toHaveProperty("password_hash");
    });

    it("should return null when user not found", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const result = await fastify.user.getById(
        "550e8400-e29b-41d4-a716-446655440999"
      );

      expect(result).toBeNull();
    });

    it("should throw error when database fails", async () => {
      mockQuery.mockRejectedValueOnce(new Error("Database error"));

      await expect(
        fastify.user.getById("550e8400-e29b-41d4-a716-446655440000")
      ).rejects.toThrow("Failed to fetch user by ID");
    });
  });

  describe("getByEmail", () => {
    const mockUser: User = {
      id: "550e8400-e29b-41d4-a716-446655440000",
      email: "test@example.com",
      password_hash: "hashed-password",
      first_name: "John",
      middle_name: null,
      last_name: "Doe",
      birthday: "1990-01-01",
      families: ["550e8400-e29b-41d4-a716-446655440001"],
      profile_picture_url: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    it("should return user by email with password hash", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [mockUser] });

      const result = await fastify.user.getByEmail("test@example.com");

      expect(mockQuery).toHaveBeenCalledWith(
        "SELECT * FROM users WHERE email = $1",
        ["test@example.com"]
      );
      expect(result).not.toBeNull();
      expect(result?.email).toBe("test@example.com");
      expect(result).toHaveProperty("password_hash");
    });

    it("should return null when user not found", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const result = await fastify.user.getByEmail("nonexistent@example.com");

      expect(result).toBeNull();
    });

    it("should throw error when database fails", async () => {
      mockQuery.mockRejectedValueOnce(new Error("Database error"));

      await expect(fastify.user.getByEmail("test@example.com")).rejects.toThrow(
        "Failed to fetch user by email"
      );
    });
  });

  describe("update", () => {
    const existingUser: UserPublic = {
      id: "550e8400-e29b-41d4-a716-446655440000",
      email: "test@example.com",
      first_name: "John",
      middle_name: null,
      last_name: "Doe",
      birthday: "1990-01-01",
      families: ["550e8400-e29b-41d4-a716-446655440001"],
      profile_picture_url: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const updatedUser: User = {
      id: "550e8400-e29b-41d4-a716-446655440000",
      email: "updated@example.com",
      password_hash: "hashed-password",
      first_name: "Jane",
      middle_name: "M",
      last_name: "Smith",
      birthday: "1985-05-15",
      families: ["550e8400-e29b-41d4-a716-446655440002"],
      profile_picture_url: "https://example.com/pic.jpg",
      created_at: existingUser.created_at,
      updated_at: new Date().toISOString(),
    };

    it("should update user successfully", async () => {
      const updateInput: UserUpdate = {
        email: "updated@example.com",
        first_name: "Jane",
        middle_name: "M",
        last_name: "Smith",
        birthday: "1985-05-15",
        families: ["550e8400-e29b-41d4-a716-446655440002"],
        profile_picture_url: "https://example.com/pic.jpg",
      };

      // Mock existing user lookup (getById internal call)
      mockQuery.mockResolvedValueOnce({
        rows: [{ ...existingUser, password_hash: "hash" }],
      }); // getById

      // Mock family validation
      mockFamilyExists.mockResolvedValueOnce(true);

      // Mock email conflict check (getByEmail internal call)
      mockQuery.mockResolvedValueOnce({ rows: [] }); // getByEmail

      // Mock update query
      mockQuery.mockResolvedValueOnce({ rows: [updatedUser] });

      const result = await fastify.user.update(
        "550e8400-e29b-41d4-a716-446655440000",
        updateInput
      );

      expect(result).not.toBeNull();
      expect(result?.email).toBe("updated@example.com");
      expect(result?.first_name).toBe("Jane");
      expect(result).not.toHaveProperty("password_hash");
    });

    it("should return null when user not found", async () => {
      const updateInput: UserUpdate = {
        first_name: "Jane",
      };

      // Mock getById to return empty (no user found)
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const result = await fastify.user.update(
        "550e8400-e29b-41d4-a716-446655440999",
        updateInput
      );

      expect(result).toBeNull();
    });

    it("should throw error when email already exists for another user", async () => {
      const updateInput: UserUpdate = {
        email: "existing@example.com",
      };

      const anotherUser: User = {
        id: "550e8400-e29b-41d4-a716-446655440003",
        email: "existing@example.com",
        password_hash: "hash",
        first_name: "Another",
        middle_name: null,
        last_name: "User",
        birthday: null,
        families: [],
        profile_picture_url: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      mockQuery.mockResolvedValueOnce({
        rows: [{ ...existingUser, password_hash: "hash" }],
      }); // getById
      mockQuery.mockResolvedValueOnce({ rows: [anotherUser] }); // getByEmail

      await expect(
        fastify.user.update("550e8400-e29b-41d4-a716-446655440000", updateInput)
      ).rejects.toThrow("Another user with this email already exists");
    });

    it("should handle partial updates", async () => {
      const updateInput: UserUpdate = {
        first_name: "UpdatedName",
      };

      const partiallyUpdatedUser: User = {
        ...existingUser,
        password_hash: "hashed-password",
        first_name: "UpdatedName",
        updated_at: new Date().toISOString(),
      };

      mockQuery.mockResolvedValueOnce({
        rows: [{ ...existingUser, password_hash: "hash" }],
      }); // getById
      mockQuery.mockResolvedValueOnce({ rows: [partiallyUpdatedUser] }); // UPDATE

      const result = await fastify.user.update(
        "550e8400-e29b-41d4-a716-446655440000",
        updateInput
      );

      expect(result?.first_name).toBe("UpdatedName");
      expect(result?.email).toBe(existingUser.email); // unchanged
    });

    it("should throw error when database fails", async () => {
      const updateInput: UserUpdate = {
        first_name: "Jane",
      };

      mockQuery.mockResolvedValueOnce({
        rows: [{ ...existingUser, password_hash: "hash" }],
      }); // getById
      mockQuery.mockRejectedValueOnce(new Error("Database error")); // UPDATE

      await expect(
        fastify.user.update("550e8400-e29b-41d4-a716-446655440000", updateInput)
      ).rejects.toThrow("Database error");
    });
  });

  describe("delete", () => {
    const mockUser: UserPublic = {
      id: "550e8400-e29b-41d4-a716-446655440000",
      email: "test@example.com",
      first_name: "John",
      middle_name: null,
      last_name: "Doe",
      birthday: "1990-01-01",
      families: ["550e8400-e29b-41d4-a716-446655440001"],
      profile_picture_url: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    it("should delete user successfully", async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ ...mockUser, password_hash: "hash" }],
      }); // getById
      mockQuery.mockResolvedValueOnce({ rows: [] }); // DELETE

      await fastify.user.delete("550e8400-e29b-41d4-a716-446655440000");

      expect(mockQuery).toHaveBeenCalledWith(
        "DELETE FROM users WHERE id = $1",
        ["550e8400-e29b-41d4-a716-446655440000"]
      );
    });

    it("should throw error when user not found", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] }); // getById

      await expect(
        fastify.user.delete("550e8400-e29b-41d4-a716-446655440999")
      ).rejects.toThrow("User not found");
    });

    it("should throw error when database fails", async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ ...mockUser, password_hash: "hash" }],
      }); // getById
      mockQuery.mockRejectedValueOnce(new Error("Database error")); // DELETE

      await expect(
        fastify.user.delete("550e8400-e29b-41d4-a716-446655440000")
      ).rejects.toThrow("Database error");
    });
  });

  describe("validatePassword", () => {
    const mockUser: User = {
      id: "550e8400-e29b-41d4-a716-446655440000",
      email: "test@example.com",
      password_hash: "hashed-password",
      first_name: "John",
      middle_name: null,
      last_name: "Doe",
      birthday: "1990-01-01",
      families: ["550e8400-e29b-41d4-a716-446655440001"],
      profile_picture_url: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    it("should return true for valid password", async () => {
      mockArgon2.verify.mockResolvedValueOnce(true);

      const result = await fastify.user.validatePassword(
        mockUser,
        "correct-password"
      );

      expect(mockArgon2.verify).toHaveBeenCalledWith(
        "hashed-password",
        "correct-password"
      );
      expect(result).toBe(true);
    });

    it("should return false for invalid password", async () => {
      mockArgon2.verify.mockResolvedValueOnce(false);

      const result = await fastify.user.validatePassword(
        mockUser,
        "wrong-password"
      );

      expect(result).toBe(false);
    });

    it("should throw error when argon2 fails", async () => {
      mockArgon2.verify.mockRejectedValueOnce(new Error("Argon2 error"));

      await expect(
        fastify.user.validatePassword(mockUser, "password")
      ).rejects.toThrow("Failed to validate password");
    });
  });

  describe("updateSecurity", () => {
    const existingUser: User = {
      id: "550e8400-e29b-41d4-a716-446655440000",
      email: "test@example.com",
      password_hash: "old-hashed-password",
      first_name: "John",
      middle_name: null,
      last_name: "Doe",
      birthday: "1990-01-01",
      families: ["550e8400-e29b-41d4-a716-446655440001"],
      profile_picture_url: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    it("should update password successfully", async () => {
      const securityInput: SecurityUpdateInput = {
        current_password: "old-password",
        new_password: "new-password",
      };

      const updatedUser: User = {
        ...existingUser,
        password_hash: "new-hashed-password",
        updated_at: new Date().toISOString(),
      };

      mockQuery.mockResolvedValueOnce({ rows: [existingUser] }); // Get existing user
      mockArgon2.verify.mockResolvedValueOnce(true); // Validate current password
      mockArgon2.hash.mockResolvedValueOnce("new-hashed-password"); // Hash new password
      mockQuery.mockResolvedValueOnce({ rows: [updatedUser] }); // Update query

      const result = await fastify.user.updateSecurity(
        "550e8400-e29b-41d4-a716-446655440000",
        securityInput
      );

      expect(mockArgon2.verify).toHaveBeenCalledWith(
        "old-hashed-password",
        "old-password"
      );
      expect(mockArgon2.hash).toHaveBeenCalledWith("new-password");
      expect(mockRevokeUserTokens).toHaveBeenCalledWith(
        "550e8400-e29b-41d4-a716-446655440000"
      );
      expect(result).not.toHaveProperty("password_hash");
    });

    it("should throw error when user not found", async () => {
      const securityInput: SecurityUpdateInput = {
        new_password: "new-password",
      };

      mockQuery.mockResolvedValueOnce({ rows: [] }); // User not found

      await expect(
        fastify.user.updateSecurity(
          "550e8400-e29b-41d4-a716-446655440999",
          securityInput
        )
      ).rejects.toThrow("User not found");
    });

    it("should throw error when current password is required but not provided", async () => {
      const securityInput: SecurityUpdateInput = {
        new_password: "new-password",
      };

      mockQuery.mockResolvedValueOnce({ rows: [existingUser] });

      await expect(
        fastify.user.updateSecurity(
          "550e8400-e29b-41d4-a716-446655440000",
          securityInput
        )
      ).rejects.toThrow("Current password is required to change password");
    });

    it("should throw error when current password is incorrect", async () => {
      const securityInput: SecurityUpdateInput = {
        current_password: "wrong-password",
        new_password: "new-password",
      };

      mockQuery.mockResolvedValueOnce({ rows: [existingUser] });
      mockArgon2.verify.mockResolvedValueOnce(false); // Invalid current password

      await expect(
        fastify.user.updateSecurity(
          "550e8400-e29b-41d4-a716-446655440000",
          securityInput
        )
      ).rejects.toThrow("Current password is incorrect");
    });

    it("should return current user when no fields to update", async () => {
      const securityInput: SecurityUpdateInput = {};

      mockQuery.mockResolvedValueOnce({ rows: [existingUser] });

      const result = await fastify.user.updateSecurity(
        "550e8400-e29b-41d4-a716-446655440000",
        securityInput
      );

      expect(result).not.toHaveProperty("password_hash");
      expect(result?.id).toBe("550e8400-e29b-41d4-a716-446655440000");
    });

    it("should throw error when database fails", async () => {
      const securityInput: SecurityUpdateInput = {
        current_password: "old-password",
        new_password: "new-password",
      };

      mockQuery.mockResolvedValueOnce({ rows: [existingUser] });
      mockArgon2.verify.mockResolvedValueOnce(true);
      mockArgon2.hash.mockResolvedValueOnce("new-hashed-password");
      mockQuery.mockRejectedValueOnce(new Error("Database error"));

      await expect(
        fastify.user.updateSecurity(
          "550e8400-e29b-41d4-a716-446655440000",
          securityInput
        )
      ).rejects.toThrow("Database error");
    });
  });

  describe("addToFamily", () => {
    const mockUser: UserPublic = {
      id: "550e8400-e29b-41d4-a716-446655440000",
      email: "test@example.com",
      first_name: "John",
      middle_name: null,
      last_name: "Doe",
      birthday: "1990-01-01",
      families: ["550e8400-e29b-41d4-a716-446655440001"],
      profile_picture_url: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    it("should add user to family successfully", async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ ...mockUser, password_hash: "hash" }],
      }); // getById
      mockQuery.mockResolvedValueOnce({ rows: [] }); // UPDATE

      await fastify.user.addToFamily(
        "550e8400-e29b-41d4-a716-446655440000",
        "550e8400-e29b-41d4-a716-446655440002"
      );

      expect(mockQuery).toHaveBeenCalledWith(
        "UPDATE users SET families = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2",
        [
          [
            "550e8400-e29b-41d4-a716-446655440001",
            "550e8400-e29b-41d4-a716-446655440002",
          ],
          "550e8400-e29b-41d4-a716-446655440000",
        ]
      );
    });

    it("should not add user if already in family", async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ ...mockUser, password_hash: "hash" }],
      }); // getById

      await fastify.user.addToFamily(
        "550e8400-e29b-41d4-a716-446655440000",
        "550e8400-e29b-41d4-a716-446655440001"
      );

      // Should not call update query since user is already in family
      expect(mockQuery).toHaveBeenCalledTimes(1);
    });

    it("should throw error when user not found", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] }); // getById

      await expect(
        fastify.user.addToFamily(
          "550e8400-e29b-41d4-a716-446655440999",
          "550e8400-e29b-41d4-a716-446655440001"
        )
      ).rejects.toThrow("User not found");
    });

    it("should throw error when database fails", async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ ...mockUser, password_hash: "hash" }],
      }); // getById
      mockQuery.mockRejectedValueOnce(new Error("Database error")); // UPDATE

      await expect(
        fastify.user.addToFamily(
          "550e8400-e29b-41d4-a716-446655440000",
          "550e8400-e29b-41d4-a716-446655440002"
        )
      ).rejects.toThrow("Database error");
    });
  });

  describe("removeFromFamily", () => {
    const mockUser: UserPublic = {
      id: "550e8400-e29b-41d4-a716-446655440000",
      email: "test@example.com",
      first_name: "John",
      middle_name: null,
      last_name: "Doe",
      birthday: "1990-01-01",
      families: [
        "550e8400-e29b-41d4-a716-446655440001",
        "550e8400-e29b-41d4-a716-446655440002",
      ],
      profile_picture_url: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    it("should remove user from family successfully", async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ ...mockUser, password_hash: "hash" }],
      }); // getById
      mockQuery.mockResolvedValueOnce({ rows: [] }); // UPDATE

      await fastify.user.removeFromFamily(
        "550e8400-e29b-41d4-a716-446655440000",
        "550e8400-e29b-41d4-a716-446655440001"
      );

      expect(mockQuery).toHaveBeenCalledWith(
        "UPDATE users SET families = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2",
        [
          ["550e8400-e29b-41d4-a716-446655440002"],
          "550e8400-e29b-41d4-a716-446655440000",
        ]
      );
    });

    it("should handle removing non-existent family gracefully", async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ ...mockUser, password_hash: "hash" }],
      }); // getById
      mockQuery.mockResolvedValueOnce({ rows: [] }); // UPDATE

      await fastify.user.removeFromFamily(
        "550e8400-e29b-41d4-a716-446655440000",
        "550e8400-e29b-41d4-a716-446655440003"
      );

      expect(mockQuery).toHaveBeenCalledWith(
        "UPDATE users SET families = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2",
        [
          [
            "550e8400-e29b-41d4-a716-446655440001",
            "550e8400-e29b-41d4-a716-446655440002",
          ],
          "550e8400-e29b-41d4-a716-446655440000",
        ]
      );
    });

    it("should throw error when user not found", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] }); // getById

      await expect(
        fastify.user.removeFromFamily(
          "550e8400-e29b-41d4-a716-446655440999",
          "550e8400-e29b-41d4-a716-446655440001"
        )
      ).rejects.toThrow("User not found");
    });

    it("should throw error when database fails", async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ ...mockUser, password_hash: "hash" }],
      }); // getById
      mockQuery.mockRejectedValueOnce(new Error("Database error")); // UPDATE

      await expect(
        fastify.user.removeFromFamily(
          "550e8400-e29b-41d4-a716-446655440000",
          "550e8400-e29b-41d4-a716-446655440001"
        )
      ).rejects.toThrow("Database error");
    });
  });

  describe("Error Handling", () => {
    it("should throw error if postgres plugin is not registered", async () => {
      const newFastify = Fastify({ logger: false });

      await expect(newFastify.register(userPlugin)).rejects.toThrow(
        "fastify-postgres must be registered before this plugin"
      );

      await newFastify.close();
    });
  });
});

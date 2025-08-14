import Fastify, { FastifyInstance } from "fastify";
import familyPlugin from "./family.plugin";
import {
  Family,
  FamilyInput,
  FamilyUpdate,
  RelatedFamily,
} from "../types/family.types";
import { S3Key } from "../types/s3.types";
import { TEST_UUIDS, generateTestS3Key } from "../test-utils/test-data";

// Mock the postgres query function
const mockQuery = jest.fn();

// Mock the user plugin functions
const mockAddToFamily = jest.fn();
const mockRemoveFromFamily = jest.fn();

// Mock the image plugin functions
const mockGetOrphanedByFamily = jest.fn();

// Mock the S3 plugin functions
const mockS3Delete = jest.fn();

describe("Family Plugin", () => {
  let fastify: FastifyInstance;

  beforeEach(async () => {
    // Create a new Fastify instance for each test
    fastify = Fastify({ logger: false });

    // First decorate all the dependencies directly on the fastify instance
    fastify.decorate("pg", {
      query: mockQuery,
    } as any);

    fastify.decorate("user", {
      addToFamily: mockAddToFamily,
      removeFromFamily: mockRemoveFromFamily,
    } as any);

    fastify.decorate("image", {
      getOrphanedByFamily: mockGetOrphanedByFamily,
    } as any);

    fastify.decorate("s3", {
      delete: mockS3Delete,
    } as any);

    // Register family plugin
    await fastify.register(familyPlugin);

    // Wait for all plugins to be ready
    await fastify.ready();

    // Clear all mocks
    jest.clearAllMocks();
  });
  afterEach(async () => {
    await fastify.close();
  });

  describe("Plugin Registration", () => {
    it("should register family plugin successfully", async () => {
      expect(fastify.family).toBeDefined();
      expect(typeof fastify.family.create).toBe("function");
      expect(typeof fastify.family.get).toBe("function");
      expect(typeof fastify.family.getById).toBe("function");
      expect(typeof fastify.family.exists).toBe("function");
      expect(typeof fastify.family.getUserFamilies).toBe("function");
      expect(typeof fastify.family.getMembers).toBe("function");
      expect(typeof fastify.family.update).toBe("function");
      expect(typeof fastify.family.delete).toBe("function");
      expect(typeof fastify.family.addMember).toBe("function");
      expect(typeof fastify.family.removeMember).toBe("function");
      expect(typeof fastify.family.getRelatedFamilies).toBe("function");
      expect(typeof fastify.family.addRelatedFamily).toBe("function");
      expect(typeof fastify.family.removeRelatedFamily).toBe("function");
    });
  });

  describe("create", () => {
    it("should create a family successfully", async () => {
      const familyInput: FamilyInput = {
        name: "Test Family",
        related_families: [],
      };
      const ownerId = TEST_UUIDS.USER_1;
      const mockFamily: Family = {
        id: TEST_UUIDS.FAMILY_1,
        name: "Test Family",
        members: [ownerId],
        owner_id: ownerId,
        related_families: [],
        created_at: new Date().toISOString().split("T")[0],
        updated_at: new Date().toISOString().split("T")[0],
      };

      // Mock database responses
      mockQuery.mockResolvedValueOnce({ rows: [mockFamily] });
      mockQuery.mockResolvedValueOnce({ rows: [] }); // family_members insert
      mockAddToFamily.mockResolvedValueOnce(undefined);

      const result = await fastify.family.create(familyInput, ownerId);

      expect(mockQuery).toHaveBeenCalledTimes(2);
      expect(mockQuery).toHaveBeenNthCalledWith(
        1,
        "INSERT INTO families (name, members, owner_id, related_families) VALUES ($1, $2, $3, $4) RETURNING *",
        ["Test Family", [ownerId], ownerId, []]
      );
      expect(mockQuery).toHaveBeenNthCalledWith(
        2,
        "INSERT INTO family_members (family_id, user_id) VALUES ($1, $2)",
        [TEST_UUIDS.FAMILY_1, ownerId]
      );
      expect(mockAddToFamily).toHaveBeenCalledWith(ownerId, TEST_UUIDS.FAMILY_1);
      expect(result).toEqual({
        id: TEST_UUIDS.FAMILY_1,
        name: "Test Family",
        member_count: 1,
        owner_id: ownerId,
        user_role: "owner",
        related_families: [],
        created_at: mockFamily.created_at,
        updated_at: mockFamily.updated_at,
      });
    });

    it("should throw error when database fails", async () => {
      const familyInput: FamilyInput = {
        name: "Test Family",
        related_families: [],
      };
      const ownerId = TEST_UUIDS.USER_1;

      mockQuery.mockRejectedValueOnce(new Error("Database error"));

      await expect(fastify.family.create(familyInput, ownerId)).rejects.toThrow(
        "Database error"
      );
    });
  });

  describe("get", () => {
    it("should return all families", async () => {
      const mockFamilies: Family[] = [
        {
          id: TEST_UUIDS.FAMILY_1,
          name: "Family 1",
          members: [TEST_UUIDS.USER_1],
          owner_id: TEST_UUIDS.USER_1,
          related_families: [],
          created_at: new Date().toISOString().split("T")[0],
          updated_at: new Date().toISOString().split("T")[0],
        },
        {
          id: TEST_UUIDS.FAMILY_2,
          name: "Family 2",
          members: [TEST_UUIDS.USER_2],
          owner_id: TEST_UUIDS.USER_2,
          related_families: [],
          created_at: new Date().toISOString().split("T")[0],
          updated_at: new Date().toISOString().split("T")[0],
        },
      ];

      mockQuery.mockResolvedValueOnce({ rows: mockFamilies });

      const result = await fastify.family.get();

      expect(mockQuery).toHaveBeenCalledWith(
        "SELECT * FROM families ORDER BY created_at DESC"
      );
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe("Family 1");
      expect(result[1].name).toBe("Family 2");
    });

    it("should throw error when database fails", async () => {
      mockQuery.mockRejectedValueOnce(new Error("Database error"));

      await expect(fastify.family.get()).rejects.toThrow(
        "Failed to fetch families"
      );
    });
  });

  describe("getById", () => {
    it("should return family by ID", async () => {
      const mockFamily: Family = {
        id: TEST_UUIDS.FAMILY_1,
        name: "Test Family",
        members: [TEST_UUIDS.USER_1],
        owner_id: TEST_UUIDS.USER_1,
        related_families: [],
        created_at: new Date().toISOString().split("T")[0],
        updated_at: new Date().toISOString().split("T")[0],
      };

      mockQuery.mockResolvedValueOnce({ rows: [mockFamily] });

      const result = await fastify.family.getById(TEST_UUIDS.FAMILY_1);

      expect(mockQuery).toHaveBeenCalledWith(
        "SELECT * FROM families WHERE id = $1",
        [TEST_UUIDS.FAMILY_1]
      );
      expect(result).toEqual(mockFamily);
    });

    it("should return null when family not found", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const result = await fastify.family.getById(TEST_UUIDS.FAMILY_2);

      expect(result).toBeNull();
    });

    it("should throw error when database fails", async () => {
      mockQuery.mockRejectedValueOnce(new Error("Database error"));

      await expect(fastify.family.getById(TEST_UUIDS.FAMILY_1)).rejects.toThrow(
        "Failed to fetch family by ID"
      );
    });
  });

  describe("exists", () => {
    it("should return true when family exists", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ "1": 1 }] });

      const result = await fastify.family.exists(TEST_UUIDS.FAMILY_1);

      expect(mockQuery).toHaveBeenCalledWith(
        "SELECT 1 FROM families WHERE id = $1 LIMIT 1",
        [TEST_UUIDS.FAMILY_1]
      );
      expect(result).toBe(true);
    });

    it("should return false when family does not exist", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const result = await fastify.family.exists(TEST_UUIDS.FAMILY_2);

      expect(result).toBe(false);
    });

    it("should throw error when database fails", async () => {
      mockQuery.mockRejectedValueOnce(new Error("Database error"));

      await expect(fastify.family.exists(TEST_UUIDS.FAMILY_1)).rejects.toThrow(
        "Failed to check if family exists"
      );
    });
  });

  describe("getUserFamilies", () => {
    it("should return user families", async () => {
      const mockFamilies: Family[] = [
        {
          id: TEST_UUIDS.FAMILY_1,
          name: "Family 1",
          members: [TEST_UUIDS.USER_1],
          owner_id: TEST_UUIDS.USER_1,
          related_families: [],
          created_at: new Date().toISOString().split("T")[0],
          updated_at: new Date().toISOString().split("T")[0],
        },
      ];

      mockQuery.mockResolvedValueOnce({ rows: mockFamilies });

      const result = await fastify.family.getUserFamilies(TEST_UUIDS.USER_1);

      expect(mockQuery).toHaveBeenCalledWith(
        `SELECT f.* FROM families f 
           JOIN family_members fm ON f.id = fm.family_id 
           WHERE fm.user_id = $1 
           ORDER BY f.created_at DESC`,
        [TEST_UUIDS.USER_1]
      );
      expect(result).toHaveLength(1);
      expect(result[0].user_role).toBe("owner");
    });

    it("should throw error when database fails", async () => {
      mockQuery.mockRejectedValueOnce(new Error("Database error"));

      await expect(fastify.family.getUserFamilies(TEST_UUIDS.USER_1)).rejects.toThrow(
        "Failed to fetch user families"
      );
    });
  });

  describe("getMembers", () => {
    it("should return family members", async () => {
      const mockMembers = [
        {
          id: TEST_UUIDS.USER_1,
          email: "john@example.com",
          password_hash: "hashed_password_1",
          first_name: "John",
          middle_name: null,
          last_name: "Doe",
          birthday: new Date("1990-01-01"),
          families: [TEST_UUIDS.FAMILY_1],
          profile_picture_key: null,
          profile_picture_thumbnail_key:
            generateTestS3Key(TEST_UUIDS.USER_1, "thumbnail", TEST_UUIDS.S3_ID_1, "profile.jpg"),
          created_at: new Date("2023-01-01"),
          updated_at: new Date("2023-01-01"),
          owner_id: TEST_UUIDS.USER_1,
          joined_at: new Date(),
        },
        {
          id: TEST_UUIDS.USER_2,
          email: "jane@example.com",
          password_hash: "hashed_password_2",
          first_name: "Jane",
          middle_name: null,
          last_name: "Smith",
          birthday: null,
          families: [TEST_UUIDS.FAMILY_1],
          profile_picture_key: null,
          profile_picture_thumbnail_key: null,
          created_at: new Date("2023-01-02"),
          updated_at: new Date("2023-01-02"),
          owner_id: TEST_UUIDS.USER_1,
          joined_at: new Date(),
        },
      ];

      mockQuery.mockResolvedValueOnce({ rows: mockMembers });

      const result = await fastify.family.getMembers(TEST_UUIDS.FAMILY_1);

      expect(mockQuery).toHaveBeenCalledWith(
        `SELECT u.id, u.email, u.password_hash, u.first_name, u.middle_name, u.last_name, 
                  u.birthday, u.families, u.profile_picture_key, u.profile_picture_thumbnail_key, 
                  u.created_at, u.updated_at, f.owner_id, f.created_at as joined_at
           FROM users u
           JOIN family_members fm ON u.id = fm.user_id
           JOIN families f ON fm.family_id = f.id
           WHERE fm.family_id = $1
           ORDER BY u.first_name, u.last_name`,
        [TEST_UUIDS.FAMILY_1]
      );
      expect(result).toHaveLength(2);
      expect(result[0].role).toBe("owner");
      expect(result[1].role).toBe("member");
      expect(result[0].birthday).toBe("1990-01-01");
      expect(result[1].birthday).toBeNull();
      expect(result[0].profile_picture_thumbnail_key).toBe(
        generateTestS3Key(TEST_UUIDS.USER_1, "thumbnail", TEST_UUIDS.S3_ID_1, "profile.jpg")
      );
      expect(result[1].profile_picture_thumbnail_key).toBeNull();
    });

    it("should throw error when database fails", async () => {
      mockQuery.mockRejectedValueOnce(new Error("Database error"));

      await expect(fastify.family.getMembers(TEST_UUIDS.FAMILY_1)).rejects.toThrow(
        "Failed to fetch family members"
      );
    });
  });

  describe("update", () => {
    it("should update family successfully", async () => {
      const familyUpdate: FamilyUpdate = {
        name: "Updated Family",
      };
      const mockExistingFamily: Family = {
        id: TEST_UUIDS.FAMILY_1,
        name: "Original Family",
        members: [TEST_UUIDS.USER_1],
        owner_id: TEST_UUIDS.USER_1,
        related_families: [],
        created_at: new Date().toISOString().split("T")[0],
        updated_at: new Date().toISOString().split("T")[0],
      };
      const mockUpdatedFamily: Family = {
        ...mockExistingFamily,
        name: "Updated Family",
        updated_at: new Date().toISOString().split("T")[0],
      };

      // Mock getById call
      mockQuery.mockResolvedValueOnce({ rows: [mockExistingFamily] });
      // Mock update call
      mockQuery.mockResolvedValueOnce({ rows: [mockUpdatedFamily] });

      const result = await fastify.family.update(TEST_UUIDS.FAMILY_1, familyUpdate);

      expect(mockQuery).toHaveBeenCalledTimes(2);
      expect(mockQuery).toHaveBeenNthCalledWith(
        2,
        "UPDATE families SET name = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *",
        ["Updated Family", TEST_UUIDS.FAMILY_1]
      );
      expect(result).toEqual(mockUpdatedFamily);
    });

    it("should return null when family not found", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const result = await fastify.family.update(TEST_UUIDS.FAMILY_2, {
        name: "New Name",
      });

      expect(result).toBeNull();
    });

    it("should throw error when database fails", async () => {
      mockQuery.mockRejectedValueOnce(new Error("Database error"));

      await expect(
        fastify.family.update(TEST_UUIDS.FAMILY_1, { name: "New Name" })
      ).rejects.toThrow("Failed to fetch family by ID");
    });
  });

  describe("delete", () => {
    it("should delete family successfully", async () => {
      const mockFamily: Family = {
        id: TEST_UUIDS.FAMILY_1,
        name: "Test Family",
        members: [TEST_UUIDS.USER_1, TEST_UUIDS.USER_2],
        owner_id: TEST_UUIDS.USER_1,
        related_families: [],
        created_at: new Date().toISOString().split("T")[0],
        updated_at: new Date().toISOString().split("T")[0],
      };
      const mockOrphanedImages = [
        {
          id: TEST_UUIDS.IMAGE_1,
          original_key: TEST_UUIDS.USER_1 + "/original/" + TEST_UUIDS.S3_ID_1 + "/image1.jpg" as S3Key,
          thumbnail_key: TEST_UUIDS.USER_1 + "/thumbnail/" + TEST_UUIDS.S3_ID_1 + "/thumb_image1.jpg" as S3Key,
        },
      ];

      // Mock getById call
      mockQuery.mockResolvedValueOnce({ rows: [mockFamily] });
      // Mock getOrphanedByFamily
      mockGetOrphanedByFamily.mockResolvedValueOnce(mockOrphanedImages);
      // Mock image deletion
      mockQuery.mockResolvedValueOnce({ rows: [] });
      // Mock S3 deletion
      mockS3Delete.mockResolvedValueOnce(undefined);
      // Mock user removeFromFamily calls
      mockRemoveFromFamily.mockResolvedValue(undefined);
      // Mock family deletion
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await fastify.family.delete(TEST_UUIDS.FAMILY_1);

      expect(mockQuery).toHaveBeenCalledWith(
        "SELECT * FROM families WHERE id = $1",
        [TEST_UUIDS.FAMILY_1]
      );
      expect(mockGetOrphanedByFamily).toHaveBeenCalledWith(TEST_UUIDS.FAMILY_1);
      expect(mockS3Delete).toHaveBeenCalledWith(TEST_UUIDS.USER_1 + "/original/" + TEST_UUIDS.S3_ID_1 + "/image1.jpg");
      expect(mockS3Delete).toHaveBeenCalledWith(TEST_UUIDS.USER_1 + "/thumbnail/" + TEST_UUIDS.S3_ID_1 + "/thumb_image1.jpg");
      expect(mockQuery).toHaveBeenCalledWith(
        "DELETE FROM images WHERE id = $1",
        [TEST_UUIDS.IMAGE_1]
      );
      expect(mockRemoveFromFamily).toHaveBeenCalledTimes(2);
      expect(mockQuery).toHaveBeenCalledWith(
        "DELETE FROM families WHERE id = $1",
        [TEST_UUIDS.FAMILY_1]
      );
    });

    it("should throw error when family not found", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await expect(fastify.family.delete(TEST_UUIDS.FAMILY_2)).rejects.toThrow(
        "Family not found"
      );
    });

    it("should throw error when database fails", async () => {
      mockQuery.mockRejectedValueOnce(new Error("Database error"));

      await expect(fastify.family.delete(TEST_UUIDS.FAMILY_1)).rejects.toThrow(
        "Failed to fetch family by ID"
      );
    });
  });

  describe("addMember", () => {
    it("should add member successfully", async () => {
      const mockFamily: Family = {
        id: TEST_UUIDS.FAMILY_1,
        name: "Test Family",
        members: [TEST_UUIDS.USER_1],
        owner_id: TEST_UUIDS.USER_1,
        related_families: [],
        created_at: new Date().toISOString().split("T")[0],
        updated_at: new Date().toISOString().split("T")[0],
      };

      // Mock getById call
      mockQuery.mockResolvedValueOnce({ rows: [mockFamily] });
      // Mock family_members insert
      mockQuery.mockResolvedValueOnce({ rows: [] });
      // Mock families update
      mockQuery.mockResolvedValueOnce({ rows: [] });
      // Mock user addToFamily
      mockAddToFamily.mockResolvedValueOnce(undefined);

      await fastify.family.addMember(TEST_UUIDS.FAMILY_1, TEST_UUIDS.USER_2);

      expect(mockQuery).toHaveBeenCalledWith(
        "INSERT INTO family_members (family_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
        [TEST_UUIDS.FAMILY_1, TEST_UUIDS.USER_2]
      );
      expect(mockQuery).toHaveBeenCalledWith(
        "UPDATE families SET members = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2",
        [[TEST_UUIDS.USER_1, TEST_UUIDS.USER_2], TEST_UUIDS.FAMILY_1]
      );
      expect(mockAddToFamily).toHaveBeenCalledWith(TEST_UUIDS.USER_2, TEST_UUIDS.FAMILY_1);
    });

    it("should not add member if already a member", async () => {
      const mockFamily: Family = {
        id: TEST_UUIDS.FAMILY_1,
        name: "Test Family",
        members: [TEST_UUIDS.USER_1, TEST_UUIDS.USER_2],
        owner_id: TEST_UUIDS.USER_1,
        related_families: [],
        created_at: new Date().toISOString().split("T")[0],
        updated_at: new Date().toISOString().split("T")[0],
      };

      mockQuery.mockResolvedValueOnce({ rows: [mockFamily] });

      await fastify.family.addMember(TEST_UUIDS.FAMILY_1, TEST_UUIDS.USER_2);

      expect(mockQuery).toHaveBeenCalledTimes(1); // Only getById call
    });

    it("should throw error when family not found", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await expect(
        fastify.family.addMember(TEST_UUIDS.FAMILY_2, TEST_UUIDS.USER_2)
      ).rejects.toThrow("Family not found");
    });
  });

  describe("removeMember", () => {
    it("should remove member successfully", async () => {
      const mockFamily: Family = {
        id: TEST_UUIDS.FAMILY_1,
        name: "Test Family",
        members: [TEST_UUIDS.USER_1, TEST_UUIDS.USER_2],
        owner_id: TEST_UUIDS.USER_1,
        related_families: [],
        created_at: new Date().toISOString().split("T")[0],
        updated_at: new Date().toISOString().split("T")[0],
      };

      // Mock getById call
      mockQuery.mockResolvedValueOnce({ rows: [mockFamily] });
      // Mock family_members delete
      mockQuery.mockResolvedValueOnce({ rows: [] });
      // Mock families update
      mockQuery.mockResolvedValueOnce({ rows: [] });
      // Mock user removeFromFamily
      mockRemoveFromFamily.mockResolvedValueOnce(undefined);

      await fastify.family.removeMember(TEST_UUIDS.FAMILY_1, TEST_UUIDS.USER_2);

      expect(mockQuery).toHaveBeenCalledWith(
        "DELETE FROM family_members WHERE family_id = $1 AND user_id = $2",
        [TEST_UUIDS.FAMILY_1, TEST_UUIDS.USER_2]
      );
      expect(mockQuery).toHaveBeenCalledWith(
        "UPDATE families SET members = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2",
        [[TEST_UUIDS.USER_1], TEST_UUIDS.FAMILY_1]
      );
      expect(mockRemoveFromFamily).toHaveBeenCalledWith(TEST_UUIDS.USER_2, TEST_UUIDS.FAMILY_1);
    });

    it("should not remove owner", async () => {
      const mockFamily: Family = {
        id: TEST_UUIDS.FAMILY_1,
        name: "Test Family",
        members: [TEST_UUIDS.USER_1],
        owner_id: TEST_UUIDS.USER_1,
        related_families: [],
        created_at: new Date().toISOString().split("T")[0],
        updated_at: new Date().toISOString().split("T")[0],
      };

      mockQuery.mockResolvedValueOnce({ rows: [mockFamily] });

      await expect(
        fastify.family.removeMember(TEST_UUIDS.FAMILY_1, TEST_UUIDS.USER_1)
      ).rejects.toThrow("Cannot remove family owner");
    });

    it("should throw error when family not found", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await expect(
        fastify.family.removeMember(TEST_UUIDS.FAMILY_2, TEST_UUIDS.USER_2)
      ).rejects.toThrow("Family not found");
    });
  });

  describe("getRelatedFamilies", () => {
    it("should return related families", async () => {
      const mockRelatedFamilies: RelatedFamily[] = [
        {
          id: TEST_UUIDS.FAMILY_2,
          name: "Related Family",
          member_count: 3,
          created_at: new Date().toISOString().split("T")[0],
        },
      ];

      mockQuery.mockResolvedValueOnce({ rows: mockRelatedFamilies });

      const result = await fastify.family.getRelatedFamilies(TEST_UUIDS.FAMILY_1);

      expect(mockQuery).toHaveBeenCalledWith(
        `SELECT f.id, f.name, array_length(f.members, 1) as member_count, f.created_at
           FROM families f
           JOIN family_relations fr ON (f.id = fr.family_id_1 OR f.id = fr.family_id_2)
           WHERE (fr.family_id_1 = $1 OR fr.family_id_2 = $1) AND f.id != $1
           ORDER BY f.name`,
        [TEST_UUIDS.FAMILY_1]
      );
      expect(result).toEqual(mockRelatedFamilies);
    });

    it("should throw error when database fails", async () => {
      mockQuery.mockRejectedValueOnce(new Error("Database error"));

      await expect(
        fastify.family.getRelatedFamilies(TEST_UUIDS.FAMILY_1)
      ).rejects.toThrow("Failed to fetch related families");
    });
  });

  describe("addRelatedFamily", () => {
    it("should add related family successfully", async () => {
      const mockFamily1: Family = {
        id: TEST_UUIDS.FAMILY_1,
        name: "Family 1",
        members: [TEST_UUIDS.USER_1],
        owner_id: TEST_UUIDS.USER_1,
        related_families: [],
        created_at: new Date().toISOString().split("T")[0],
        updated_at: new Date().toISOString().split("T")[0],
      };
      const mockFamily2: Family = {
        id: TEST_UUIDS.FAMILY_2,
        name: "Family 2",
        members: [TEST_UUIDS.USER_2],
        owner_id: TEST_UUIDS.USER_2,
        related_families: [],
        created_at: new Date().toISOString().split("T")[0],
        updated_at: new Date().toISOString().split("T")[0],
      };

      // Mock getById calls
      mockQuery.mockResolvedValueOnce({ rows: [mockFamily1] });
      mockQuery.mockResolvedValueOnce({ rows: [mockFamily2] });
      // Mock relation check
      mockQuery.mockResolvedValueOnce({ rows: [] });
      // Mock relation insert
      mockQuery.mockResolvedValueOnce({ rows: [] });
      // Mock family updates
      mockQuery.mockResolvedValueOnce({ rows: [] });
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await fastify.family.addRelatedFamily(TEST_UUIDS.FAMILY_1, TEST_UUIDS.FAMILY_2);

      expect(mockQuery).toHaveBeenCalledWith(
        "INSERT INTO family_relations (family_id_1, family_id_2) VALUES ($1, $2)",
        [TEST_UUIDS.FAMILY_1, TEST_UUIDS.FAMILY_2]
      );
      expect(mockQuery).toHaveBeenCalledWith(
        "UPDATE families SET related_families = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2",
        [[TEST_UUIDS.FAMILY_2], TEST_UUIDS.FAMILY_1]
      );
      expect(mockQuery).toHaveBeenCalledWith(
        "UPDATE families SET related_families = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2",
        [[TEST_UUIDS.FAMILY_1], TEST_UUIDS.FAMILY_2]
      );
    });

    it("should throw error when trying to relate family to itself", async () => {
      const mockFamily: Family = {
        id: TEST_UUIDS.FAMILY_1,
        name: "Family 1",
        members: [TEST_UUIDS.USER_1],
        owner_id: TEST_UUIDS.USER_1,
        related_families: [],
        created_at: new Date().toISOString().split("T")[0],
        updated_at: new Date().toISOString().split("T")[0],
      };

      mockQuery.mockResolvedValueOnce({ rows: [mockFamily] });
      mockQuery.mockResolvedValueOnce({ rows: [mockFamily] });

      await expect(
        fastify.family.addRelatedFamily(TEST_UUIDS.FAMILY_1, TEST_UUIDS.FAMILY_1)
      ).rejects.toThrow("Cannot relate family to itself");
    });

    it("should throw error when families are already related", async () => {
      const mockFamily1: Family = {
        id: TEST_UUIDS.FAMILY_1,
        name: "Family 1",
        members: [TEST_UUIDS.USER_1],
        owner_id: TEST_UUIDS.USER_1,
        related_families: [],
        created_at: new Date().toISOString().split("T")[0],
        updated_at: new Date().toISOString().split("T")[0],
      };
      const mockFamily2: Family = {
        id: TEST_UUIDS.FAMILY_2,
        name: "Family 2",
        members: [TEST_UUIDS.USER_2],
        owner_id: TEST_UUIDS.USER_2,
        related_families: [],
        created_at: new Date().toISOString().split("T")[0],
        updated_at: new Date().toISOString().split("T")[0],
      };

      mockQuery.mockResolvedValueOnce({ rows: [mockFamily1] });
      mockQuery.mockResolvedValueOnce({ rows: [mockFamily2] });
      mockQuery.mockResolvedValueOnce({ rows: [{ "1": 1 }] });

      await expect(
        fastify.family.addRelatedFamily(TEST_UUIDS.FAMILY_1, TEST_UUIDS.FAMILY_2)
      ).rejects.toThrow("Families are already related");
    });
  });

  describe("removeRelatedFamily", () => {
    it("should remove related family successfully", async () => {
      const mockFamily1: Family = {
        id: TEST_UUIDS.FAMILY_1,
        name: "Family 1",
        members: [TEST_UUIDS.USER_1],
        owner_id: TEST_UUIDS.USER_1,
        related_families: [TEST_UUIDS.FAMILY_2],
        created_at: new Date().toISOString().split("T")[0],
        updated_at: new Date().toISOString().split("T")[0],
      };
      const mockFamily2: Family = {
        id: TEST_UUIDS.FAMILY_2,
        name: "Family 2",
        members: [TEST_UUIDS.USER_2],
        owner_id: TEST_UUIDS.USER_2,
        related_families: [TEST_UUIDS.FAMILY_1],
        created_at: new Date().toISOString().split("T")[0],
        updated_at: new Date().toISOString().split("T")[0],
      };

      // Mock relation delete
      mockQuery.mockResolvedValueOnce({ rows: [] });
      // Mock getById calls
      mockQuery.mockResolvedValueOnce({ rows: [mockFamily1] });
      mockQuery.mockResolvedValueOnce({ rows: [mockFamily2] });
      // Mock family updates
      mockQuery.mockResolvedValueOnce({ rows: [] });
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await fastify.family.removeRelatedFamily(TEST_UUIDS.FAMILY_1, TEST_UUIDS.FAMILY_2);

      expect(mockQuery).toHaveBeenCalledWith(
        `DELETE FROM family_relations 
           WHERE (family_id_1 = $1 AND family_id_2 = $2) 
              OR (family_id_1 = $2 AND family_id_2 = $1)`,
        [TEST_UUIDS.FAMILY_1, TEST_UUIDS.FAMILY_2]
      );
      expect(mockQuery).toHaveBeenCalledWith(
        "UPDATE families SET related_families = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2",
        [[], TEST_UUIDS.FAMILY_1]
      );
      expect(mockQuery).toHaveBeenCalledWith(
        "UPDATE families SET related_families = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2",
        [[], TEST_UUIDS.FAMILY_2]
      );
    });

    it("should throw error when database fails", async () => {
      mockQuery.mockRejectedValueOnce(new Error("Database error"));

      await expect(
        fastify.family.removeRelatedFamily(TEST_UUIDS.FAMILY_1, TEST_UUIDS.FAMILY_2)
      ).rejects.toThrow("Database error");
    });
  });
});

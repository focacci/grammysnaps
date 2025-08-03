import Fastify, { FastifyInstance } from "fastify";
import familyPlugin from "./family.plugin";
import {
  Family,
  FamilyInput,
  FamilyUpdate,
  RelatedFamily,
} from "../types/family.types";

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
      const ownerId = "owner-123";
      const mockFamily: Family = {
        id: "family-123",
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
        ["family-123", ownerId]
      );
      expect(mockAddToFamily).toHaveBeenCalledWith(ownerId, "family-123");
      expect(result).toEqual({
        id: "family-123",
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
      const ownerId = "owner-123";

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
          id: "family-1",
          name: "Family 1",
          members: ["user-1"],
          owner_id: "user-1",
          related_families: [],
          created_at: new Date().toISOString().split("T")[0],
          updated_at: new Date().toISOString().split("T")[0],
        },
        {
          id: "family-2",
          name: "Family 2",
          members: ["user-2"],
          owner_id: "user-2",
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
        id: "family-123",
        name: "Test Family",
        members: ["user-1"],
        owner_id: "user-1",
        related_families: [],
        created_at: new Date().toISOString().split("T")[0],
        updated_at: new Date().toISOString().split("T")[0],
      };

      mockQuery.mockResolvedValueOnce({ rows: [mockFamily] });

      const result = await fastify.family.getById("family-123");

      expect(mockQuery).toHaveBeenCalledWith(
        "SELECT * FROM families WHERE id = $1",
        ["family-123"]
      );
      expect(result).toEqual(mockFamily);
    });

    it("should return null when family not found", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const result = await fastify.family.getById("non-existent");

      expect(result).toBeNull();
    });

    it("should throw error when database fails", async () => {
      mockQuery.mockRejectedValueOnce(new Error("Database error"));

      await expect(fastify.family.getById("family-123")).rejects.toThrow(
        "Failed to fetch family by ID"
      );
    });
  });

  describe("exists", () => {
    it("should return true when family exists", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ "1": 1 }] });

      const result = await fastify.family.exists("family-123");

      expect(mockQuery).toHaveBeenCalledWith(
        "SELECT 1 FROM families WHERE id = $1 LIMIT 1",
        ["family-123"]
      );
      expect(result).toBe(true);
    });

    it("should return false when family does not exist", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const result = await fastify.family.exists("non-existent");

      expect(result).toBe(false);
    });

    it("should throw error when database fails", async () => {
      mockQuery.mockRejectedValueOnce(new Error("Database error"));

      await expect(fastify.family.exists("family-123")).rejects.toThrow(
        "Failed to check if family exists"
      );
    });
  });

  describe("getUserFamilies", () => {
    it("should return user families", async () => {
      const mockFamilies: Family[] = [
        {
          id: "family-1",
          name: "Family 1",
          members: ["user-1"],
          owner_id: "user-1",
          related_families: [],
          created_at: new Date().toISOString().split("T")[0],
          updated_at: new Date().toISOString().split("T")[0],
        },
      ];

      mockQuery.mockResolvedValueOnce({ rows: mockFamilies });

      const result = await fastify.family.getUserFamilies("user-1");

      expect(mockQuery).toHaveBeenCalledWith(
        `SELECT f.* FROM families f 
           JOIN family_members fm ON f.id = fm.family_id 
           WHERE fm.user_id = $1 
           ORDER BY f.created_at DESC`,
        ["user-1"]
      );
      expect(result).toHaveLength(1);
      expect(result[0].user_role).toBe("owner");
    });

    it("should throw error when database fails", async () => {
      mockQuery.mockRejectedValueOnce(new Error("Database error"));

      await expect(fastify.family.getUserFamilies("user-1")).rejects.toThrow(
        "Failed to fetch user families"
      );
    });
  });

  describe("getMembers", () => {
    it("should return family members", async () => {
      const mockMembers = [
        {
          id: "user-1",
          first_name: "John",
          last_name: "Doe",
          email: "john@example.com",
          birthday: new Date("1990-01-01"),
          profile_picture_thumbnail_url:
            "https://example.com/thumb_profile.jpg",
          owner_id: "user-1",
          joined_at: new Date(),
        },
        {
          id: "user-2",
          first_name: "Jane",
          last_name: "Smith",
          email: "jane@example.com",
          birthday: null,
          profile_picture_thumbnail_url: null,
          owner_id: "user-1",
          joined_at: new Date(),
        },
      ];

      mockQuery.mockResolvedValueOnce({ rows: mockMembers });

      const result = await fastify.family.getMembers("family-123");

      expect(mockQuery).toHaveBeenCalledWith(
        `SELECT u.id, u.first_name, u.last_name, u.email, u.birthday, u.profile_picture_thumbnail_url, f.owner_id,
                  f.created_at as joined_at
           FROM users u
           JOIN family_members fm ON u.id = fm.user_id
           JOIN families f ON fm.family_id = f.id
           WHERE fm.family_id = $1
           ORDER BY u.first_name, u.last_name`,
        ["family-123"]
      );
      expect(result).toHaveLength(2);
      expect(result[0].role).toBe("owner");
      expect(result[1].role).toBe("member");
      expect(result[0].birthday).toBe("1990-01-01");
      expect(result[1].birthday).toBeUndefined();
      expect(result[0].profile_picture_thumbnail_url).toBe(
        "https://example.com/thumb_profile.jpg"
      );
      expect(result[1].profile_picture_thumbnail_url).toBeNull();
    });

    it("should throw error when database fails", async () => {
      mockQuery.mockRejectedValueOnce(new Error("Database error"));

      await expect(fastify.family.getMembers("family-123")).rejects.toThrow(
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
        id: "family-123",
        name: "Original Family",
        members: ["user-1"],
        owner_id: "user-1",
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

      const result = await fastify.family.update("family-123", familyUpdate);

      expect(mockQuery).toHaveBeenCalledTimes(2);
      expect(mockQuery).toHaveBeenNthCalledWith(
        2,
        "UPDATE families SET name = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *",
        ["Updated Family", "family-123"]
      );
      expect(result).toEqual(mockUpdatedFamily);
    });

    it("should return null when family not found", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const result = await fastify.family.update("non-existent", {
        name: "New Name",
      });

      expect(result).toBeNull();
    });

    it("should throw error when database fails", async () => {
      mockQuery.mockRejectedValueOnce(new Error("Database error"));

      await expect(
        fastify.family.update("family-123", { name: "New Name" })
      ).rejects.toThrow("Failed to fetch family by ID");
    });
  });

  describe("delete", () => {
    it("should delete family successfully", async () => {
      const mockFamily: Family = {
        id: "family-123",
        name: "Test Family",
        members: ["user-1", "user-2"],
        owner_id: "user-1",
        related_families: [],
        created_at: new Date().toISOString().split("T")[0],
        updated_at: new Date().toISOString().split("T")[0],
      };
      const mockOrphanedImages = [
        {
          id: "image-1",
          original_url: "https://bucket.s3.amazonaws.com/image1.jpg",
          thumbnail_url: "https://bucket.s3.amazonaws.com/thumb_image1.jpg",
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

      await fastify.family.delete("family-123");

      expect(mockQuery).toHaveBeenCalledWith(
        "SELECT * FROM families WHERE id = $1",
        ["family-123"]
      );
      expect(mockGetOrphanedByFamily).toHaveBeenCalledWith("family-123");
      expect(mockS3Delete).toHaveBeenCalledWith("image1.jpg");
      expect(mockQuery).toHaveBeenCalledWith(
        "DELETE FROM images WHERE id = $1",
        ["image-1"]
      );
      expect(mockRemoveFromFamily).toHaveBeenCalledTimes(2);
      expect(mockQuery).toHaveBeenCalledWith(
        "DELETE FROM families WHERE id = $1",
        ["family-123"]
      );
    });

    it("should throw error when family not found", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await expect(fastify.family.delete("non-existent")).rejects.toThrow(
        "Family not found"
      );
    });

    it("should throw error when database fails", async () => {
      mockQuery.mockRejectedValueOnce(new Error("Database error"));

      await expect(fastify.family.delete("family-123")).rejects.toThrow(
        "Failed to fetch family by ID"
      );
    });
  });

  describe("addMember", () => {
    it("should add member successfully", async () => {
      const mockFamily: Family = {
        id: "family-123",
        name: "Test Family",
        members: ["user-1"],
        owner_id: "user-1",
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

      await fastify.family.addMember("family-123", "user-2");

      expect(mockQuery).toHaveBeenCalledWith(
        "INSERT INTO family_members (family_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
        ["family-123", "user-2"]
      );
      expect(mockQuery).toHaveBeenCalledWith(
        "UPDATE families SET members = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2",
        [["user-1", "user-2"], "family-123"]
      );
      expect(mockAddToFamily).toHaveBeenCalledWith("user-2", "family-123");
    });

    it("should not add member if already a member", async () => {
      const mockFamily: Family = {
        id: "family-123",
        name: "Test Family",
        members: ["user-1", "user-2"],
        owner_id: "user-1",
        related_families: [],
        created_at: new Date().toISOString().split("T")[0],
        updated_at: new Date().toISOString().split("T")[0],
      };

      mockQuery.mockResolvedValueOnce({ rows: [mockFamily] });

      await fastify.family.addMember("family-123", "user-2");

      expect(mockQuery).toHaveBeenCalledTimes(1); // Only getById call
    });

    it("should throw error when family not found", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await expect(
        fastify.family.addMember("non-existent", "user-2")
      ).rejects.toThrow("Family not found");
    });
  });

  describe("removeMember", () => {
    it("should remove member successfully", async () => {
      const mockFamily: Family = {
        id: "family-123",
        name: "Test Family",
        members: ["user-1", "user-2"],
        owner_id: "user-1",
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

      await fastify.family.removeMember("family-123", "user-2");

      expect(mockQuery).toHaveBeenCalledWith(
        "DELETE FROM family_members WHERE family_id = $1 AND user_id = $2",
        ["family-123", "user-2"]
      );
      expect(mockQuery).toHaveBeenCalledWith(
        "UPDATE families SET members = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2",
        [["user-1"], "family-123"]
      );
      expect(mockRemoveFromFamily).toHaveBeenCalledWith("user-2", "family-123");
    });

    it("should not remove owner", async () => {
      const mockFamily: Family = {
        id: "family-123",
        name: "Test Family",
        members: ["user-1"],
        owner_id: "user-1",
        related_families: [],
        created_at: new Date().toISOString().split("T")[0],
        updated_at: new Date().toISOString().split("T")[0],
      };

      mockQuery.mockResolvedValueOnce({ rows: [mockFamily] });

      await expect(
        fastify.family.removeMember("family-123", "user-1")
      ).rejects.toThrow("Cannot remove family owner");
    });

    it("should throw error when family not found", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await expect(
        fastify.family.removeMember("non-existent", "user-2")
      ).rejects.toThrow("Family not found");
    });
  });

  describe("getRelatedFamilies", () => {
    it("should return related families", async () => {
      const mockRelatedFamilies: RelatedFamily[] = [
        {
          id: "family-2",
          name: "Related Family",
          member_count: 3,
          created_at: new Date().toISOString().split("T")[0],
        },
      ];

      mockQuery.mockResolvedValueOnce({ rows: mockRelatedFamilies });

      const result = await fastify.family.getRelatedFamilies("family-1");

      expect(mockQuery).toHaveBeenCalledWith(
        `SELECT f.id, f.name, array_length(f.members, 1) as member_count, f.created_at
           FROM families f
           JOIN family_relations fr ON (f.id = fr.family_id_1 OR f.id = fr.family_id_2)
           WHERE (fr.family_id_1 = $1 OR fr.family_id_2 = $1) AND f.id != $1
           ORDER BY f.name`,
        ["family-1"]
      );
      expect(result).toEqual(mockRelatedFamilies);
    });

    it("should throw error when database fails", async () => {
      mockQuery.mockRejectedValueOnce(new Error("Database error"));

      await expect(
        fastify.family.getRelatedFamilies("family-1")
      ).rejects.toThrow("Failed to fetch related families");
    });
  });

  describe("addRelatedFamily", () => {
    it("should add related family successfully", async () => {
      const mockFamily1: Family = {
        id: "family-1",
        name: "Family 1",
        members: ["user-1"],
        owner_id: "user-1",
        related_families: [],
        created_at: new Date().toISOString().split("T")[0],
        updated_at: new Date().toISOString().split("T")[0],
      };
      const mockFamily2: Family = {
        id: "family-2",
        name: "Family 2",
        members: ["user-2"],
        owner_id: "user-2",
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

      await fastify.family.addRelatedFamily("family-1", "family-2");

      expect(mockQuery).toHaveBeenCalledWith(
        "INSERT INTO family_relations (family_id_1, family_id_2) VALUES ($1, $2)",
        ["family-1", "family-2"]
      );
      expect(mockQuery).toHaveBeenCalledWith(
        "UPDATE families SET related_families = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2",
        [["family-2"], "family-1"]
      );
      expect(mockQuery).toHaveBeenCalledWith(
        "UPDATE families SET related_families = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2",
        [["family-1"], "family-2"]
      );
    });

    it("should throw error when trying to relate family to itself", async () => {
      const mockFamily: Family = {
        id: "family-1",
        name: "Family 1",
        members: ["user-1"],
        owner_id: "user-1",
        related_families: [],
        created_at: new Date().toISOString().split("T")[0],
        updated_at: new Date().toISOString().split("T")[0],
      };

      mockQuery.mockResolvedValueOnce({ rows: [mockFamily] });
      mockQuery.mockResolvedValueOnce({ rows: [mockFamily] });

      await expect(
        fastify.family.addRelatedFamily("family-1", "family-1")
      ).rejects.toThrow("Cannot relate family to itself");
    });

    it("should throw error when families are already related", async () => {
      const mockFamily1: Family = {
        id: "family-1",
        name: "Family 1",
        members: ["user-1"],
        owner_id: "user-1",
        related_families: [],
        created_at: new Date().toISOString().split("T")[0],
        updated_at: new Date().toISOString().split("T")[0],
      };
      const mockFamily2: Family = {
        id: "family-2",
        name: "Family 2",
        members: ["user-2"],
        owner_id: "user-2",
        related_families: [],
        created_at: new Date().toISOString().split("T")[0],
        updated_at: new Date().toISOString().split("T")[0],
      };

      mockQuery.mockResolvedValueOnce({ rows: [mockFamily1] });
      mockQuery.mockResolvedValueOnce({ rows: [mockFamily2] });
      mockQuery.mockResolvedValueOnce({ rows: [{ "1": 1 }] });

      await expect(
        fastify.family.addRelatedFamily("family-1", "family-2")
      ).rejects.toThrow("Families are already related");
    });
  });

  describe("removeRelatedFamily", () => {
    it("should remove related family successfully", async () => {
      const mockFamily1: Family = {
        id: "family-1",
        name: "Family 1",
        members: ["user-1"],
        owner_id: "user-1",
        related_families: ["family-2"],
        created_at: new Date().toISOString().split("T")[0],
        updated_at: new Date().toISOString().split("T")[0],
      };
      const mockFamily2: Family = {
        id: "family-2",
        name: "Family 2",
        members: ["user-2"],
        owner_id: "user-2",
        related_families: ["family-1"],
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

      await fastify.family.removeRelatedFamily("family-1", "family-2");

      expect(mockQuery).toHaveBeenCalledWith(
        `DELETE FROM family_relations 
           WHERE (family_id_1 = $1 AND family_id_2 = $2) 
              OR (family_id_1 = $2 AND family_id_2 = $1)`,
        ["family-1", "family-2"]
      );
      expect(mockQuery).toHaveBeenCalledWith(
        "UPDATE families SET related_families = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2",
        [[], "family-1"]
      );
      expect(mockQuery).toHaveBeenCalledWith(
        "UPDATE families SET related_families = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2",
        [[], "family-2"]
      );
    });

    it("should throw error when database fails", async () => {
      mockQuery.mockRejectedValueOnce(new Error("Database error"));

      await expect(
        fastify.family.removeRelatedFamily("family-1", "family-2")
      ).rejects.toThrow("Database error");
    });
  });
});

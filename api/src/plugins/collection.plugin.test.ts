import Fastify, { FastifyInstance } from "fastify";
import collectionPlugin from "./collection.plugin";
import {
  Collection,
  CollectionInput,
  CollectionUpdate,
  RelatedCollection,
} from "../types/collection.types";
import { S3Key } from "../types/s3.types";
import { TEST_UUIDS, generateTestS3Key } from "../test-utils/test-data";

// Mock the postgres query function
const mockQuery = jest.fn();

// Mock the user plugin functions
const mockAddToCollection = jest.fn();
const mockRemoveFromCollection = jest.fn();

// Mock the image plugin functions
const mockGetOrphanedByCollection = jest.fn();

// Mock the S3 plugin functions
const mockS3Delete = jest.fn();

describe("Collection Plugin", () => {
  let fastify: FastifyInstance;

  beforeEach(async () => {
    // Create a new Fastify instance for each test
    fastify = Fastify({ logger: false });

    // First decorate all the dependencies directly on the fastify instance
    fastify.decorate("pg", {
      query: mockQuery,
    } as any);

    fastify.decorate("user", {
      addToCollection: mockAddToCollection,
      removeFromCollection: mockRemoveFromCollection,
    } as any);

    fastify.decorate("image", {
      getOrphanedByCollection: mockGetOrphanedByCollection,
    } as any);

    fastify.decorate("s3", {
      delete: mockS3Delete,
    } as any);

    // Register collection plugin
    await fastify.register(collectionPlugin);

    // Wait for all plugins to be ready
    await fastify.ready();

    // Clear all mocks
    jest.clearAllMocks();
  });
  afterEach(async () => {
    await fastify.close();
  });

  describe("Plugin Registration", () => {
    it("should register collection plugin successfully", async () => {
      expect(fastify.collection).toBeDefined();
      expect(typeof fastify.collection.create).toBe("function");
      expect(typeof fastify.collection.get).toBe("function");
      expect(typeof fastify.collection.getById).toBe("function");
      expect(typeof fastify.collection.exists).toBe("function");
      expect(typeof fastify.collection.getUserCollections).toBe("function");
      expect(typeof fastify.collection.getMembers).toBe("function");
      expect(typeof fastify.collection.update).toBe("function");
      expect(typeof fastify.collection.delete).toBe("function");
      expect(typeof fastify.collection.addMember).toBe("function");
      expect(typeof fastify.collection.removeMember).toBe("function");
      expect(typeof fastify.collection.getRelatedCollections).toBe("function");
      expect(typeof fastify.collection.addRelatedCollection).toBe("function");
      expect(typeof fastify.collection.removeRelatedCollection).toBe("function");
    });
  });

  describe("create", () => {
    it("should create a collection successfully", async () => {
      const collectionInput: CollectionInput = {
        name: "Test Collection",
        related_collections: [],
      };
      const ownerId = TEST_UUIDS.USER_1;
      const mockCollection: Collection = {
        id: TEST_UUIDS.COLLECTION_1,
        name: "Test Collection",
        members: [ownerId],
        owner_id: ownerId,
        related_collections: [],
        created_at: new Date().toISOString().split("T")[0],
        updated_at: new Date().toISOString().split("T")[0],
      };

      // Mock database responses
      mockQuery.mockResolvedValueOnce({ rows: [mockCollection] });
      mockQuery.mockResolvedValueOnce({ rows: [] }); // collection_members insert
      mockAddToCollection.mockResolvedValueOnce(undefined);

      const result = await fastify.collection.create(collectionInput, ownerId);

      expect(mockQuery).toHaveBeenCalledTimes(2);
      expect(mockQuery).toHaveBeenNthCalledWith(
        1,
        "INSERT INTO collections (name, members, owner_id, related_collections) VALUES ($1, $2, $3, $4) RETURNING *",
        ["Test Collection", [ownerId], ownerId, []]
      );
      expect(mockQuery).toHaveBeenNthCalledWith(
        2,
        "INSERT INTO collection_members (collection_id, user_id) VALUES ($1, $2)",
        [TEST_UUIDS.COLLECTION_1, ownerId]
      );
      expect(mockAddToCollection).toHaveBeenCalledWith(ownerId, TEST_UUIDS.COLLECTION_1);
      expect(result).toEqual({
        id: TEST_UUIDS.COLLECTION_1,
        name: "Test Collection",
        member_count: 1,
        owner_id: ownerId,
        user_role: "owner",
        related_collections: [],
        created_at: mockCollection.created_at,
        updated_at: mockCollection.updated_at,
      });
    });

    it("should throw error when database fails", async () => {
      const collectionInput: CollectionInput = {
        name: "Test Collection",
        related_collections: [],
      };
      const ownerId = TEST_UUIDS.USER_1;

      mockQuery.mockRejectedValueOnce(new Error("Database error"));

      await expect(fastify.collection.create(collectionInput, ownerId)).rejects.toThrow(
        "Database error"
      );
    });
  });

  describe("get", () => {
    it("should return all collections", async () => {
      const mockCollections: Collection[] = [
        {
          id: TEST_UUIDS.COLLECTION_1,
          name: "Collection 1",
          members: [TEST_UUIDS.USER_1],
          owner_id: TEST_UUIDS.USER_1,
          related_collections: [],
          created_at: new Date().toISOString().split("T")[0],
          updated_at: new Date().toISOString().split("T")[0],
        },
        {
          id: TEST_UUIDS.COLLECTION_2,
          name: "Collection 2",
          members: [TEST_UUIDS.USER_2],
          owner_id: TEST_UUIDS.USER_2,
          related_collections: [],
          created_at: new Date().toISOString().split("T")[0],
          updated_at: new Date().toISOString().split("T")[0],
        },
      ];

      mockQuery.mockResolvedValueOnce({ rows: mockCollections });

      const result = await fastify.collection.get();

      expect(mockQuery).toHaveBeenCalledWith(
        "SELECT * FROM collections ORDER BY created_at DESC"
      );
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe("Collection 1");
      expect(result[1].name).toBe("Collection 2");
    });

    it("should throw error when database fails", async () => {
      mockQuery.mockRejectedValueOnce(new Error("Database error"));

      await expect(fastify.collection.get()).rejects.toThrow(
        "Failed to fetch collections"
      );
    });
  });

  describe("getById", () => {
    it("should return collection by ID", async () => {
      const mockCollection: Collection = {
        id: TEST_UUIDS.COLLECTION_1,
        name: "Test Collection",
        members: [TEST_UUIDS.USER_1],
        owner_id: TEST_UUIDS.USER_1,
        related_collections: [],
        created_at: new Date().toISOString().split("T")[0],
        updated_at: new Date().toISOString().split("T")[0],
      };

      mockQuery.mockResolvedValueOnce({ rows: [mockCollection] });

      const result = await fastify.collection.getById(TEST_UUIDS.COLLECTION_1);

      expect(mockQuery).toHaveBeenCalledWith(
        "SELECT * FROM collections WHERE id = $1",
        [TEST_UUIDS.COLLECTION_1]
      );
      expect(result).toEqual(mockCollection);
    });

    it("should return null when collection not found", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const result = await fastify.collection.getById(TEST_UUIDS.COLLECTION_2);

      expect(result).toBeNull();
    });

    it("should throw error when database fails", async () => {
      mockQuery.mockRejectedValueOnce(new Error("Database error"));

      await expect(fastify.collection.getById(TEST_UUIDS.COLLECTION_1)).rejects.toThrow(
        "Failed to fetch collection by ID"
      );
    });
  });

  describe("exists", () => {
    it("should return true when collection exists", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ "1": 1 }] });

      const result = await fastify.collection.exists(TEST_UUIDS.COLLECTION_1);

      expect(mockQuery).toHaveBeenCalledWith(
        "SELECT 1 FROM collections WHERE id = $1 LIMIT 1",
        [TEST_UUIDS.COLLECTION_1]
      );
      expect(result).toBe(true);
    });

    it("should return false when collection does not exist", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const result = await fastify.collection.exists(TEST_UUIDS.COLLECTION_2);

      expect(result).toBe(false);
    });

    it("should throw error when database fails", async () => {
      mockQuery.mockRejectedValueOnce(new Error("Database error"));

      await expect(fastify.collection.exists(TEST_UUIDS.COLLECTION_1)).rejects.toThrow(
        "Failed to check if collection exists"
      );
    });
  });

  describe("getUserCollections", () => {
    it("should return user collections", async () => {
      const mockCollections: Collection[] = [
        {
          id: TEST_UUIDS.COLLECTION_1,
          name: "Collection 1",
          members: [TEST_UUIDS.USER_1],
          owner_id: TEST_UUIDS.USER_1,
          related_collections: [],
          created_at: new Date().toISOString().split("T")[0],
          updated_at: new Date().toISOString().split("T")[0],
        },
      ];

      mockQuery.mockResolvedValueOnce({ rows: mockCollections });

      const result = await fastify.collection.getUserCollections(TEST_UUIDS.USER_1);

      expect(mockQuery).toHaveBeenCalledWith(
        `SELECT f.* FROM collections f
           JOIN collection_members fm ON f.id = fm.collection_id
           WHERE fm.user_id = $1
           ORDER BY f.created_at DESC`,
        [TEST_UUIDS.USER_1]
      );
      expect(result).toHaveLength(1);
      expect(result[0].user_role).toBe("owner");
    });

    it("should throw error when database fails", async () => {
      mockQuery.mockRejectedValueOnce(new Error("Database error"));

      await expect(fastify.collection.getUserCollections(TEST_UUIDS.USER_1)).rejects.toThrow(
        "Failed to fetch user collections"
      );
    });
  });

  describe("getMembers", () => {
    it("should return collection members", async () => {
      const mockMembers = [
        {
          id: TEST_UUIDS.USER_1,
          email: "john@example.com",
          password_hash: "hashed_password_1",
          first_name: "John",
          middle_name: null,
          last_name: "Doe",
          birthday: new Date("1990-01-01"),
          collections: [TEST_UUIDS.COLLECTION_1],
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
          collections: [TEST_UUIDS.COLLECTION_1],
          profile_picture_key: null,
          profile_picture_thumbnail_key: null,
          created_at: new Date("2023-01-02"),
          updated_at: new Date("2023-01-02"),
          owner_id: TEST_UUIDS.USER_1,
          joined_at: new Date(),
        },
      ];

      mockQuery.mockResolvedValueOnce({ rows: mockMembers });

      const result = await fastify.collection.getMembers(TEST_UUIDS.COLLECTION_1);

      expect(mockQuery).toHaveBeenCalledWith(
        `SELECT u.id, u.email, u.password_hash, u.first_name, u.middle_name, u.last_name, 
                  u.birthday, u.collections, u.profile_picture_key, u.profile_picture_thumbnail_key, 
                  u.created_at, u.updated_at, f.owner_id, f.created_at as joined_at
           FROM users u
           JOIN collection_members fm ON u.id = fm.user_id
           JOIN collections f ON fm.collection_id = f.id
           WHERE fm.collection_id = $1
           ORDER BY u.first_name, u.last_name`,
        [TEST_UUIDS.COLLECTION_1]
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

      await expect(fastify.collection.getMembers(TEST_UUIDS.COLLECTION_1)).rejects.toThrow(
        "Failed to fetch collection members"
      );
    });
  });

  describe("update", () => {
    it("should update collection successfully", async () => {
      const collectionUpdate: CollectionUpdate = {
        name: "Updated Collection",
      };
      const mockExistingCollection: Collection = {
        id: TEST_UUIDS.COLLECTION_1,
        name: "Original Collection",
        members: [TEST_UUIDS.USER_1],
        owner_id: TEST_UUIDS.USER_1,
        related_collections: [],
        created_at: new Date().toISOString().split("T")[0],
        updated_at: new Date().toISOString().split("T")[0],
      };
      const mockUpdatedCollection: Collection = {
        ...mockExistingCollection,
        name: "Updated Collection",
        updated_at: new Date().toISOString().split("T")[0],
      };

      // Mock getById call
      mockQuery.mockResolvedValueOnce({ rows: [mockExistingCollection] });
      // Mock update call
      mockQuery.mockResolvedValueOnce({ rows: [mockUpdatedCollection] });

      const result = await fastify.collection.update(TEST_UUIDS.COLLECTION_1, collectionUpdate);

      expect(mockQuery).toHaveBeenCalledTimes(2);
      expect(mockQuery).toHaveBeenNthCalledWith(
        2,
        "UPDATE collections SET name = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *",
        ["Updated Collection", TEST_UUIDS.COLLECTION_1]
      );
      expect(result).toEqual(mockUpdatedCollection);
    });

    it("should return null when collection not found", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const result = await fastify.collection.update(TEST_UUIDS.COLLECTION_2, {
        name: "New Name",
      });

      expect(result).toBeNull();
    });

    it("should throw error when database fails", async () => {
      mockQuery.mockRejectedValueOnce(new Error("Database error"));

      await expect(
        fastify.collection.update(TEST_UUIDS.COLLECTION_1, { name: "New Name" })
      ).rejects.toThrow("Failed to fetch collection by ID");
    });
  });

  describe("delete", () => {
    it("should delete collection successfully", async () => {
      const mockCollection: Collection = {
        id: TEST_UUIDS.COLLECTION_1,
        name: "Test Collection",
        members: [TEST_UUIDS.USER_1, TEST_UUIDS.USER_2],
        owner_id: TEST_UUIDS.USER_1,
        related_collections: [],
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
      mockQuery.mockResolvedValueOnce({ rows: [mockCollection] });
      // Mock getOrphanedByCollection
      mockGetOrphanedByCollection.mockResolvedValueOnce(mockOrphanedImages);
      // Mock image deletion
      mockQuery.mockResolvedValueOnce({ rows: [] });
      // Mock S3 deletion
      mockS3Delete.mockResolvedValueOnce(undefined);
      // Mock user removeFromCollection calls
      mockRemoveFromCollection.mockResolvedValue(undefined);
      // Mock collection deletion
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await fastify.collection.delete(TEST_UUIDS.COLLECTION_1);

      expect(mockQuery).toHaveBeenCalledWith(
        "SELECT * FROM collections WHERE id = $1",
        [TEST_UUIDS.COLLECTION_1]
      );
      expect(mockGetOrphanedByCollection).toHaveBeenCalledWith(TEST_UUIDS.COLLECTION_1);
      expect(mockS3Delete).toHaveBeenCalledWith(TEST_UUIDS.USER_1 + "/original/" + TEST_UUIDS.S3_ID_1 + "/image1.jpg");
      expect(mockS3Delete).toHaveBeenCalledWith(TEST_UUIDS.USER_1 + "/thumbnail/" + TEST_UUIDS.S3_ID_1 + "/thumb_image1.jpg");
      expect(mockQuery).toHaveBeenCalledWith(
        "DELETE FROM images WHERE id = $1",
        [TEST_UUIDS.IMAGE_1]
      );
      expect(mockRemoveFromCollection).toHaveBeenCalledTimes(2);
      expect(mockQuery).toHaveBeenCalledWith(
        "DELETE FROM collections WHERE id = $1",
        [TEST_UUIDS.COLLECTION_1]
      );
    });

    it("should throw error when collection not found", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await expect(fastify.collection.delete(TEST_UUIDS.COLLECTION_2)).rejects.toThrow(
        "Collection not found"
      );
    });

    it("should throw error when database fails", async () => {
      mockQuery.mockRejectedValueOnce(new Error("Database error"));

      await expect(fastify.collection.delete(TEST_UUIDS.COLLECTION_1)).rejects.toThrow(
        "Failed to fetch collection by ID"
      );
    });
  });

  describe("addMember", () => {
    it("should add member successfully", async () => {
      const mockCollection: Collection = {
        id: TEST_UUIDS.COLLECTION_1,
        name: "Test Collection",
        members: [TEST_UUIDS.USER_1],
        owner_id: TEST_UUIDS.USER_1,
        related_collections: [],
        created_at: new Date().toISOString().split("T")[0],
        updated_at: new Date().toISOString().split("T")[0],
      };

      // Mock getById call
      mockQuery.mockResolvedValueOnce({ rows: [mockCollection] });
      // Mock collection_members insert
      mockQuery.mockResolvedValueOnce({ rows: [] });
      // Mock collections update
      mockQuery.mockResolvedValueOnce({ rows: [] });
      // Mock user addToCollection
      mockAddToCollection.mockResolvedValueOnce(undefined);

      await fastify.collection.addMember(TEST_UUIDS.COLLECTION_1, TEST_UUIDS.USER_2);

      expect(mockQuery).toHaveBeenCalledWith(
        "INSERT INTO collection_members (collection_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
        [TEST_UUIDS.COLLECTION_1, TEST_UUIDS.USER_2]
      );
      expect(mockQuery).toHaveBeenCalledWith(
        "UPDATE collections SET members = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2",
        [[TEST_UUIDS.USER_1, TEST_UUIDS.USER_2], TEST_UUIDS.COLLECTION_1]
      );
      expect(mockAddToCollection).toHaveBeenCalledWith(TEST_UUIDS.USER_2, TEST_UUIDS.COLLECTION_1);
    });

    it("should not add member if already a member", async () => {
      const mockCollection: Collection = {
        id: TEST_UUIDS.COLLECTION_1,
        name: "Test Collection",
        members: [TEST_UUIDS.USER_1, TEST_UUIDS.USER_2],
        owner_id: TEST_UUIDS.USER_1,
        related_collections: [],
        created_at: new Date().toISOString().split("T")[0],
        updated_at: new Date().toISOString().split("T")[0],
      };

      mockQuery.mockResolvedValueOnce({ rows: [mockCollection] });

      await fastify.collection.addMember(TEST_UUIDS.COLLECTION_1, TEST_UUIDS.USER_2);

      expect(mockQuery).toHaveBeenCalledTimes(1); // Only getById call
    });

    it("should throw error when collection not found", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await expect(
        fastify.collection.addMember(TEST_UUIDS.COLLECTION_2, TEST_UUIDS.USER_2)
      ).rejects.toThrow("Collection not found");
    });
  });

  describe("removeMember", () => {
    it("should remove member successfully", async () => {
      const mockCollection: Collection = {
        id: TEST_UUIDS.COLLECTION_1,
        name: "Test Collection",
        members: [TEST_UUIDS.USER_1, TEST_UUIDS.USER_2],
        owner_id: TEST_UUIDS.USER_1,
        related_collections: [],
        created_at: new Date().toISOString().split("T")[0],
        updated_at: new Date().toISOString().split("T")[0],
      };

      // Mock getById call
      mockQuery.mockResolvedValueOnce({ rows: [mockCollection] });
      // Mock collection_members delete
      mockQuery.mockResolvedValueOnce({ rows: [] });
      // Mock collections update
      mockQuery.mockResolvedValueOnce({ rows: [] });
      // Mock user removeFromCollection
      mockRemoveFromCollection.mockResolvedValueOnce(undefined);

      await fastify.collection.removeMember(TEST_UUIDS.COLLECTION_1, TEST_UUIDS.USER_2);

      expect(mockQuery).toHaveBeenCalledWith(
        "DELETE FROM collection_members WHERE collection_id = $1 AND user_id = $2",
        [TEST_UUIDS.COLLECTION_1, TEST_UUIDS.USER_2]
      );
      expect(mockQuery).toHaveBeenCalledWith(
        "UPDATE collections SET members = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2",
        [[TEST_UUIDS.USER_1], TEST_UUIDS.COLLECTION_1]
      );
      expect(mockRemoveFromCollection).toHaveBeenCalledWith(TEST_UUIDS.USER_2, TEST_UUIDS.COLLECTION_1);
    });

    it("should not remove owner", async () => {
      const mockCollection: Collection = {
        id: TEST_UUIDS.COLLECTION_1,
        name: "Test Collection",
        members: [TEST_UUIDS.USER_1],
        owner_id: TEST_UUIDS.USER_1,
        related_collections: [],
        created_at: new Date().toISOString().split("T")[0],
        updated_at: new Date().toISOString().split("T")[0],
      };

      mockQuery.mockResolvedValueOnce({ rows: [mockCollection] });

      await expect(
        fastify.collection.removeMember(TEST_UUIDS.COLLECTION_1, TEST_UUIDS.USER_1)
      ).rejects.toThrow("Cannot remove collection owner");
    });

    it("should throw error when collection not found", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await expect(
        fastify.collection.removeMember(TEST_UUIDS.COLLECTION_2, TEST_UUIDS.USER_2)
      ).rejects.toThrow("Collection not found");
    });
  });

  describe("getRelatedCollections", () => {
    it("should return related collections", async () => {
      const mockRelatedCollections: RelatedCollection[] = [
        {
          id: TEST_UUIDS.COLLECTION_2,
          name: "Related Collection",
          member_count: 3,
          created_at: new Date().toISOString().split("T")[0],
        },
      ];

      mockQuery.mockResolvedValueOnce({ rows: mockRelatedCollections });

      const result = await fastify.collection.getRelatedCollections(TEST_UUIDS.COLLECTION_1);

      expect(mockQuery).toHaveBeenCalledWith(
        `SELECT c.id, c.name, array_length(c.members, 1) as member_count, c.created_at
           FROM collections c
           JOIN collection_relations cr ON (c.id = cr.collection_id_1 OR c.id = cr.collection_id_2)
           WHERE (cr.collection_id_1 = $1 OR cr.collection_id_2 = $1) AND c.id != $1
           ORDER BY c.name`,
        [TEST_UUIDS.COLLECTION_1]
      );
      expect(result).toEqual(mockRelatedCollections);
    });

    it("should throw error when database fails", async () => {
      mockQuery.mockRejectedValueOnce(new Error("Database error"));

      await expect(
        fastify.collection.getRelatedCollections(TEST_UUIDS.COLLECTION_1)
      ).rejects.toThrow("Failed to fetch related collections");
    });
  });

  describe("addRelatedCollection", () => {
    it("should add related collection successfully", async () => {
      const mockCollection1: Collection = {
        id: TEST_UUIDS.COLLECTION_1,
        name: "Collection 1",
        members: [TEST_UUIDS.USER_1],
        owner_id: TEST_UUIDS.USER_1,
        related_collections: [],
        created_at: new Date().toISOString().split("T")[0],
        updated_at: new Date().toISOString().split("T")[0],
      };
      const mockCollection2: Collection = {
        id: TEST_UUIDS.COLLECTION_2,
        name: "Collection 2",
        members: [TEST_UUIDS.USER_2],
        owner_id: TEST_UUIDS.USER_2,
        related_collections: [],
        created_at: new Date().toISOString().split("T")[0],
        updated_at: new Date().toISOString().split("T")[0],
      };

      // Mock getById calls
      mockQuery.mockResolvedValueOnce({ rows: [mockCollection1] });
      mockQuery.mockResolvedValueOnce({ rows: [mockCollection2] });
      // Mock relation check
      mockQuery.mockResolvedValueOnce({ rows: [] });
      // Mock relation insert
      mockQuery.mockResolvedValueOnce({ rows: [] });
      // Mock collection updates
      mockQuery.mockResolvedValueOnce({ rows: [] });
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await fastify.collection.addRelatedCollection(TEST_UUIDS.COLLECTION_1, TEST_UUIDS.COLLECTION_2);

      expect(mockQuery).toHaveBeenCalledWith(
        "INSERT INTO collection_relations (collection_id_1, collection_id_2) VALUES ($1, $2)",
        [TEST_UUIDS.COLLECTION_1, TEST_UUIDS.COLLECTION_2]
      );
      expect(mockQuery).toHaveBeenCalledWith(
        "UPDATE collections SET related_collections = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2",
        [[TEST_UUIDS.COLLECTION_2], TEST_UUIDS.COLLECTION_1]
      );
      expect(mockQuery).toHaveBeenCalledWith(
        "UPDATE collections SET related_collections = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2",
        [[TEST_UUIDS.COLLECTION_1], TEST_UUIDS.COLLECTION_2]
      );
    });

    it("should throw error when trying to relate collection to itself", async () => {
      const mockCollection: Collection = {
        id: TEST_UUIDS.COLLECTION_1,
        name: "Collection 1",
        members: [TEST_UUIDS.USER_1],
        owner_id: TEST_UUIDS.USER_1,
        related_collections: [],
        created_at: new Date().toISOString().split("T")[0],
        updated_at: new Date().toISOString().split("T")[0],
      };

      mockQuery.mockResolvedValueOnce({ rows: [mockCollection] });
      mockQuery.mockResolvedValueOnce({ rows: [mockCollection] });

      await expect(
        fastify.collection.addRelatedCollection(TEST_UUIDS.COLLECTION_1, TEST_UUIDS.COLLECTION_1)
      ).rejects.toThrow("Cannot relate collection to itself");
    });

    it("should throw error when collections are already related", async () => {
      const mockCollection1: Collection = {
        id: TEST_UUIDS.COLLECTION_1,
        name: "Collection 1",
        members: [TEST_UUIDS.USER_1],
        owner_id: TEST_UUIDS.USER_1,
        related_collections: [],
        created_at: new Date().toISOString().split("T")[0],
        updated_at: new Date().toISOString().split("T")[0],
      };
      const mockCollection2: Collection = {
        id: TEST_UUIDS.COLLECTION_2,
        name: "Collection 2",
        members: [TEST_UUIDS.USER_2],
        owner_id: TEST_UUIDS.USER_2,
        related_collections: [],
        created_at: new Date().toISOString().split("T")[0],
        updated_at: new Date().toISOString().split("T")[0],
      };

      mockQuery.mockResolvedValueOnce({ rows: [mockCollection1] });
      mockQuery.mockResolvedValueOnce({ rows: [mockCollection2] });
      mockQuery.mockResolvedValueOnce({ rows: [{ "1": 1 }] });

      await expect(
        fastify.collection.addRelatedCollection(TEST_UUIDS.COLLECTION_1, TEST_UUIDS.COLLECTION_2)
      ).rejects.toThrow("Collections are already related");
    });
  });

  describe("removeRelatedCollection", () => {
    it("should remove related collection successfully", async () => {
      const mockCollection1: Collection = {
        id: TEST_UUIDS.COLLECTION_1,
        name: "Collection 1",
        members: [TEST_UUIDS.USER_1],
        owner_id: TEST_UUIDS.USER_1,
        related_collections: [TEST_UUIDS.COLLECTION_2],
        created_at: new Date().toISOString().split("T")[0],
        updated_at: new Date().toISOString().split("T")[0],
      };
      const mockCollection2: Collection = {
        id: TEST_UUIDS.COLLECTION_2,
        name: "Collection 2",
        members: [TEST_UUIDS.USER_2],
        owner_id: TEST_UUIDS.USER_2,
        related_collections: [TEST_UUIDS.COLLECTION_1],
        created_at: new Date().toISOString().split("T")[0],
        updated_at: new Date().toISOString().split("T")[0],
      };

      // Mock relation delete
      mockQuery.mockResolvedValueOnce({ rows: [] });
      // Mock getById calls
      mockQuery.mockResolvedValueOnce({ rows: [mockCollection1] });
      mockQuery.mockResolvedValueOnce({ rows: [mockCollection2] });
      // Mock collection updates
      mockQuery.mockResolvedValueOnce({ rows: [] });
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await fastify.collection.removeRelatedCollection(TEST_UUIDS.COLLECTION_1, TEST_UUIDS.COLLECTION_2);

      expect(mockQuery).toHaveBeenCalledWith(
        `DELETE FROM collection_relations
           WHERE (collection_id_1 = $1 AND collection_id_2 = $2)
              OR (collection_id_1 = $2 AND collection_id_2 = $1)`,
        [TEST_UUIDS.COLLECTION_1, TEST_UUIDS.COLLECTION_2]
      );
      expect(mockQuery).toHaveBeenCalledWith(
        "UPDATE collections SET related_collections = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2",
        [[], TEST_UUIDS.COLLECTION_1]
      );
      expect(mockQuery).toHaveBeenCalledWith(
        "UPDATE collections SET related_collections = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2",
        [[], TEST_UUIDS.COLLECTION_2]
      );
    });

    it("should throw error when database fails", async () => {
      mockQuery.mockRejectedValueOnce(new Error("Database error"));

      await expect(
        fastify.collection.removeRelatedCollection(TEST_UUIDS.COLLECTION_1, TEST_UUIDS.COLLECTION_2)
      ).rejects.toThrow("Database error");
    });
  });
});

import Fastify, { FastifyInstance } from "fastify";
import tagPlugin, { TagInput, TagUpdateInput } from "./tag.plugin";
import { Tag } from "../types/tag.types";

// Extend Tag type to include fields that come from database
interface TagWithMetadata extends Tag {
  type: "Person" | "Location" | "Event" | "Time";
  created_by: string;
}

// Mock the postgres query function
const mockQuery = jest.fn();

describe("Tag Plugin", () => {
  let fastify: FastifyInstance;

  beforeEach(async () => {
    // Create a new Fastify instance for each test
    fastify = Fastify({ logger: false });

    // Decorate the fastify instance with the postgres plugin
    fastify.decorate("pg", {
      query: mockQuery,
    } as any);

    // Register tag plugin
    await fastify.register(tagPlugin);

    // Wait for all plugins to be ready
    await fastify.ready();

    // Clear all mocks
    jest.clearAllMocks();
  });

  afterEach(async () => {
    await fastify.close();
  });

  describe("Plugin Registration", () => {
    it("should register tag plugin successfully", async () => {
      expect(fastify.tag).toBeDefined();
      expect(typeof fastify.tag.create).toBe("function");
      expect(typeof fastify.tag.get).toBe("function");
      expect(typeof fastify.tag.getByFamily).toBe("function");
      expect(typeof fastify.tag.getById).toBe("function");
      expect(typeof fastify.tag.update).toBe("function");
      expect(typeof fastify.tag.delete).toBe("function");
    });
  });

  describe("create", () => {
    it("should create a tag successfully", async () => {
      const tagInput: TagInput = {
        type: "Person",
        name: "John Doe",
        family_id: "family-123",
        created_by: "user-123",
      };
      const mockTag: TagWithMetadata = {
        id: "tag-123",
        type: "Person",
        name: "John Doe",
        family_id: "family-123",
        created_by: "user-123",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      mockQuery.mockResolvedValueOnce({ rows: [mockTag] });

      const result = await fastify.tag.create(tagInput);

      expect(mockQuery).toHaveBeenCalledWith(
        "INSERT INTO tags (type, name, family_id, created_by) VALUES ($1, $2, $3, $4) RETURNING *",
        ["Person", "John Doe", "family-123", "user-123"]
      );
      expect(result).toEqual(mockTag);
    });

    it("should create a Location tag successfully", async () => {
      const tagInput: TagInput = {
        type: "Location",
        name: "New York City",
        family_id: "family-123",
        created_by: "user-123",
      };
      const mockTag: TagWithMetadata = {
        id: "tag-124",
        type: "Location",
        name: "New York City",
        family_id: "family-123",
        created_by: "user-123",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      mockQuery.mockResolvedValueOnce({ rows: [mockTag] });

      const result = await fastify.tag.create(tagInput);

      expect(mockQuery).toHaveBeenCalledWith(
        "INSERT INTO tags (type, name, family_id, created_by) VALUES ($1, $2, $3, $4) RETURNING *",
        ["Location", "New York City", "family-123", "user-123"]
      );
      expect(result).toEqual(mockTag);
    });

    it("should create an Event tag successfully", async () => {
      const tagInput: TagInput = {
        type: "Event",
        name: "Wedding",
        family_id: "family-123",
        created_by: "user-123",
      };
      const mockTag: TagWithMetadata = {
        id: "tag-125",
        type: "Event",
        name: "Wedding",
        family_id: "family-123",
        created_by: "user-123",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      mockQuery.mockResolvedValueOnce({ rows: [mockTag] });

      const result = await fastify.tag.create(tagInput);

      expect(mockQuery).toHaveBeenCalledWith(
        "INSERT INTO tags (type, name, family_id, created_by) VALUES ($1, $2, $3, $4) RETURNING *",
        ["Event", "Wedding", "family-123", "user-123"]
      );
      expect(result).toEqual(mockTag);
    });

    it("should create a Time tag successfully", async () => {
      const tagInput: TagInput = {
        type: "Time",
        name: "Summer 1985",
        family_id: "family-123",
        created_by: "user-123",
      };
      const mockTag: TagWithMetadata = {
        id: "tag-126",
        type: "Time",
        name: "Summer 1985",
        family_id: "family-123",
        created_by: "user-123",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      mockQuery.mockResolvedValueOnce({ rows: [mockTag] });

      const result = await fastify.tag.create(tagInput);

      expect(mockQuery).toHaveBeenCalledWith(
        "INSERT INTO tags (type, name, family_id, created_by) VALUES ($1, $2, $3, $4) RETURNING *",
        ["Time", "Summer 1985", "family-123", "user-123"]
      );
      expect(result).toEqual(mockTag);
    });

    it("should throw error when database fails", async () => {
      const tagInput: TagInput = {
        type: "Person",
        name: "John Doe",
        family_id: "family-123",
        created_by: "user-123",
      };

      mockQuery.mockRejectedValueOnce(new Error("Database error"));

      await expect(fastify.tag.create(tagInput)).rejects.toThrow(
        "Failed to create tag"
      );
    });
  });

  describe("get", () => {
    it("should return all tags", async () => {
      const mockTags: TagWithMetadata[] = [
        {
          id: "tag-1",
          type: "Person",
          name: "John Doe",
          family_id: "family-1",
          created_by: "user-1",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: "tag-2",
          type: "Location",
          name: "Paris",
          family_id: "family-2",
          created_by: "user-2",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];

      mockQuery.mockResolvedValueOnce({ rows: mockTags });

      const result = await fastify.tag.get();

      expect(mockQuery).toHaveBeenCalledWith("SELECT * FROM tags");
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe("John Doe");
      expect(result[1].name).toBe("Paris");
    });

    it("should return empty array when no tags exist", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const result = await fastify.tag.get();

      expect(mockQuery).toHaveBeenCalledWith("SELECT * FROM tags");
      expect(result).toHaveLength(0);
    });

    it("should throw error when database fails", async () => {
      mockQuery.mockRejectedValueOnce(new Error("Database error"));

      await expect(fastify.tag.get()).rejects.toThrow("Failed to fetch tags");
    });
  });

  describe("getByFamily", () => {
    it("should return tags for a specific family", async () => {
      const familyId = "family-123";
      const mockTags: TagWithMetadata[] = [
        {
          id: "tag-1",
          type: "Person",
          name: "John Doe",
          family_id: familyId,
          created_by: "user-1",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: "tag-2",
          type: "Event",
          name: "Birthday",
          family_id: familyId,
          created_by: "user-1",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];

      mockQuery.mockResolvedValueOnce({ rows: mockTags });

      const result = await fastify.tag.getByFamily(familyId);

      expect(mockQuery).toHaveBeenCalledWith(
        "SELECT * FROM tags WHERE family_id = $1",
        [familyId]
      );
      expect(result).toHaveLength(2);
      expect(result[0].family_id).toBe(familyId);
      expect(result[1].family_id).toBe(familyId);
    });

    it("should return empty array when no tags exist for family", async () => {
      const familyId = "nonexistent-family";
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const result = await fastify.tag.getByFamily(familyId);

      expect(mockQuery).toHaveBeenCalledWith(
        "SELECT * FROM tags WHERE family_id = $1",
        [familyId]
      );
      expect(result).toHaveLength(0);
    });

    it("should throw error when database fails", async () => {
      const familyId = "family-123";
      mockQuery.mockRejectedValueOnce(new Error("Database error"));

      await expect(fastify.tag.getByFamily(familyId)).rejects.toThrow(
        "Failed to fetch tags by family"
      );
    });
  });

  describe("getById", () => {
    it("should return tag by ID", async () => {
      const tagId = "tag-123";
      const mockTag: TagWithMetadata = {
        id: tagId,
        type: "Person",
        name: "John Doe",
        family_id: "family-123",
        created_by: "user-123",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      mockQuery.mockResolvedValueOnce({ rows: [mockTag] });

      const result = await fastify.tag.getById(tagId);

      expect(mockQuery).toHaveBeenCalledWith(
        "SELECT * FROM tags WHERE id = $1",
        [tagId]
      );
      expect(result).toEqual(mockTag);
    });

    it("should return null when tag not found", async () => {
      const tagId = "nonexistent-tag";
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const result = await fastify.tag.getById(tagId);

      expect(mockQuery).toHaveBeenCalledWith(
        "SELECT * FROM tags WHERE id = $1",
        [tagId]
      );
      expect(result).toBeNull();
    });

    it("should throw error when database fails", async () => {
      const tagId = "tag-123";
      mockQuery.mockRejectedValueOnce(new Error("Database error"));

      await expect(fastify.tag.getById(tagId)).rejects.toThrow(
        "Failed to fetch tag by ID"
      );
    });
  });

  describe("update", () => {
    it("should update a tag successfully", async () => {
      const tagId = "tag-123";
      const updateInput: TagUpdateInput = {
        type: "Person",
        name: "Jane Doe",
        family_id: "family-456",
      };
      const mockUpdatedTag: TagWithMetadata = {
        id: tagId,
        type: "Person",
        name: "Jane Doe",
        family_id: "family-456",
        created_by: "user-123",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      mockQuery.mockResolvedValueOnce({ rows: [mockUpdatedTag] });

      const result = await fastify.tag.update(tagId, updateInput);

      expect(mockQuery).toHaveBeenCalledWith(
        "UPDATE tags SET type = $1, name = $2, family_id = $3, updated_at = NOW() WHERE id = $4 RETURNING *",
        ["Person", "Jane Doe", "family-456", tagId]
      );
      expect(result).toEqual(mockUpdatedTag);
    });

    it("should update tag type from Person to Location", async () => {
      const tagId = "tag-123";
      const updateInput: TagUpdateInput = {
        type: "Location",
        name: "Updated Location",
        family_id: "family-123",
      };
      const mockUpdatedTag: TagWithMetadata = {
        id: tagId,
        type: "Location",
        name: "Updated Location",
        family_id: "family-123",
        created_by: "user-123",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      mockQuery.mockResolvedValueOnce({ rows: [mockUpdatedTag] });

      const result = await fastify.tag.update(tagId, updateInput);

      expect(mockQuery).toHaveBeenCalledWith(
        "UPDATE tags SET type = $1, name = $2, family_id = $3, updated_at = NOW() WHERE id = $4 RETURNING *",
        ["Location", "Updated Location", "family-123", tagId]
      );
      expect(result).toEqual(mockUpdatedTag);
    });

    it("should return null when tag not found", async () => {
      const tagId = "nonexistent-tag";
      const updateInput: TagUpdateInput = {
        type: "Person",
        name: "Jane Doe",
        family_id: "family-456",
      };

      mockQuery.mockResolvedValueOnce({ rows: [] });

      const result = await fastify.tag.update(tagId, updateInput);

      expect(mockQuery).toHaveBeenCalledWith(
        "UPDATE tags SET type = $1, name = $2, family_id = $3, updated_at = NOW() WHERE id = $4 RETURNING *",
        ["Person", "Jane Doe", "family-456", tagId]
      );
      expect(result).toBeNull();
    });

    it("should throw error when database fails", async () => {
      const tagId = "tag-123";
      const updateInput: TagUpdateInput = {
        type: "Person",
        name: "Jane Doe",
        family_id: "family-456",
      };

      mockQuery.mockRejectedValueOnce(new Error("Database error"));

      await expect(fastify.tag.update(tagId, updateInput)).rejects.toThrow(
        "Failed to update tag"
      );
    });
  });

  describe("delete", () => {
    it("should delete a tag successfully", async () => {
      const tagId = "tag-123";

      // Mock successful database operations
      mockQuery.mockResolvedValueOnce({ rows: [] }); // Update images
      mockQuery.mockResolvedValueOnce({ rows: [] }); // Delete tag

      await fastify.tag.delete(tagId);

      expect(mockQuery).toHaveBeenCalledTimes(2);
      expect(mockQuery).toHaveBeenNthCalledWith(
        1,
        "UPDATE images SET tags = array_remove(tags, $1), updated_at = NOW() WHERE $1 = ANY(tags)",
        [tagId]
      );
      expect(mockQuery).toHaveBeenNthCalledWith(
        2,
        "DELETE FROM tags WHERE id = $1",
        [tagId]
      );
    });

    it("should handle deletion when tag is not in any images", async () => {
      const tagId = "tag-123";

      // Mock successful database operations
      mockQuery.mockResolvedValueOnce({ rows: [] }); // Update images (no rows affected)
      mockQuery.mockResolvedValueOnce({ rows: [] }); // Delete tag

      await fastify.tag.delete(tagId);

      expect(mockQuery).toHaveBeenCalledTimes(2);
      expect(mockQuery).toHaveBeenNthCalledWith(
        1,
        "UPDATE images SET tags = array_remove(tags, $1), updated_at = NOW() WHERE $1 = ANY(tags)",
        [tagId]
      );
      expect(mockQuery).toHaveBeenNthCalledWith(
        2,
        "DELETE FROM tags WHERE id = $1",
        [tagId]
      );
    });

    it("should throw error when database fails on image update", async () => {
      const tagId = "tag-123";

      mockQuery.mockRejectedValueOnce(new Error("Database error"));

      await expect(fastify.tag.delete(tagId)).rejects.toThrow(
        "Failed to delete tag"
      );

      expect(mockQuery).toHaveBeenCalledTimes(1);
      expect(mockQuery).toHaveBeenCalledWith(
        "UPDATE images SET tags = array_remove(tags, $1), updated_at = NOW() WHERE $1 = ANY(tags)",
        [tagId]
      );
    });

    it("should throw error when database fails on tag deletion", async () => {
      const tagId = "tag-123";

      mockQuery.mockResolvedValueOnce({ rows: [] }); // Update images succeeds
      mockQuery.mockRejectedValueOnce(new Error("Database error")); // Delete tag fails

      await expect(fastify.tag.delete(tagId)).rejects.toThrow(
        "Failed to delete tag"
      );

      expect(mockQuery).toHaveBeenCalledTimes(2);
    });
  });

  describe("Error Handling", () => {
    it("should throw error if postgres plugin is not registered", async () => {
      const newFastify = Fastify({ logger: false });

      await expect(newFastify.register(tagPlugin)).rejects.toThrow(
        "fastify-postgres must be registered before this plugin"
      );

      await newFastify.close();
    });
  });
});

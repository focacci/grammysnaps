import Fastify, { FastifyInstance } from "fastify";
import imagePlugin from "./image.plugin";
import { Image, ImageInput } from "../types/image.types";

// Mock the postgres query function
const mockQuery = jest.fn();

describe("Image Plugin", () => {
  let fastify: FastifyInstance;

  beforeEach(async () => {
    // Create a new Fastify instance for each test
    fastify = Fastify({ logger: false });

    // Decorate the fastify instance with the postgres plugin
    fastify.decorate("pg", {
      query: mockQuery,
    } as any);

    // Register image plugin
    await fastify.register(imagePlugin);

    // Wait for all plugins to be ready
    await fastify.ready();

    // Clear all mocks
    jest.clearAllMocks();
  });

  afterEach(async () => {
    await fastify.close();
  });

  describe("Plugin Registration", () => {
    it("should register image plugin successfully", async () => {
      expect(fastify.image).toBeDefined();
      expect(typeof fastify.image.create).toBe("function");
      expect(typeof fastify.image.get).toBe("function");
      expect(typeof fastify.image.getById).toBe("function");
      expect(typeof fastify.image.update).toBe("function");
      expect(typeof fastify.image.delete).toBe("function");
      expect(typeof fastify.image.applyTags).toBe("function");
      expect(typeof fastify.image.applyFamilies).toBe("function");
      expect(typeof fastify.image.getAllWithTag).toBe("function");
      expect(typeof fastify.image.getByFamily).toBe("function");
      expect(typeof fastify.image.getByFamilies).toBe("function");
      expect(typeof fastify.image.getOrphanedByFamily).toBe("function");
    });
  });

  describe("create", () => {
    it("should create an image successfully", async () => {
      const imageInput: ImageInput = {
        title: "Test Image",
        filename: "test.jpg",
        tags: ["tag-1", "tag-2"],
        family_ids: ["family-1"],
        s3Url: "https://bucket.s3.amazonaws.com/test.jpg",
      };
      const mockImage: Image = {
        id: "image-123",
        title: "Test Image",
        filename: "test.jpg",
        tags: ["tag-1", "tag-2"],
        family_ids: ["family-1"],
        s3_url: "https://bucket.s3.amazonaws.com/test.jpg",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Mock database responses
      mockQuery.mockResolvedValueOnce({ rows: [mockImage] }); // Insert image
      mockQuery.mockResolvedValue({ rows: [] }); // Apply tags and families

      const result = await fastify.image.create(imageInput);

      expect(mockQuery).toHaveBeenCalledWith(
        "INSERT INTO images (title, filename, tags, family_ids, s3_url) VALUES ($1, $2, $3, $4, $5) RETURNING *",
        ["Test Image", "test.jpg", ["tag-1", "tag-2"], ["family-1"], "https://bucket.s3.amazonaws.com/test.jpg"]
      );
      expect(result).toEqual(mockImage);
    });

    it("should create an image with minimal data", async () => {
      const imageInput: ImageInput = {
        filename: "test.jpg",
        family_ids: ["family-1"],
      };
      const mockImage: Image = {
        id: "image-123",
        filename: "test.jpg",
        tags: [],
        family_ids: ["family-1"],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      mockQuery.mockResolvedValueOnce({ rows: [mockImage] });
      mockQuery.mockResolvedValue({ rows: [] });

      const result = await fastify.image.create(imageInput);

      expect(mockQuery).toHaveBeenCalledWith(
        "INSERT INTO images (title, filename, tags, family_ids, s3_url) VALUES ($1, $2, $3, $4, $5) RETURNING *",
        [null, "test.jpg", [], ["family-1"], null]
      );
      expect(result).toEqual(mockImage);
    });

    it("should throw error when no family_ids provided", async () => {
      const imageInput: ImageInput = {
        filename: "test.jpg",
        family_ids: [],
      };

      await expect(fastify.image.create(imageInput)).rejects.toThrow(
        "At least one family must be associated with the image"
      );
    });

    it("should throw error when family_ids is undefined", async () => {
      const imageInput: ImageInput = {
        filename: "test.jpg",
      };

      await expect(fastify.image.create(imageInput)).rejects.toThrow(
        "At least one family must be associated with the image"
      );
    });

    it("should throw error when database fails", async () => {
      const imageInput: ImageInput = {
        filename: "test.jpg",
        family_ids: ["family-1"],
      };

      mockQuery.mockRejectedValueOnce(new Error("Database error"));

      await expect(fastify.image.create(imageInput)).rejects.toThrow(
        "Failed to create image"
      );
    });
  });

  describe("get", () => {
    it("should return all images", async () => {
      const mockImages: Image[] = [
        {
          id: "image-1",
          filename: "image1.jpg",
          title: "Image 1",
          tags: ["tag-1"],
          family_ids: ["family-1"],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: "image-2",
          filename: "image2.jpg",
          title: "Image 2",
          tags: ["tag-2"],
          family_ids: ["family-2"],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];

      mockQuery.mockResolvedValueOnce({ rows: mockImages });

      const result = await fastify.image.get();

      expect(mockQuery).toHaveBeenCalledWith("SELECT * FROM images");
      expect(result).toHaveLength(2);
      expect(result[0].filename).toBe("image1.jpg");
      expect(result[1].filename).toBe("image2.jpg");
    });

    it("should throw error when database fails", async () => {
      mockQuery.mockRejectedValueOnce(new Error("Database error"));

      await expect(fastify.image.get()).rejects.toThrow(
        "Failed to fetch images"
      );
    });
  });

  describe("getById", () => {
    it("should return image by ID", async () => {
      const mockImage: Image = {
        id: "image-123",
        filename: "test.jpg",
        title: "Test Image",
        tags: ["tag-1"],
        family_ids: ["family-1"],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      mockQuery.mockResolvedValueOnce({ rows: [mockImage] });

      const result = await fastify.image.getById("image-123");

      expect(mockQuery).toHaveBeenCalledWith(
        "SELECT * FROM images WHERE id = $1",
        ["image-123"]
      );
      expect(result).toEqual(mockImage);
    });

    it("should return null when image not found", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const result = await fastify.image.getById("non-existent");

      expect(result).toBeNull();
    });

    it("should throw error when database fails", async () => {
      mockQuery.mockRejectedValueOnce(new Error("Database error"));

      await expect(fastify.image.getById("image-123")).rejects.toThrow(
        "Failed to fetch image by ID"
      );
    });
  });

  describe("update", () => {
    it("should update image successfully", async () => {
      const imageUpdate: ImageInput = {
        title: "Updated Image",
        tags: ["tag-1", "tag-3"],
        family_ids: ["family-1", "family-2"],
      };
      const mockUpdatedImage: Image = {
        id: "image-123",
        filename: "test.jpg",
        title: "Updated Image",
        tags: ["tag-1", "tag-3"],
        family_ids: ["family-1", "family-2"],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Mock update call
      mockQuery.mockResolvedValueOnce({ rows: [mockUpdatedImage] });
      // Mock tag deletion and family updates
      mockQuery.mockResolvedValue({ rows: [] });

      const result = await fastify.image.update("image-123", imageUpdate);

      expect(mockQuery).toHaveBeenCalledWith(
        "UPDATE images SET title = $1, tags = $2, family_ids = $3, updated_at = NOW() WHERE id = $4 RETURNING *",
        ["Updated Image", ["tag-1", "tag-3"], ["family-1", "family-2"], "image-123"]
      );
      expect(result).toEqual(mockUpdatedImage);
    });

    it("should throw error when trying to set empty family_ids", async () => {
      const imageUpdate: ImageInput = {
        family_ids: [],
      };

      await expect(
        fastify.image.update("image-123", imageUpdate)
      ).rejects.toThrow("Image must belong to at least one family");
    });

    it("should throw error when database fails", async () => {
      const imageUpdate: ImageInput = {
        title: "Updated Image",
      };

      mockQuery.mockRejectedValueOnce(new Error("Database error"));

      await expect(
        fastify.image.update("image-123", imageUpdate)
      ).rejects.toThrow("Failed to update image");
    });
  });

  describe("delete", () => {
    it("should delete image successfully", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await fastify.image.delete("image-123");

      expect(mockQuery).toHaveBeenCalledWith(
        "DELETE FROM images WHERE id = $1",
        ["image-123"]
      );
    });

    it("should throw error when database fails", async () => {
      mockQuery.mockRejectedValueOnce(new Error("Database error"));

      await expect(fastify.image.delete("image-123")).rejects.toThrow(
        "Failed to delete image"
      );
    });
  });

  describe("applyTags", () => {
    it("should apply tags to image successfully", async () => {
      const tags = ["tag-1", "tag-2", "tag-3"];
      
      mockQuery.mockResolvedValue({ rows: [] });

      await fastify.image.applyTags("image-123", tags);

      expect(mockQuery).toHaveBeenCalledTimes(3);
      expect(mockQuery).toHaveBeenNthCalledWith(
        1,
        "INSERT INTO image_tags (image_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
        ["image-123", "tag-1"]
      );
      expect(mockQuery).toHaveBeenNthCalledWith(
        2,
        "INSERT INTO image_tags (image_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
        ["image-123", "tag-2"]
      );
      expect(mockQuery).toHaveBeenNthCalledWith(
        3,
        "INSERT INTO image_tags (image_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
        ["image-123", "tag-3"]
      );
    });

    it("should handle empty tags array", async () => {
      await fastify.image.applyTags("image-123", []);

      expect(mockQuery).not.toHaveBeenCalled();
    });

    it("should throw error when database fails", async () => {
      mockQuery.mockRejectedValueOnce(new Error("Database error"));

      await expect(
        fastify.image.applyTags("image-123", ["tag-1"])
      ).rejects.toThrow("Failed to add tag to image");
    });
  });

  describe("applyFamilies", () => {
    it("should apply families to image successfully", async () => {
      const familyIds = ["family-1", "family-2"];
      
      // Mock delete existing associations
      mockQuery.mockResolvedValueOnce({ rows: [] });
      // Mock insert new associations
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await fastify.image.applyFamilies("image-123", familyIds);

      expect(mockQuery).toHaveBeenCalledTimes(2);
      expect(mockQuery).toHaveBeenNthCalledWith(
        1,
        "DELETE FROM image_families WHERE image_id = $1",
        ["image-123"]
      );
      expect(mockQuery).toHaveBeenNthCalledWith(
        2,
        "INSERT INTO image_families (image_id, family_id) VALUES ($1, $2), ($1, $3)",
        ["image-123", "family-1", "family-2"]
      );
    });

    it("should handle empty family IDs array", async () => {
      // Mock delete existing associations
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await fastify.image.applyFamilies("image-123", []);

      expect(mockQuery).toHaveBeenCalledTimes(1);
      expect(mockQuery).toHaveBeenCalledWith(
        "DELETE FROM image_families WHERE image_id = $1",
        ["image-123"]
      );
    });

    it("should throw error when database fails", async () => {
      mockQuery.mockRejectedValueOnce(new Error("Database error"));

      await expect(
        fastify.image.applyFamilies("image-123", ["family-1"])
      ).rejects.toThrow("Failed to apply family associations");
    });
  });

  describe("getAllWithTag", () => {
    it("should return all images with specific tag", async () => {
      const mockImages: Image[] = [
        {
          id: "image-1",
          filename: "image1.jpg",
          title: "Image 1",
          tags: ["tag-1"],
          family_ids: ["family-1"],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: "image-2",
          filename: "image2.jpg",
          title: "Image 2",
          tags: ["tag-1", "tag-2"],
          family_ids: ["family-2"],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];

      mockQuery.mockResolvedValueOnce({ rows: mockImages });

      const result = await fastify.image.getAllWithTag("tag-1");

      expect(mockQuery).toHaveBeenCalledWith(
        "SELECT i.* FROM images i INNER JOIN image_tags it ON i.id = it.image_id WHERE it.tag_id = $1",
        ["tag-1"]
      );
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe("image-1");
      expect(result[1].id).toBe("image-2");
    });

    it("should throw error when database fails", async () => {
      mockQuery.mockRejectedValueOnce(new Error("Database error"));

      await expect(fastify.image.getAllWithTag("tag-1")).rejects.toThrow(
        "Failed to get all images with tag"
      );
    });
  });

  describe("getByFamily", () => {
    it("should return images by family", async () => {
      const mockImages: Image[] = [
        {
          id: "image-1",
          filename: "image1.jpg",
          title: "Image 1",
          tags: ["tag-1"],
          family_ids: ["family-1"],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];

      mockQuery.mockResolvedValueOnce({ rows: mockImages });

      const result = await fastify.image.getByFamily("family-1");

      expect(mockQuery).toHaveBeenCalledWith(
        `SELECT i.* FROM images i 
           JOIN image_families if ON i.id = if.image_id 
           WHERE if.family_id = $1`,
        ["family-1"]
      );
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("image-1");
    });

    it("should throw error when database fails", async () => {
      mockQuery.mockRejectedValueOnce(new Error("Database error"));

      await expect(fastify.image.getByFamily("family-1")).rejects.toThrow(
        "Failed to get images by family"
      );
    });
  });

  describe("getByFamilies", () => {
    it("should return images by multiple families", async () => {
      const mockImages: Image[] = [
        {
          id: "image-1",
          filename: "image1.jpg",
          title: "Image 1",
          tags: ["tag-1"],
          family_ids: ["family-1"],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: "image-2",
          filename: "image2.jpg",
          title: "Image 2",
          tags: ["tag-2"],
          family_ids: ["family-2"],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];

      mockQuery.mockResolvedValueOnce({ rows: mockImages });

      const result = await fastify.image.getByFamilies(["family-1", "family-2"]);

      expect(mockQuery).toHaveBeenCalledWith(
        `SELECT DISTINCT i.* FROM images i 
           JOIN image_families if ON i.id = if.image_id 
           WHERE if.family_id IN ($1, $2)
           ORDER BY i.created_at DESC`,
        ["family-1", "family-2"]
      );
      expect(result).toHaveLength(2);
    });

    it("should return empty array for empty family IDs", async () => {
      const result = await fastify.image.getByFamilies([]);

      expect(result).toEqual([]);
      expect(mockQuery).not.toHaveBeenCalled();
    });

    it("should throw error when database fails", async () => {
      mockQuery.mockRejectedValueOnce(new Error("Database error"));

      await expect(
        fastify.image.getByFamilies(["family-1"])
      ).rejects.toThrow("Failed to get images by families");
    });
  });

  describe("getOrphanedByFamily", () => {
    it("should return orphaned images by family", async () => {
      const mockImages: Image[] = [
        {
          id: "image-1",
          filename: "image1.jpg",
          title: "Orphaned Image",
          tags: ["tag-1"],
          family_ids: ["family-1"],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];

      mockQuery.mockResolvedValueOnce({ rows: mockImages });

      const result = await fastify.image.getOrphanedByFamily("family-1");

      expect(mockQuery).toHaveBeenCalledWith(
        `SELECT i.* FROM images i 
           JOIN image_families if ON i.id = if.image_id 
           WHERE if.family_id = $1 
           AND i.id NOT IN (
             SELECT DISTINCT if2.image_id 
             FROM image_families if2 
             WHERE if2.family_id != $1
           )`,
        ["family-1"]
      );
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("image-1");
    });

    it("should throw error when database fails", async () => {
      mockQuery.mockRejectedValueOnce(new Error("Database error"));

      await expect(
        fastify.image.getOrphanedByFamily("family-1")
      ).rejects.toThrow("Failed to get orphaned images by family");
    });
  });
});
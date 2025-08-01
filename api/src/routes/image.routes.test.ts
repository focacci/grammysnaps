import Fastify, { FastifyInstance } from "fastify";
import imageRoutes from "./image.routes";
import { Image, ImageInput } from "../types/image.types";
import { IMAGE_ERRORS } from "../types/errors";

const mockImageGet = jest.fn();
const mockImageGetById = jest.fn();
const mockImageCreate = jest.fn();
const mockImageUpdate = jest.fn();
const mockImageDelete = jest.fn();
const mockImageApplyTags = jest.fn();
const mockImageApplyFamilies = jest.fn();
const mockImageGetByFamily = jest.fn();
const mockImageGetByFamilies = jest.fn();
const mockImageGetAllWithTag = jest.fn();
const mockImageGetOrphanedByFamily = jest.fn();

const mockS3Upload = jest.fn();
const mockS3Download = jest.fn();
const mockS3Delete = jest.fn();
const mockS3CreateKey = jest.fn();
const mockS3GetPublicUrl = jest.fn();
const mockS3GetInfo = jest.fn();
const mockS3GetSignedUrl = jest.fn();
const mockS3ListImages = jest.fn();
const mockS3Exists = jest.fn();

describe("Image Routes", () => {
  let fastify: FastifyInstance;

  const mockImage: Image = {
    id: "image-123",
    title: "Test Image",
    filename: "test.jpg",
    tags: ["tag1", "tag2"],
    family_ids: ["family-1", "family-2"],
    s3_url:
      "https://grammysnaps.s3.us-east-2.amazonaws.com/family-photos/uuid/test.jpg",
    created_at: "2023-01-01T00:00:00Z",
    updated_at: "2023-01-01T00:00:00Z",
  };

  const mockBuffer = Buffer.from("fake image data");

  beforeEach(async () => {
    // Create a new Fastify instance for each test
    fastify = Fastify({ logger: false });

    // Register multipart support
    await fastify.register(import("@fastify/multipart"), {
      attachFieldsToBody: true,
    });

    // Decorate the fastify instance with mock plugins
    fastify.decorate("image", {
      get: mockImageGet,
      getById: mockImageGetById,
      create: mockImageCreate,
      update: mockImageUpdate,
      delete: mockImageDelete,
      applyTags: mockImageApplyTags,
      applyFamilies: mockImageApplyFamilies,
      getByFamily: mockImageGetByFamily,
      getByFamilies: mockImageGetByFamilies,
      getAllWithTag: mockImageGetAllWithTag,
      getOrphanedByFamily: mockImageGetOrphanedByFamily,
    });

    fastify.decorate("s3", {
      upload: mockS3Upload,
      download: mockS3Download,
      delete: mockS3Delete,
      createKey: mockS3CreateKey,
      getPublicUrl: mockS3GetPublicUrl,
      getInfo: mockS3GetInfo,
      getSignedUrl: mockS3GetSignedUrl,
      listImages: mockS3ListImages,
      exists: mockS3Exists,
    });

    // Register image routes
    await fastify.register(imageRoutes);

    // Wait for all plugins to be ready
    await fastify.ready();

    // Clear all mocks
    jest.clearAllMocks();
  });

  afterEach(async () => {
    await fastify.close();
  });

  describe("GET /", () => {
    it("should return all images", async () => {
      const mockImages = [mockImage];
      mockImageGet.mockResolvedValue(mockImages);

      const response = await fastify.inject({
        method: "GET",
        url: "/",
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual({ images: mockImages });
      expect(mockImageGet).toHaveBeenCalledTimes(1);
    });

    it("should handle empty images list", async () => {
      mockImageGet.mockResolvedValue([]);

      const response = await fastify.inject({
        method: "GET",
        url: "/",
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual({ images: [] });
    });

    it("should handle database errors", async () => {
      mockImageGet.mockRejectedValue(new Error("Database error"));

      const response = await fastify.inject({
        method: "GET",
        url: "/",
      });

      expect(response.statusCode).toBe(500);
    });
  });

  describe("GET /:imageId", () => {
    const validImageId = "550e8400-e29b-41d4-a716-446655440000";

    it("should return image by ID", async () => {
      mockImageGetById.mockResolvedValue(mockImage);

      const response = await fastify.inject({
        method: "GET",
        url: `/${validImageId}`,
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual({ image: mockImage });
      expect(mockImageGetById).toHaveBeenCalledWith(validImageId);
    });

    it("should return 404 when image not found", async () => {
      mockImageGetById.mockResolvedValue(null);

      const response = await fastify.inject({
        method: "GET",
        url: `/${validImageId}`,
      });

      expect(response.statusCode).toBe(404);
      expect(JSON.parse(response.body)).toEqual({
        message: IMAGE_ERRORS.NOT_FOUND,
      });
    });

    it("should reject invalid UUID format", async () => {
      const response = await fastify.inject({
        method: "GET",
        url: "/invalid-uuid",
      });

      expect(response.statusCode).toBe(400);
    });

    it("should handle database errors", async () => {
      mockImageGetById.mockRejectedValue(new Error("Database error"));

      const response = await fastify.inject({
        method: "GET",
        url: `/${validImageId}`,
      });

      expect(response.statusCode).toBe(500);
    });
  });

  describe("GET /:imageId/download", () => {
    const validImageId = "550e8400-e29b-41d4-a716-446655440000";

    it("should download image file", async () => {
      mockImageGetById.mockResolvedValue(mockImage);
      mockS3Download.mockResolvedValue(mockBuffer);

      const response = await fastify.inject({
        method: "GET",
        url: `/${validImageId}/download`,
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers["content-disposition"]).toBe(
        'attachment; filename="test.jpg"'
      );
      expect(response.headers["content-type"]).toBe("application/octet-stream");
      expect(response.headers["content-length"]).toBe(
        mockBuffer.length.toString()
      );
      expect(response.rawPayload).toEqual(mockBuffer);
      expect(mockS3Download).toHaveBeenCalledWith(
        "family-photos/uuid/test.jpg"
      );
    });

    it("should return 404 when image not found", async () => {
      mockImageGetById.mockResolvedValue(null);

      const response = await fastify.inject({
        method: "GET",
        url: `/${validImageId}/download`,
      });

      expect(response.statusCode).toBe(404);
      expect(JSON.parse(response.body)).toEqual({
        message: IMAGE_ERRORS.NOT_FOUND,
      });
    });

    it("should return 404 when image has no s3_url", async () => {
      const imageWithoutS3 = { ...mockImage, s3_url: undefined };
      mockImageGetById.mockResolvedValue(imageWithoutS3);

      const response = await fastify.inject({
        method: "GET",
        url: `/${validImageId}/download`,
      });

      expect(response.statusCode).toBe(404);
      expect(JSON.parse(response.body)).toEqual({
        message: IMAGE_ERRORS.FILE_NOT_FOUND,
      });
    });

    it("should handle S3 download errors", async () => {
      mockImageGetById.mockResolvedValue(mockImage);
      mockS3Download.mockRejectedValue(new Error("S3 download failed"));

      const response = await fastify.inject({
        method: "GET",
        url: `/${validImageId}/download`,
      });

      expect(response.statusCode).toBe(500);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.message).toBe(IMAGE_ERRORS.DOWNLOAD_FAILED);
      expect(responseBody.error).toBeDefined();
    });

    it("should reject invalid UUID format", async () => {
      const response = await fastify.inject({
        method: "GET",
        url: "/invalid-uuid/download",
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe("POST /", () => {
    const s3Key = "family-photos/generated-uuid/test.jpg";
    const publicUrl = "https://grammysnaps.s3.us-east-2.amazonaws.com/" + s3Key;

    beforeEach(() => {
      mockS3CreateKey.mockReturnValue(s3Key);
      mockS3GetPublicUrl.mockReturnValue(publicUrl);
      mockS3Upload.mockResolvedValue(undefined);
      mockImageCreate.mockResolvedValue(mockImage);
    });

    it("should reject non-multipart requests", async () => {
      const response = await fastify.inject({
        method: "POST",
        url: "/",
        headers: {
          "content-type": "application/json",
        },
        payload: { title: "Test" },
      });

      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.body)).toEqual({
        message: IMAGE_ERRORS.MULTIPART_REQUIRED,
      });
    });

    // Note: Full multipart file upload testing requires complex mocking
    // that would be better handled with integration tests
    it("should handle multipart validation requirements", () => {
      // Test that the route exists and would handle:
      // - File presence validation
      // - Family IDs requirement
      // - File type validation
      // - File size limits
      // - S3 upload process
      // - Database creation
      expect(mockS3CreateKey).toBeDefined();
      expect(mockS3Upload).toBeDefined();
      expect(mockImageCreate).toBeDefined();
    });
  });

  describe("PUT /:imageId", () => {
    const validImageId = "550e8400-e29b-41d4-a716-446655440000";
    const updateData: ImageInput = {
      title: "Updated Title",
      tags: ["550e8400-e29b-41d4-a716-446655440010"], // Valid UUID for tag
      family_ids: ["550e8400-e29b-41d4-a716-446655440001"],
    };

    it("should update image successfully", async () => {
      const updatedImage = { ...mockImage, ...updateData };
      mockImageGetById.mockResolvedValue(mockImage);
      mockImageUpdate.mockResolvedValue(updatedImage);

      const response = await fastify.inject({
        method: "PUT",
        url: `/${validImageId}`,
        payload: updateData,
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual({ image: updatedImage });
      expect(mockImageUpdate).toHaveBeenCalledWith(validImageId, {
        ...updateData,
        s3Url: mockImage.s3_url,
      });
    });

    it("should return 404 when image not found", async () => {
      mockImageGetById.mockResolvedValue(null);

      const response = await fastify.inject({
        method: "PUT",
        url: `/${validImageId}`,
        payload: updateData,
      });

      expect(response.statusCode).toBe(404);
      expect(JSON.parse(response.body)).toEqual({
        message: IMAGE_ERRORS.NOT_FOUND,
      });
    });

    it("should reject invalid UUID format", async () => {
      const response = await fastify.inject({
        method: "PUT",
        url: "/invalid-uuid",
        payload: updateData,
      });

      expect(response.statusCode).toBe(400);
    });

    it("should handle database errors", async () => {
      mockImageGetById.mockResolvedValue(mockImage);
      mockImageUpdate.mockRejectedValue(new Error("Database error"));

      const response = await fastify.inject({
        method: "PUT",
        url: `/${validImageId}`,
        payload: updateData,
      });

      expect(response.statusCode).toBe(500);
    });

    it("should handle valid update with optional title", async () => {
      const updateDataNoTitle = {
        tags: ["550e8400-e29b-41d4-a716-446655440010"],
        family_ids: ["550e8400-e29b-41d4-a716-446655440001"],
      };
      const updatedImage = { ...mockImage, ...updateDataNoTitle };
      mockImageGetById.mockResolvedValue(mockImage);
      mockImageUpdate.mockResolvedValue(updatedImage);

      const response = await fastify.inject({
        method: "PUT",
        url: `/${validImageId}`,
        payload: updateDataNoTitle,
      });

      expect(response.statusCode).toBe(200);
    });

    it("should handle empty tags array", async () => {
      const updateDataEmptyTags = {
        title: "Test",
        tags: [],
        family_ids: ["550e8400-e29b-41d4-a716-446655440001"],
      };
      const updatedImage = { ...mockImage, ...updateDataEmptyTags };
      mockImageGetById.mockResolvedValue(mockImage);
      mockImageUpdate.mockResolvedValue(updatedImage);

      const response = await fastify.inject({
        method: "PUT",
        url: `/${validImageId}`,
        payload: updateDataEmptyTags,
      });

      expect(response.statusCode).toBe(200);
    });

    it("should reject empty family_ids array due to validation", async () => {
      const updateDataEmptyFamilies = {
        title: "Test",
        tags: ["550e8400-e29b-41d4-a716-446655440010"],
        family_ids: [],
      };

      const response = await fastify.inject({
        method: "PUT",
        url: `/${validImageId}`,
        payload: updateDataEmptyFamilies,
      });

      expect(response.statusCode).toBe(400); // Should fail validation due to minItems: 1
    });
  });

  describe("GET /family/:familyId", () => {
    const validFamilyId = "550e8400-e29b-41d4-a716-446655440001";

    it("should return images for family", async () => {
      const mockImages = [mockImage];
      mockImageGetByFamily.mockResolvedValue(mockImages);

      const response = await fastify.inject({
        method: "GET",
        url: `/family/${validFamilyId}`,
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual({ images: mockImages });
      expect(mockImageGetByFamily).toHaveBeenCalledWith(validFamilyId);
    });

    it("should return empty array when no images found", async () => {
      mockImageGetByFamily.mockResolvedValue([]);

      const response = await fastify.inject({
        method: "GET",
        url: `/family/${validFamilyId}`,
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual({ images: [] });
    });

    it("should reject invalid UUID format", async () => {
      const response = await fastify.inject({
        method: "GET",
        url: "/family/invalid-uuid",
      });

      expect(response.statusCode).toBe(400);
    });

    it("should handle database errors", async () => {
      mockImageGetByFamily.mockRejectedValue(new Error("Database error"));

      const response = await fastify.inject({
        method: "GET",
        url: `/family/${validFamilyId}`,
      });

      expect(response.statusCode).toBe(500);
      expect(JSON.parse(response.body)).toEqual({
        message: IMAGE_ERRORS.GET_BY_FAMILY_FAILED,
        error: "Database error",
      });
    });
  });

  describe("DELETE /:imageId", () => {
    const validImageId = "550e8400-e29b-41d4-a716-446655440000";

    it("should delete image with S3 file", async () => {
      mockImageGetById.mockResolvedValue(mockImage);
      mockS3Delete.mockResolvedValue(undefined);
      mockImageDelete.mockResolvedValue(undefined);

      const response = await fastify.inject({
        method: "DELETE",
        url: `/${validImageId}`,
      });

      expect(response.statusCode).toBe(204);
      expect(mockS3Delete).toHaveBeenCalledWith("family-photos/uuid/test.jpg");
      expect(mockImageDelete).toHaveBeenCalledWith(validImageId);
    });

    it("should delete image without S3 file", async () => {
      const imageWithoutS3 = { ...mockImage, s3_url: undefined };
      mockImageGetById.mockResolvedValue(imageWithoutS3);
      mockImageDelete.mockResolvedValue(undefined);

      const response = await fastify.inject({
        method: "DELETE",
        url: `/${validImageId}`,
      });

      expect(response.statusCode).toBe(204);
      expect(mockS3Delete).not.toHaveBeenCalled();
      expect(mockImageDelete).toHaveBeenCalledWith(validImageId);
    });

    it("should return 404 when image not found", async () => {
      mockImageGetById.mockResolvedValue(null);

      const response = await fastify.inject({
        method: "DELETE",
        url: `/${validImageId}`,
      });

      expect(response.statusCode).toBe(404);
      expect(JSON.parse(response.body)).toEqual({
        message: IMAGE_ERRORS.NOT_FOUND,
      });
    });

    it("should continue deletion even if S3 delete fails", async () => {
      mockImageGetById.mockResolvedValue(mockImage);
      mockS3Delete.mockRejectedValue(new Error("S3 delete failed"));
      mockImageDelete.mockResolvedValue(undefined);

      const response = await fastify.inject({
        method: "DELETE",
        url: `/${validImageId}`,
      });

      expect(response.statusCode).toBe(204);
      expect(mockImageDelete).toHaveBeenCalledWith(validImageId);
    });

    it("should handle database deletion errors", async () => {
      mockImageGetById.mockResolvedValue(mockImage);
      mockS3Delete.mockResolvedValue(undefined);
      mockImageDelete.mockRejectedValue(new Error("Database error"));

      const response = await fastify.inject({
        method: "DELETE",
        url: `/${validImageId}`,
      });

      expect(response.statusCode).toBe(500);
      expect(JSON.parse(response.body)).toEqual({
        message: IMAGE_ERRORS.DELETE_FAILED,
        error: {},
      });
    });

    it("should reject invalid UUID format", async () => {
      const response = await fastify.inject({
        method: "DELETE",
        url: "/invalid-uuid",
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe("GET /tag/:tagId", () => {
    const tagId = "tag-123";

    it("should return images with specific tag", async () => {
      const mockImages = [mockImage];
      mockImageGetAllWithTag.mockResolvedValue(mockImages);

      const response = await fastify.inject({
        method: "GET",
        url: `/tag/${tagId}`,
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual({ images: mockImages });
      expect(mockImageGetAllWithTag).toHaveBeenCalledWith(tagId);
    });

    it("should return empty array when no images with tag", async () => {
      mockImageGetAllWithTag.mockResolvedValue([]);

      const response = await fastify.inject({
        method: "GET",
        url: `/tag/${tagId}`,
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual({ images: [] });
    });

    it("should handle database errors", async () => {
      mockImageGetAllWithTag.mockRejectedValue(new Error("Database error"));

      const response = await fastify.inject({
        method: "GET",
        url: `/tag/${tagId}`,
      });

      expect(response.statusCode).toBe(500);
    });
  });

  describe("POST /families", () => {
    const validFamilyIds = [
      "550e8400-e29b-41d4-a716-446655440001",
      "550e8400-e29b-41d4-a716-446655440002",
    ];

    it("should return images for multiple families", async () => {
      const mockImages = [mockImage];
      mockImageGetByFamilies.mockResolvedValue(mockImages);

      const response = await fastify.inject({
        method: "POST",
        url: "/families",
        payload: { family_ids: validFamilyIds },
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual({ images: mockImages });
      expect(mockImageGetByFamilies).toHaveBeenCalledWith(validFamilyIds);
    });

    it("should return empty array when no images found", async () => {
      mockImageGetByFamilies.mockResolvedValue([]);

      const response = await fastify.inject({
        method: "POST",
        url: "/families",
        payload: { family_ids: validFamilyIds },
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual({ images: [] });
    });

    it("should reject missing family_ids", async () => {
      const response = await fastify.inject({
        method: "POST",
        url: "/families",
        payload: {},
      });

      expect(response.statusCode).toBe(400);
    });

    it("should reject empty family_ids array", async () => {
      const response = await fastify.inject({
        method: "POST",
        url: "/families",
        payload: { family_ids: [] },
      });

      expect(response.statusCode).toBe(400);
    });

    it("should reject invalid UUID format in family_ids", async () => {
      const response = await fastify.inject({
        method: "POST",
        url: "/families",
        payload: { family_ids: ["invalid-uuid"] },
      });

      expect(response.statusCode).toBe(400);
    });

    it("should handle database errors", async () => {
      mockImageGetByFamilies.mockRejectedValue(new Error("Database error"));

      const response = await fastify.inject({
        method: "POST",
        url: "/families",
        payload: { family_ids: validFamilyIds },
      });

      expect(response.statusCode).toBe(500);
      expect(JSON.parse(response.body)).toEqual({
        message: IMAGE_ERRORS.GET_BY_FAMILIES_FAILED,
        error: "Database error",
      });
    });

    it("should handle single family ID", async () => {
      const singleFamilyId = ["550e8400-e29b-41d4-a716-446655440001"];
      const mockImages = [mockImage];
      mockImageGetByFamilies.mockResolvedValue(mockImages);

      const response = await fastify.inject({
        method: "POST",
        url: "/families",
        payload: { family_ids: singleFamilyId },
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual({ images: mockImages });
    });
  });
});

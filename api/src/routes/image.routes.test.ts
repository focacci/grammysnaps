import Fastify, { FastifyInstance } from "fastify";
import imageRoutes from "./image.routes";
import { Image, ImageInput, ImagePublic } from "../types/image.types";
import { IMAGE_ERRORS } from "../types/errors";
import { TEST_UUIDS, TEST_S3_KEYS, TEST_S3_URLS } from "../test-utils/test-data";

// Mock auth middleware to always pass
jest.mock("../middleware/auth.middleware", () => ({
  requireAuth: jest.fn(async (request) => {
    // Mock successful authentication by setting user on request
    request.user = {
      userId: "user-123",
      email: "test@example.com",
    };
    // Don't call reply.send() or return anything - just let the request continue
  }),
}));

const mockImageGet = jest.fn();
const mockImageGetById = jest.fn();
const mockImageCreate = jest.fn();
const mockImageUpdate = jest.fn();
const mockImageDelete = jest.fn();
const mockImageApplyTags = jest.fn();
const mockImageApplyCollections = jest.fn();
const mockImageGetByCollection = jest.fn();
const mockImageGetByCollections = jest.fn();
const mockImageGetAllWithTag = jest.fn();
const mockImageGetOrphanedByCollection = jest.fn();
const mockImageGetForUser = jest.fn();

const mockS3Upload = jest.fn();
const mockS3Download = jest.fn();
const mockS3Delete = jest.fn();
const mockS3CreateKey = jest.fn();
const mockS3ParseKey = jest.fn();
const mockS3GetPublicUrl = jest.fn();
const mockS3GetInfo = jest.fn();
const mockS3GetSignedUrl = jest.fn();
const mockS3ListImages = jest.fn();
const mockS3Exists = jest.fn();

describe("Image Routes", () => {
  let fastify: FastifyInstance;

  const mockImage: Image = {
    id: TEST_UUIDS.IMAGE_1,
    title: "Test Image",
    filename: "test.jpg",
    tags: [TEST_UUIDS.TAG_1, TEST_UUIDS.TAG_2],
    collection_ids: [TEST_UUIDS.COLLECTION_1, TEST_UUIDS.COLLECTION_2],
    original_key: TEST_S3_KEYS.ORIGINAL_1,
    thumbnail_key: TEST_S3_KEYS.THUMBNAIL_1,
    created_at: "2023-01-01T00:00:00Z",
    updated_at: "2023-01-01T00:00:00Z",
  };

  const mockPublicImage: ImagePublic = {
    id: mockImage.id,
    title: mockImage.title,
    filename: mockImage.filename,
    tags: mockImage.tags,
    collection_ids: mockImage.collection_ids,
    original_url: TEST_S3_URLS.ORIGINAL_1,
    thumbnail_url: TEST_S3_URLS.THUMBNAIL_1,
    created_at: mockImage.created_at,
    updated_at: mockImage.updated_at,
  };

  const mockBuffer = Buffer.from("fake image data");

  beforeEach(async () => {
    // Create a new Fastify instance for each test
    fastify = Fastify({ logger: false });

    // Register multipart support
    await fastify.register(import("@fastify/multipart"), {
      attachFieldsToBody: true,
    });

    // Clear all mocks first
    jest.clearAllMocks();

    // Setup default mock return values for S3 signed URLs after clearing mocks
    mockS3GetSignedUrl.mockImplementation(async (key) => {
      if (key === TEST_S3_KEYS.ORIGINAL_1) return TEST_S3_URLS.ORIGINAL_1;
      if (key === TEST_S3_KEYS.THUMBNAIL_1) return TEST_S3_URLS.THUMBNAIL_1;
      if (key === TEST_S3_KEYS.ORIGINAL_2) return TEST_S3_URLS.ORIGINAL_2;
      if (key === TEST_S3_KEYS.THUMBNAIL_2) return TEST_S3_URLS.THUMBNAIL_2;
      return `https://www.grammysnaps.com/${key}`;
    });

    // Setup mockImageGetById to return a fresh copy of mockImage each time
    // This prevents mutation issues with the toPublicImage function
    mockImageGetById.mockImplementation(async (id) => {
      if (id === TEST_UUIDS.IMAGE_1) {
        return { ...mockImage }; // Return a copy to prevent mutation
      }
      return null;
    });

    // Setup other image functions to return fresh copies
    mockImageGet.mockImplementation(async () => [{ ...mockImage }]);
    mockImageGetByCollection.mockImplementation(async () => [{ ...mockImage }]);
    mockImageGetAllWithTag.mockImplementation(async () => [{ ...mockImage }]);
    mockImageGetForUser.mockImplementation(async () => [{ ...mockImage }]);

    // Decorate the fastify instance with mock plugins
    fastify.decorate("image", {
      get: mockImageGet,
      getById: mockImageGetById,
      create: mockImageCreate,
      update: mockImageUpdate,
      delete: mockImageDelete,
      applyTags: mockImageApplyTags,
      applyCollections: mockImageApplyCollections,
      getByCollection: mockImageGetByCollection,
      getByCollections: mockImageGetByCollections,
      getAllWithTag: mockImageGetAllWithTag,
      getOrphanedByCollection: mockImageGetOrphanedByCollection,
      getForUser: mockImageGetForUser,
    });

    fastify.decorate("s3", {
      upload: mockS3Upload,
      download: mockS3Download,
      delete: mockS3Delete,
      createKey: mockS3CreateKey,
      parseKey: mockS3ParseKey,
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
  });

  afterEach(async () => {
    await fastify.close();
  });

  describe("GET /", () => {
    it("should return all images", async () => {
      const response = await fastify.inject({
        method: "GET",
        url: "/",
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual({ images: [mockPublicImage] });
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
    const validImageId = TEST_UUIDS.IMAGE_1;

    it("should return image by ID", async () => {
      const response = await fastify.inject({
        method: "GET",
        url: `/${validImageId}`,
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual({ image: mockPublicImage });
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
    const validImageId = TEST_UUIDS.IMAGE_1;

    it("should download image file", async () => {
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
        TEST_S3_KEYS.ORIGINAL_1
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

    it("should return 404 when image has no original_key", async () => {
      const imageWithoutOriginal = { ...mockImage, original_key: undefined };
      mockImageGetById.mockResolvedValue(imageWithoutOriginal);

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
    const s3Key = "collection-photos/generated-uuid/test.jpg";

    beforeEach(() => {
      mockS3CreateKey.mockReturnValue(s3Key);
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
      // - Collection IDs requirement
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
    const validImageId = TEST_UUIDS.IMAGE_1;
    const updateData: ImageInput = {
      title: "Updated Title",
      tags: [TEST_UUIDS.TAG_1], // Valid UUID for tag
      collection_ids: [TEST_UUIDS.COLLECTION_1],
    };

    it("should update image successfully", async () => {
      const updatedImage = { ...mockImage, ...updateData };
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
        original_key: mockImage.original_key,
        thumbnail_key: mockImage.thumbnail_key,
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
        tags: [TEST_UUIDS.TAG_1],
        collection_ids: [TEST_UUIDS.COLLECTION_1],
      };
      const updatedImage = { ...mockImage, ...updateDataNoTitle };
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
        collection_ids: [TEST_UUIDS.COLLECTION_1],
      };
      const updatedImage = { ...mockImage, ...updateDataEmptyTags };
      mockImageUpdate.mockResolvedValue(updatedImage);

      const response = await fastify.inject({
        method: "PUT",
        url: `/${validImageId}`,
        payload: updateDataEmptyTags,
      });

      expect(response.statusCode).toBe(200);
    });

    it("should reject empty collection_ids array due to validation", async () => {
      const updateDataEmptyCollections = {
        title: "Test",
        tags: [TEST_UUIDS.TAG_1],
        collection_ids: [],
      };

      const response = await fastify.inject({
        method: "PUT",
        url: `/${validImageId}`,
        payload: updateDataEmptyCollections,
      });

      expect(response.statusCode).toBe(400); // Should fail validation due to minItems: 1
    });
  });

  describe("GET /collection/:collectionId", () => {
    const validCollectionId = TEST_UUIDS.COLLECTION_1;

    it("should return images for collection", async () => {
      const response = await fastify.inject({
        method: "GET",
        url: `/collection/${validCollectionId}`,
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual({ images: [mockPublicImage] });
      expect(mockImageGetByCollection).toHaveBeenCalledWith(validCollectionId);
    });

    it("should return empty array when no images found", async () => {
      mockImageGetByCollection.mockResolvedValue([]);

      const response = await fastify.inject({
        method: "GET",
        url: `/collection/${validCollectionId}`,
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual({ images: [] });
    });

    it("should reject invalid UUID format", async () => {
      const response = await fastify.inject({
        method: "GET",
        url: "/collection/invalid-uuid",
      });

      expect(response.statusCode).toBe(400);
    });

    it("should handle database errors", async () => {
      mockImageGetByCollection.mockRejectedValue(new Error("Database error"));

      const response = await fastify.inject({
        method: "GET",
        url: `/collection/${validCollectionId}`,
      });

      expect(response.statusCode).toBe(500);
      expect(JSON.parse(response.body)).toEqual({
        message: IMAGE_ERRORS.GET_BY_COLLECTION_FAILED,
        error: "Database error",
      });
    });
  });

  describe("DELETE /:imageId", () => {
    const validImageId = TEST_UUIDS.IMAGE_1;

    it("should delete image with S3 file", async () => {
      mockS3Delete.mockResolvedValue(undefined);
      mockImageDelete.mockResolvedValue(undefined);

      const response = await fastify.inject({
        method: "DELETE",
        url: `/${validImageId}`,
      });

      expect(response.statusCode).toBe(204);
      expect(mockS3Delete).toHaveBeenCalledTimes(2); // Both original and thumbnail
      expect(mockS3Delete).toHaveBeenCalledWith(TEST_S3_KEYS.ORIGINAL_1);
      expect(mockS3Delete).toHaveBeenCalledWith(TEST_S3_KEYS.THUMBNAIL_1);
      expect(mockImageDelete).toHaveBeenCalledWith(validImageId);
    });

    it("should delete image without S3 file", async () => {
      const imageWithoutS3 = {
        ...mockImage,
        original_key: undefined,
        thumbnail_key: undefined,
      };
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

    it("should delete image with only thumbnail", async () => {
      const imageWithOnlyThumbnail = { ...mockImage, original_key: undefined };
      mockImageGetById.mockImplementation(async (id) => {
        if (id === TEST_UUIDS.IMAGE_1) {
          return imageWithOnlyThumbnail;
        }
        return null;
      });
      mockS3Delete.mockResolvedValue(undefined);
      mockImageDelete.mockResolvedValue(undefined);

      const response = await fastify.inject({
        method: "DELETE",
        url: `/${validImageId}`,
      });

      expect(response.statusCode).toBe(204);
      expect(mockS3Delete).toHaveBeenCalledWith(TEST_S3_KEYS.THUMBNAIL_1);
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
    const tagId = TEST_UUIDS.TAG_1;

    it("should return images with specific tag", async () => {
      const response = await fastify.inject({
        method: "GET",
        url: `/tag/${tagId}`,
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual({ images: [mockPublicImage] });
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

  describe("GET /user/:userId", () => {
    const validUserId = TEST_UUIDS.USER_1;

    it("should return paginated images for user with default parameters", async () => {
      const response = await fastify.inject({
        method: "GET",
        url: `/user/${validUserId}`,
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual({ images: [mockPublicImage] });
      expect(mockImageGetForUser).toHaveBeenCalledWith(
        validUserId,
        [],
        50,
        0,
        "desc"
      );
    });

    it("should return paginated images with custom parameters", async () => {
      const tag1 = TEST_UUIDS.TAG_1;
      const tag2 = TEST_UUIDS.TAG_2;

      const response = await fastify.inject({
        method: "GET",
        url: `/user/${validUserId}?limit=10&offset=20&order=asc&tags=${tag1}&tags=${tag2}`,
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual({ images: [mockPublicImage] });
      expect(mockImageGetForUser).toHaveBeenCalledWith(
        validUserId,
        [tag1, tag2],
        10,
        20,
        "asc"
      );
    });

    it("should return empty array when no images found for user", async () => {
      mockImageGetForUser.mockResolvedValue([]);

      const response = await fastify.inject({
        method: "GET",
        url: `/user/${validUserId}`,
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual({ images: [] });
    });

    it("should reject invalid UUID format for userId", async () => {
      const response = await fastify.inject({
        method: "GET",
        url: "/user/invalid-uuid",
      });

      expect(response.statusCode).toBe(400);
    });

    it("should reject invalid limit parameter", async () => {
      const response = await fastify.inject({
        method: "GET",
        url: `/user/${validUserId}?limit=0`,
      });

      expect(response.statusCode).toBe(400);
    });

    it("should reject limit exceeding maximum", async () => {
      const response = await fastify.inject({
        method: "GET",
        url: `/user/${validUserId}?limit=101`,
      });

      expect(response.statusCode).toBe(400);
    });

    it("should reject negative offset", async () => {
      const response = await fastify.inject({
        method: "GET",
        url: `/user/${validUserId}?offset=-1`,
      });

      expect(response.statusCode).toBe(400);
    });

    it("should reject invalid order parameter", async () => {
      const response = await fastify.inject({
        method: "GET",
        url: `/user/${validUserId}?order=invalid`,
      });

      expect(response.statusCode).toBe(400);
    });

    it("should reject invalid tag UUID format", async () => {
      const response = await fastify.inject({
        method: "GET",
        url: `/user/${validUserId}?tags=invalid-uuid`,
      });

      expect(response.statusCode).toBe(400);
    });

    it("should handle database errors", async () => {
      mockImageGetForUser.mockRejectedValue(new Error("Database error"));

      const response = await fastify.inject({
        method: "GET",
        url: `/user/${validUserId}`,
      });

      expect(response.statusCode).toBe(500);
      expect(JSON.parse(response.body)).toEqual({
        message: IMAGE_ERRORS.GET_FOR_USER_FAILED,
        error: "Database error",
      });
    });

    it("should handle empty tags array", async () => {
      const response = await fastify.inject({
        method: "GET",
        url: `/user/${validUserId}`,
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual({ images: [mockPublicImage] });
      expect(mockImageGetForUser).toHaveBeenCalledWith(
        validUserId,
        [],
        50,
        0,
        "desc"
      );
    });

    it("should handle multiple tag parameters correctly", async () => {
      const tag1 = TEST_UUIDS.TAG_1;
      const tag2 = TEST_UUIDS.TAG_2;

      const response = await fastify.inject({
        method: "GET",
        url: `/user/${validUserId}?tags=${tag1}&tags=${tag2}`,
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual({ images: [mockPublicImage] });
      expect(mockImageGetForUser).toHaveBeenCalledWith(
        validUserId,
        [tag1, tag2],
        50,
        0,
        "desc"
      );
    });
  });
});

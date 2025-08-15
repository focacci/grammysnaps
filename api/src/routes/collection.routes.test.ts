import Fastify, { FastifyInstance } from "fastify";
import collectionRoutes from "./collection.routes";
import {
  Collection,
  CollectionUpdate,
  CollectionPublic,
  CollectionMember,
  RelatedCollection,
} from "../types/collection.types";
import { COLLECTION_ERRORS } from "../types/errors";
import { TEST_UUIDS } from "../test-utils/test-data";

// Mock auth middleware to always pass
jest.mock("../middleware/auth.middleware", () => ({
  requireAuth: jest.fn(async (request) => {
    // Mock successful authentication by setting user on request
    request.user = {
      userId: TEST_UUIDS.USER_1,
      email: "test@example.com",
    };
    // Don't call reply.send() or return anything - just let the request continue
  }),
}));

const mockCollectionCreate = jest.fn();
const mockCollectionGet = jest.fn();
const mockCollectionGetById = jest.fn();
const mockCollectionExists = jest.fn();
const mockCollectionGetUserCollections = jest.fn();
const mockCollectionGetMembers = jest.fn();
const mockCollectionGetRelatedCollections = jest.fn();
const mockCollectionAddRelatedCollection = jest.fn();
const mockCollectionRemoveRelatedCollection = jest.fn();
const mockCollectionUpdate = jest.fn();
const mockCollectionDelete = jest.fn();
const mockCollectionAddMember = jest.fn();
const mockCollectionRemoveMember = jest.fn();

describe("Collection Routes", () => {
  let fastify: FastifyInstance;

  const mockCollection: Collection = {
    id: TEST_UUIDS.COLLECTION_1,
    name: "The Smiths",
    members: [TEST_UUIDS.USER_1, TEST_UUIDS.USER_2],
    owner_id: TEST_UUIDS.USER_1,
    related_collections: [TEST_UUIDS.COLLECTION_2],
    created_at: "2023-01-01T00:00:00Z",
    updated_at: "2023-01-01T00:00:00Z",
  };

  const mockCollectionPublic: CollectionPublic = {
    id: TEST_UUIDS.COLLECTION_1,
    name: "The Smiths",
    member_count: 2,
    owner_id: TEST_UUIDS.USER_1,
    user_role: "owner",
    related_collections: [TEST_UUIDS.COLLECTION_2],
    created_at: "2023-01-01T00:00:00Z",
    updated_at: "2023-01-01T00:00:00Z",
  };

  const mockCollectionMember: CollectionMember = {
    id: TEST_UUIDS.USER_1,
    email: "john@example.com",
    first_name: "John",
    middle_name: null,
    last_name: "Smith",
    birthday: "1990-01-01",
    collections: [TEST_UUIDS.COLLECTION_1],
    profile_picture_key: null,
    profile_picture_thumbnail_key: null,
    created_at: "2023-01-01T00:00:00Z",
    updated_at: "2023-01-01T00:00:00Z",
    role: "owner",
    joined_at: "2023-01-01T00:00:00Z",
  };

  const mockRelatedCollection: RelatedCollection = {
    id: TEST_UUIDS.COLLECTION_2,
    name: "The Johnsons",
    member_count: 3,
    created_at: "2023-01-01T00:00:00Z",
  };

  beforeEach(async () => {
    // Create a new Fastify instance for each test
    fastify = Fastify({ logger: false });

    // Decorate the fastify instance with mock plugin
    fastify.decorate("collection", {
      create: mockCollectionCreate,
      get: mockCollectionGet,
      getById: mockCollectionGetById,
      exists: mockCollectionExists,
      getUserCollections: mockCollectionGetUserCollections,
      getMembers: mockCollectionGetMembers,
      getRelatedCollections: mockCollectionGetRelatedCollections,
      addRelatedCollection: mockCollectionAddRelatedCollection,
      removeRelatedCollection: mockCollectionRemoveRelatedCollection,
      update: mockCollectionUpdate,
      delete: mockCollectionDelete,
      addMember: mockCollectionAddMember,
      removeMember: mockCollectionRemoveMember,
    });

    // Register collection routes
    await fastify.register(collectionRoutes);

    // Wait for all plugins to be ready
    await fastify.ready();

    // Clear all mocks
    jest.clearAllMocks();
  });

  afterEach(async () => {
    await fastify.close();
  });

  describe("GET /", () => {
    it("should successfully get all collections", async () => {
      const mockCollections = [mockCollectionPublic];
      mockCollectionGet.mockResolvedValue(mockCollections);

      const response = await fastify.inject({
        method: "GET",
        url: "/",
      });

      expect(response.statusCode).toBe(200);
      const responseBody = JSON.parse(response.body);
      expect(responseBody).toEqual(mockCollections);
      expect(mockCollectionGet).toHaveBeenCalledWith();
    });

    it("should return 500 for database error", async () => {
      mockCollectionGet.mockRejectedValue(new Error("Database error"));

      const response = await fastify.inject({
        method: "GET",
        url: "/",
      });

      expect(response.statusCode).toBe(500);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.error).toBe(COLLECTION_ERRORS.RETRIEVE_FAILED);
    });
  });

  describe("GET /user/:userId", () => {
    it("should successfully get collections for a user", async () => {
      const mockCollections = [mockCollectionPublic];
      mockCollectionGetUserCollections.mockResolvedValue(mockCollections);

      const response = await fastify.inject({
        method: "GET",
        url: `/user/${TEST_UUIDS.USER_1}`,
      });

      expect(response.statusCode).toBe(200);
      const responseBody = JSON.parse(response.body);
      expect(responseBody).toEqual(mockCollections);
      expect(mockCollectionGetUserCollections).toHaveBeenCalledWith(TEST_UUIDS.USER_1);
    });

    it("should return 500 for database error", async () => {
      mockCollectionGetUserCollections.mockRejectedValue(new Error("Database error"));

      const response = await fastify.inject({
        method: "GET",
        url: `/user/${TEST_UUIDS.USER_1}`,
      });

      expect(response.statusCode).toBe(500);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.error).toBe(
        COLLECTION_ERRORS.RETRIEVE_USER_COLLECTIONS_FAILED
      );
    });
  });

  describe("GET /:id", () => {
    it("should successfully get collection by ID", async () => {
      mockCollectionGetById.mockResolvedValue(mockCollection);

      const response = await fastify.inject({
        method: "GET",
        url: `/${TEST_UUIDS.COLLECTION_1}`,
      });

      expect(response.statusCode).toBe(200);
      const responseBody = JSON.parse(response.body);
      expect(responseBody).toEqual(mockCollection);
      expect(mockCollectionGetById).toHaveBeenCalledWith(TEST_UUIDS.COLLECTION_1);
    });

    it("should return 404 for non-existent collection", async () => {
      mockCollectionGetById.mockResolvedValue(null);

      const response = await fastify.inject({
        method: "GET",
        url: `/${TEST_UUIDS.COLLECTION_1}`,
      });

      expect(response.statusCode).toBe(404);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.error).toBe(COLLECTION_ERRORS.NOT_FOUND);
    });

    it("should return 500 for database error", async () => {
      mockCollectionGetById.mockRejectedValue(new Error("Database error"));

      const response = await fastify.inject({
        method: "GET",
        url: `/${TEST_UUIDS.COLLECTION_1}`,
      });

      expect(response.statusCode).toBe(500);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.error).toBe(COLLECTION_ERRORS.GET_BY_ID_FAILED);
    });
  });

  describe("GET /:id/members", () => {
    it("should successfully get collection members", async () => {
      const mockMembers = [mockCollectionMember];
      mockCollectionGetMembers.mockResolvedValue(mockMembers);

      const response = await fastify.inject({
        method: "GET",
        url: `/${TEST_UUIDS.COLLECTION_1}/members`,
      });

      expect(response.statusCode).toBe(200);
      const responseBody = JSON.parse(response.body);
      expect(responseBody).toEqual(mockMembers);
      expect(mockCollectionGetMembers).toHaveBeenCalledWith(TEST_UUIDS.COLLECTION_1);
    });

    it("should return 500 for database error", async () => {
      mockCollectionGetMembers.mockRejectedValue(new Error("Database error"));

      const response = await fastify.inject({
        method: "GET",
        url: `/${TEST_UUIDS.COLLECTION_1}/members`,
      });

      expect(response.statusCode).toBe(500);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.error).toBe(COLLECTION_ERRORS.GET_MEMBERS_FAILED);
    });
  });

  describe("POST /", () => {
    const validCollectionData = {
      name: "The Johnsons",
      description: "A lovely collection",
      owner_id: TEST_UUIDS.USER_1,
    };

    it("should successfully create a new collection", async () => {
      mockCollectionCreate.mockResolvedValue(mockCollectionPublic);

      const response = await fastify.inject({
        method: "POST",
        url: "/",
        payload: validCollectionData,
      });

      expect(response.statusCode).toBe(201);
      const responseBody = JSON.parse(response.body);
      expect(responseBody).toEqual(mockCollectionPublic);
      expect(mockCollectionCreate).toHaveBeenCalledWith(
        { name: "The Johnsons", description: "A lovely collection" },
        TEST_UUIDS.USER_1
      );
    });

    it("should return 400 for missing owner_id", async () => {
      const response = await fastify.inject({
        method: "POST",
        url: "/",
        payload: {
          name: "The Johnsons",
        },
      });

      expect(response.statusCode).toBe(400);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.error).toBe(COLLECTION_ERRORS.OWNER_ID_REQUIRED);
    });

    it("should return 400 for missing collection name", async () => {
      const response = await fastify.inject({
        method: "POST",
        url: "/",
        payload: {
          owner_id: TEST_UUIDS.USER_1,
        },
      });

      expect(response.statusCode).toBe(400);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.error).toBe(COLLECTION_ERRORS.NAME_REQUIRED);
    });

    it("should return 400 for empty collection name", async () => {
      const response = await fastify.inject({
        method: "POST",
        url: "/",
        payload: {
          name: "   ",
          owner_id: TEST_UUIDS.USER_1,
        },
      });

      expect(response.statusCode).toBe(400);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.error).toBe(COLLECTION_ERRORS.NAME_REQUIRED);
    });

    it("should return 500 for database error", async () => {
      mockCollectionCreate.mockRejectedValue(
        new Error(COLLECTION_ERRORS.CREATE_FAILED)
      );

      const response = await fastify.inject({
        method: "POST",
        url: "/",
        payload: validCollectionData,
      });

      expect(response.statusCode).toBe(500);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.error).toBe(COLLECTION_ERRORS.CREATE_FAILED);
    });

    it("should return 500 for unexpected error", async () => {
      mockCollectionCreate.mockRejectedValue("String error");

      const response = await fastify.inject({
        method: "POST",
        url: "/",
        payload: validCollectionData,
      });

      expect(response.statusCode).toBe(500);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.error).toBe(COLLECTION_ERRORS.CREATE_FAILED);
    });
  });

  describe("PUT /:id", () => {
    const validUpdateData: CollectionUpdate = {
      name: "Updated Collection Name",
      description: "Updated description",
    };

    it("should successfully update collection", async () => {
      const updatedCollection = { ...mockCollection, ...validUpdateData };
      mockCollectionUpdate.mockResolvedValue(updatedCollection);

      const response = await fastify.inject({
        method: "PUT",
        url: `/${TEST_UUIDS.COLLECTION_1}`,
        payload: validUpdateData,
      });

      expect(response.statusCode).toBe(200);
      const responseBody = JSON.parse(response.body);
      expect(responseBody).toEqual(updatedCollection);
      expect(mockCollectionUpdate).toHaveBeenCalledWith(
        TEST_UUIDS.COLLECTION_1,
        validUpdateData
      );
    });

    it("should return 404 for non-existent collection", async () => {
      mockCollectionUpdate.mockResolvedValue(null);

      const response = await fastify.inject({
        method: "PUT",
        url: `/${TEST_UUIDS.COLLECTION_1}`,
        payload: validUpdateData,
      });

      expect(response.statusCode).toBe(404);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.error).toBe(COLLECTION_ERRORS.UPDATE_NOT_FOUND);
    });

    it("should return 500 for database error", async () => {
      mockCollectionUpdate.mockRejectedValue(new Error("Update error"));

      const response = await fastify.inject({
        method: "PUT",
        url: `/${TEST_UUIDS.COLLECTION_1}`,
        payload: validUpdateData,
      });

      expect(response.statusCode).toBe(500);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.error).toBe("Update error");
    });

    it("should return 500 for unexpected error", async () => {
      mockCollectionUpdate.mockRejectedValue("String error");

      const response = await fastify.inject({
        method: "PUT",
        url: `/${TEST_UUIDS.COLLECTION_1}`,
        payload: validUpdateData,
      });

      expect(response.statusCode).toBe(500);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.error).toBe(COLLECTION_ERRORS.UPDATE_FAILED);
    });

    it("should handle empty update data", async () => {
      const updatedCollection = mockCollection;
      mockCollectionUpdate.mockResolvedValue(updatedCollection);

      const response = await fastify.inject({
        method: "PUT",
        url: `/${TEST_UUIDS.COLLECTION_1}`,
        payload: {},
      });

      expect(response.statusCode).toBe(200);
      expect(mockCollectionUpdate).toHaveBeenCalledWith(TEST_UUIDS.COLLECTION_1, {});
    });
  });

  describe("DELETE /:id", () => {
    it("should successfully delete collection", async () => {
      mockCollectionDelete.mockResolvedValue(undefined);

      const response = await fastify.inject({
        method: "DELETE",
        url: `/${TEST_UUIDS.COLLECTION_1}`,
      });

      expect(response.statusCode).toBe(204);
      expect(response.body).toBe("");
      expect(mockCollectionDelete).toHaveBeenCalledWith(TEST_UUIDS.COLLECTION_1);
    });

    it("should return 500 for database error", async () => {
      mockCollectionDelete.mockRejectedValue(
        new Error(COLLECTION_ERRORS.DELETE_FAILED)
      );

      const response = await fastify.inject({
        method: "DELETE",
        url: `/${TEST_UUIDS.COLLECTION_1}`,
      });

      expect(response.statusCode).toBe(500);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.error).toBe(COLLECTION_ERRORS.DELETE_FAILED);
    });

    it("should return 500 for unexpected error", async () => {
      mockCollectionDelete.mockRejectedValue("String error");

      const response = await fastify.inject({
        method: "DELETE",
        url: `/${TEST_UUIDS.COLLECTION_1}`,
      });

      expect(response.statusCode).toBe(500);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.error).toBe(COLLECTION_ERRORS.DELETE_FAILED);
    });
  });

  describe("POST /:id/members", () => {
    const validMemberData = {
      user_id: TEST_UUIDS.USER_2,
    };

    it("should successfully add member to collection", async () => {
      mockCollectionAddMember.mockResolvedValue(undefined);

      const response = await fastify.inject({
        method: "POST",
        url: `/${TEST_UUIDS.COLLECTION_1}/members`,
        payload: validMemberData,
      });

      expect(response.statusCode).toBe(200);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.message).toBe("Member added successfully");
      expect(mockCollectionAddMember).toHaveBeenCalledWith(
        TEST_UUIDS.COLLECTION_1,
        TEST_UUIDS.USER_2
      );
    });

    it("should return 400 for missing user_id", async () => {
      const response = await fastify.inject({
        method: "POST",
        url: `/${TEST_UUIDS.COLLECTION_1}/members`,
        payload: {},
      });

      expect(response.statusCode).toBe(400);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.error).toBe(COLLECTION_ERRORS.USER_ID_REQUIRED);
    });

    it("should return 500 for database error", async () => {
      mockCollectionAddMember.mockRejectedValue(new Error("Add member error"));

      const response = await fastify.inject({
        method: "POST",
        url: `/${TEST_UUIDS.COLLECTION_1}/members`,
        payload: validMemberData,
      });

      expect(response.statusCode).toBe(500);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.error).toBe("Add member error");
    });

    it("should return 500 for unexpected error", async () => {
      mockCollectionAddMember.mockRejectedValue("String error");

      const response = await fastify.inject({
        method: "POST",
        url: `/${TEST_UUIDS.COLLECTION_1}/members`,
        payload: validMemberData,
      });

      expect(response.statusCode).toBe(500);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.error).toBe(COLLECTION_ERRORS.ADD_MEMBER_FAILED);
    });
  });

  describe("DELETE /:id/members/:userId", () => {
    it("should successfully remove member from collection", async () => {
      mockCollectionRemoveMember.mockResolvedValue(undefined);

      const response = await fastify.inject({
        method: "DELETE",
        url: `/${TEST_UUIDS.COLLECTION_1}/members/${TEST_UUIDS.USER_2}`,
      });

      expect(response.statusCode).toBe(200);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.message).toBe("Member removed successfully");
      expect(mockCollectionRemoveMember).toHaveBeenCalledWith(
        TEST_UUIDS.COLLECTION_1,
        TEST_UUIDS.USER_2
      );
    });

    it("should return 500 for database error", async () => {
      mockCollectionRemoveMember.mockRejectedValue(
        new Error("Remove member error")
      );

      const response = await fastify.inject({
        method: "DELETE",
        url: `/${TEST_UUIDS.COLLECTION_1}/members/${TEST_UUIDS.USER_2}`,
      });

      expect(response.statusCode).toBe(500);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.error).toBe("Remove member error");
    });

    it("should return 500 for unexpected error", async () => {
      mockCollectionRemoveMember.mockRejectedValue("String error");

      const response = await fastify.inject({
        method: "DELETE",
        url: `/${TEST_UUIDS.COLLECTION_1}/members/${TEST_UUIDS.USER_2}`,
      });

      expect(response.statusCode).toBe(500);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.error).toBe(COLLECTION_ERRORS.REMOVE_MEMBER_FAILED);
    });
  });

  describe("GET /:id/related", () => {
    it("should successfully get related collections", async () => {
      const mockRelatedCollections = [mockRelatedCollection];
      mockCollectionGetRelatedCollections.mockResolvedValue(mockRelatedCollections);

      const response = await fastify.inject({
        method: "GET",
        url: `/${TEST_UUIDS.COLLECTION_1}/related`,
      });

      expect(response.statusCode).toBe(200);
      const responseBody = JSON.parse(response.body);
      expect(responseBody).toEqual(mockRelatedCollections);
      expect(mockCollectionGetRelatedCollections).toHaveBeenCalledWith(TEST_UUIDS.COLLECTION_1);
    });

    it("should return 500 for database error", async () => {
      mockCollectionGetRelatedCollections.mockRejectedValue(
        new Error("Database error")
      );

      const response = await fastify.inject({
        method: "GET",
        url: `/${TEST_UUIDS.COLLECTION_1}/related`,
      });

      expect(response.statusCode).toBe(500);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.error).toBe(COLLECTION_ERRORS.GET_RELATED_FAILED);
    });
  });

  describe("POST /:id/related", () => {
    const validRelatedCollectionData = {
      collection_id: TEST_UUIDS.COLLECTION_2,
    };

    it("should successfully add related collection", async () => {
      mockCollectionAddRelatedCollection.mockResolvedValue(undefined);

      const response = await fastify.inject({
        method: "POST",
        url: `/${TEST_UUIDS.COLLECTION_1}/related`,
        payload: validRelatedCollectionData,
      });

      expect(response.statusCode).toBe(201);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.message).toBe("Related collection added successfully");
      expect(mockCollectionAddRelatedCollection).toHaveBeenCalledWith(
        TEST_UUIDS.COLLECTION_1,
        TEST_UUIDS.COLLECTION_2
      );
    });

    it("should return 400 for missing collection_id", async () => {
      const response = await fastify.inject({
        method: "POST",
        url: `/${TEST_UUIDS.COLLECTION_1}/related`,
        payload: {},
      });

      expect(response.statusCode).toBe(400);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.error).toBe(COLLECTION_ERRORS.COLLECTION_ID_REQUIRED);
    });

    it("should return 500 for database error", async () => {
      mockCollectionAddRelatedCollection.mockRejectedValue(
        new Error("Add related collection error")
      );

      const response = await fastify.inject({
        method: "POST",
        url: `/${TEST_UUIDS.COLLECTION_1}/related`,
        payload: validRelatedCollectionData,
      });

      expect(response.statusCode).toBe(500);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.error).toBe("Add related collection error");
    });

    it("should return 500 for unexpected error", async () => {
      mockCollectionAddRelatedCollection.mockRejectedValue("String error");

      const response = await fastify.inject({
        method: "POST",
        url: `/${TEST_UUIDS.COLLECTION_1}/related`,
        payload: validRelatedCollectionData,
      });

      expect(response.statusCode).toBe(500);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.error).toBe(COLLECTION_ERRORS.ADD_RELATED_FAILED);
    });
  });

  describe("DELETE /:id/related/:relatedId", () => {
    it("should successfully remove related collection", async () => {
      mockCollectionRemoveRelatedCollection.mockResolvedValue(undefined);

      const response = await fastify.inject({
        method: "DELETE",
        url: `/${TEST_UUIDS.COLLECTION_1}/related/${TEST_UUIDS.COLLECTION_2}`,
      });

      expect(response.statusCode).toBe(200);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.message).toBe("Related collection removed successfully");
      expect(mockCollectionRemoveRelatedCollection).toHaveBeenCalledWith(
        TEST_UUIDS.COLLECTION_1,
        TEST_UUIDS.COLLECTION_2
      );
    });

    it("should return 500 for database error", async () => {
      mockCollectionRemoveRelatedCollection.mockRejectedValue(
        new Error("Remove related collection error")
      );

      const response = await fastify.inject({
        method: "DELETE",
        url: `/${TEST_UUIDS.COLLECTION_1}/related/${TEST_UUIDS.COLLECTION_2}`,
      });

      expect(response.statusCode).toBe(500);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.error).toBe("Remove related collection error");
    });

    it("should return 500 for unexpected error", async () => {
      mockCollectionRemoveRelatedCollection.mockRejectedValue("String error");

      const response = await fastify.inject({
        method: "DELETE",
        url: `/${TEST_UUIDS.COLLECTION_1}/related/${TEST_UUIDS.COLLECTION_2}`,
      });

      expect(response.statusCode).toBe(500);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.error).toBe(COLLECTION_ERRORS.REMOVE_RELATED_FAILED);
    });
  });

  describe("Edge Cases and Integration", () => {
    it("should handle malformed JSON in request body", async () => {
      const response = await fastify.inject({
        method: "POST",
        url: "/",
        payload: "invalid-json",
        headers: {
          "content-type": "application/json",
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it("should handle empty request body for POST endpoints", async () => {
      const response = await fastify.inject({
        method: "POST",
        url: "/",
        payload: {},
      });

      expect(response.statusCode).toBe(400);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.error).toBe(COLLECTION_ERRORS.OWNER_ID_REQUIRED);
    });

    it("should properly handle URL parameters", async () => {
      mockCollectionGetById.mockResolvedValue(mockCollection);

      const response = await fastify.inject({
        method: "GET",
        url: "/collection-123-with-dashes",
      });

      expect(response.statusCode).toBe(200);
      expect(mockCollectionGetById).toHaveBeenCalledWith("collection-123-with-dashes");
    });

    it("should handle special characters in collection ID", async () => {
      mockCollectionGetById.mockResolvedValue(mockCollection);

      const collectionId = "550e8400-e29b-41d4-a716-446655440000";
      const response = await fastify.inject({
        method: "GET",
        url: `/${collectionId}`,
      });

      expect(response.statusCode).toBe(200);
      expect(mockCollectionGetById).toHaveBeenCalledWith(collectionId);
    });

    it("should handle collection creation with only required fields", async () => {
      mockCollectionCreate.mockResolvedValue(mockCollectionPublic);

      const response = await fastify.inject({
        method: "POST",
        url: "/",
        payload: {
          name: "Minimal Collection",
          owner_id: "user-123",
        },
      });

      expect(response.statusCode).toBe(201);
      expect(mockCollectionCreate).toHaveBeenCalledWith(
        { name: "Minimal Collection" },
        "user-123"
      );
    });
  });
});

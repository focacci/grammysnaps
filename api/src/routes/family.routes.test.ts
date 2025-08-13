import Fastify, { FastifyInstance } from "fastify";
import familyRoutes from "./family.routes";
import {
  Family,
  FamilyUpdate,
  FamilyPublic,
  FamilyMember,
  RelatedFamily,
} from "../types/family.types";
import { FAMILY_ERRORS } from "../types/errors";
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

const mockFamilyCreate = jest.fn();
const mockFamilyGet = jest.fn();
const mockFamilyGetById = jest.fn();
const mockFamilyExists = jest.fn();
const mockFamilyGetUserFamilies = jest.fn();
const mockFamilyGetMembers = jest.fn();
const mockFamilyGetRelatedFamilies = jest.fn();
const mockFamilyAddRelatedFamily = jest.fn();
const mockFamilyRemoveRelatedFamily = jest.fn();
const mockFamilyUpdate = jest.fn();
const mockFamilyDelete = jest.fn();
const mockFamilyAddMember = jest.fn();
const mockFamilyRemoveMember = jest.fn();

describe("Family Routes", () => {
  let fastify: FastifyInstance;

  const mockFamily: Family = {
    id: TEST_UUIDS.FAMILY_1,
    name: "The Smiths",
    members: [TEST_UUIDS.USER_1, TEST_UUIDS.USER_2],
    owner_id: TEST_UUIDS.USER_1,
    related_families: [TEST_UUIDS.FAMILY_2],
    created_at: "2023-01-01T00:00:00Z",
    updated_at: "2023-01-01T00:00:00Z",
  };

  const mockFamilyPublic: FamilyPublic = {
    id: TEST_UUIDS.FAMILY_1,
    name: "The Smiths",
    member_count: 2,
    owner_id: TEST_UUIDS.USER_1,
    user_role: "owner",
    related_families: [TEST_UUIDS.FAMILY_2],
    created_at: "2023-01-01T00:00:00Z",
    updated_at: "2023-01-01T00:00:00Z",
  };

  const mockFamilyMember: FamilyMember = {
    id: TEST_UUIDS.USER_1,
    email: "john@example.com",
    first_name: "John",
    middle_name: null,
    last_name: "Smith",
    birthday: "1990-01-01",
    families: [TEST_UUIDS.FAMILY_1],
    profile_picture_key: null,
    profile_picture_thumbnail_key: null,
    created_at: "2023-01-01T00:00:00Z",
    updated_at: "2023-01-01T00:00:00Z",
    role: "owner",
    joined_at: "2023-01-01T00:00:00Z",
  };

  const mockRelatedFamily: RelatedFamily = {
    id: TEST_UUIDS.FAMILY_2,
    name: "The Johnsons",
    member_count: 3,
    created_at: "2023-01-01T00:00:00Z",
  };

  beforeEach(async () => {
    // Create a new Fastify instance for each test
    fastify = Fastify({ logger: false });

    // Decorate the fastify instance with mock plugin
    fastify.decorate("family", {
      create: mockFamilyCreate,
      get: mockFamilyGet,
      getById: mockFamilyGetById,
      exists: mockFamilyExists,
      getUserFamilies: mockFamilyGetUserFamilies,
      getMembers: mockFamilyGetMembers,
      getRelatedFamilies: mockFamilyGetRelatedFamilies,
      addRelatedFamily: mockFamilyAddRelatedFamily,
      removeRelatedFamily: mockFamilyRemoveRelatedFamily,
      update: mockFamilyUpdate,
      delete: mockFamilyDelete,
      addMember: mockFamilyAddMember,
      removeMember: mockFamilyRemoveMember,
    });

    // Register family routes
    await fastify.register(familyRoutes);

    // Wait for all plugins to be ready
    await fastify.ready();

    // Clear all mocks
    jest.clearAllMocks();
  });

  afterEach(async () => {
    await fastify.close();
  });

  describe("GET /", () => {
    it("should successfully get all families", async () => {
      const mockFamilies = [mockFamilyPublic];
      mockFamilyGet.mockResolvedValue(mockFamilies);

      const response = await fastify.inject({
        method: "GET",
        url: "/",
      });

      expect(response.statusCode).toBe(200);
      const responseBody = JSON.parse(response.body);
      expect(responseBody).toEqual(mockFamilies);
      expect(mockFamilyGet).toHaveBeenCalledWith();
    });

    it("should return 500 for database error", async () => {
      mockFamilyGet.mockRejectedValue(new Error("Database error"));

      const response = await fastify.inject({
        method: "GET",
        url: "/",
      });

      expect(response.statusCode).toBe(500);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.error).toBe(FAMILY_ERRORS.RETRIEVE_FAILED);
    });
  });

  describe("GET /user/:userId", () => {
    it("should successfully get families for a user", async () => {
      const mockFamilies = [mockFamilyPublic];
      mockFamilyGetUserFamilies.mockResolvedValue(mockFamilies);

      const response = await fastify.inject({
        method: "GET",
        url: `/user/${TEST_UUIDS.USER_1}`,
      });

      expect(response.statusCode).toBe(200);
      const responseBody = JSON.parse(response.body);
      expect(responseBody).toEqual(mockFamilies);
      expect(mockFamilyGetUserFamilies).toHaveBeenCalledWith(TEST_UUIDS.USER_1);
    });

    it("should return 500 for database error", async () => {
      mockFamilyGetUserFamilies.mockRejectedValue(new Error("Database error"));

      const response = await fastify.inject({
        method: "GET",
        url: `/user/${TEST_UUIDS.USER_1}`,
      });

      expect(response.statusCode).toBe(500);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.error).toBe(
        FAMILY_ERRORS.RETRIEVE_USER_FAMILIES_FAILED
      );
    });
  });

  describe("GET /:id", () => {
    it("should successfully get family by ID", async () => {
      mockFamilyGetById.mockResolvedValue(mockFamily);

      const response = await fastify.inject({
        method: "GET",
        url: `/${TEST_UUIDS.FAMILY_1}`,
      });

      expect(response.statusCode).toBe(200);
      const responseBody = JSON.parse(response.body);
      expect(responseBody).toEqual(mockFamily);
      expect(mockFamilyGetById).toHaveBeenCalledWith(TEST_UUIDS.FAMILY_1);
    });

    it("should return 404 for non-existent family", async () => {
      mockFamilyGetById.mockResolvedValue(null);

      const response = await fastify.inject({
        method: "GET",
        url: `/${TEST_UUIDS.FAMILY_1}`,
      });

      expect(response.statusCode).toBe(404);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.error).toBe(FAMILY_ERRORS.NOT_FOUND);
    });

    it("should return 500 for database error", async () => {
      mockFamilyGetById.mockRejectedValue(new Error("Database error"));

      const response = await fastify.inject({
        method: "GET",
        url: `/${TEST_UUIDS.FAMILY_1}`,
      });

      expect(response.statusCode).toBe(500);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.error).toBe(FAMILY_ERRORS.GET_BY_ID_FAILED);
    });
  });

  describe("GET /:id/members", () => {
    it("should successfully get family members", async () => {
      const mockMembers = [mockFamilyMember];
      mockFamilyGetMembers.mockResolvedValue(mockMembers);

      const response = await fastify.inject({
        method: "GET",
        url: `/${TEST_UUIDS.FAMILY_1}/members`,
      });

      expect(response.statusCode).toBe(200);
      const responseBody = JSON.parse(response.body);
      expect(responseBody).toEqual(mockMembers);
      expect(mockFamilyGetMembers).toHaveBeenCalledWith(TEST_UUIDS.FAMILY_1);
    });

    it("should return 500 for database error", async () => {
      mockFamilyGetMembers.mockRejectedValue(new Error("Database error"));

      const response = await fastify.inject({
        method: "GET",
        url: `/${TEST_UUIDS.FAMILY_1}/members`,
      });

      expect(response.statusCode).toBe(500);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.error).toBe(FAMILY_ERRORS.GET_MEMBERS_FAILED);
    });
  });

  describe("POST /", () => {
    const validFamilyData = {
      name: "The Johnsons",
      description: "A lovely family",
      owner_id: TEST_UUIDS.USER_1,
    };

    it("should successfully create a new family", async () => {
      mockFamilyCreate.mockResolvedValue(mockFamilyPublic);

      const response = await fastify.inject({
        method: "POST",
        url: "/",
        payload: validFamilyData,
      });

      expect(response.statusCode).toBe(201);
      const responseBody = JSON.parse(response.body);
      expect(responseBody).toEqual(mockFamilyPublic);
      expect(mockFamilyCreate).toHaveBeenCalledWith(
        { name: "The Johnsons", description: "A lovely family" },
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
      expect(responseBody.error).toBe(FAMILY_ERRORS.OWNER_ID_REQUIRED);
    });

    it("should return 400 for missing family name", async () => {
      const response = await fastify.inject({
        method: "POST",
        url: "/",
        payload: {
          owner_id: TEST_UUIDS.USER_1,
        },
      });

      expect(response.statusCode).toBe(400);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.error).toBe(FAMILY_ERRORS.NAME_REQUIRED);
    });

    it("should return 400 for empty family name", async () => {
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
      expect(responseBody.error).toBe(FAMILY_ERRORS.NAME_REQUIRED);
    });

    it("should return 500 for database error", async () => {
      mockFamilyCreate.mockRejectedValue(
        new Error(FAMILY_ERRORS.CREATE_FAILED)
      );

      const response = await fastify.inject({
        method: "POST",
        url: "/",
        payload: validFamilyData,
      });

      expect(response.statusCode).toBe(500);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.error).toBe(FAMILY_ERRORS.CREATE_FAILED);
    });

    it("should return 500 for unexpected error", async () => {
      mockFamilyCreate.mockRejectedValue("String error");

      const response = await fastify.inject({
        method: "POST",
        url: "/",
        payload: validFamilyData,
      });

      expect(response.statusCode).toBe(500);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.error).toBe(FAMILY_ERRORS.CREATE_FAILED);
    });
  });

  describe("PUT /:id", () => {
    const validUpdateData: FamilyUpdate = {
      name: "Updated Family Name",
      description: "Updated description",
    };

    it("should successfully update family", async () => {
      const updatedFamily = { ...mockFamily, ...validUpdateData };
      mockFamilyUpdate.mockResolvedValue(updatedFamily);

      const response = await fastify.inject({
        method: "PUT",
        url: `/${TEST_UUIDS.FAMILY_1}`,
        payload: validUpdateData,
      });

      expect(response.statusCode).toBe(200);
      const responseBody = JSON.parse(response.body);
      expect(responseBody).toEqual(updatedFamily);
      expect(mockFamilyUpdate).toHaveBeenCalledWith(
        TEST_UUIDS.FAMILY_1,
        validUpdateData
      );
    });

    it("should return 404 for non-existent family", async () => {
      mockFamilyUpdate.mockResolvedValue(null);

      const response = await fastify.inject({
        method: "PUT",
        url: `/${TEST_UUIDS.FAMILY_1}`,
        payload: validUpdateData,
      });

      expect(response.statusCode).toBe(404);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.error).toBe(FAMILY_ERRORS.UPDATE_NOT_FOUND);
    });

    it("should return 500 for database error", async () => {
      mockFamilyUpdate.mockRejectedValue(new Error("Update error"));

      const response = await fastify.inject({
        method: "PUT",
        url: `/${TEST_UUIDS.FAMILY_1}`,
        payload: validUpdateData,
      });

      expect(response.statusCode).toBe(500);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.error).toBe("Update error");
    });

    it("should return 500 for unexpected error", async () => {
      mockFamilyUpdate.mockRejectedValue("String error");

      const response = await fastify.inject({
        method: "PUT",
        url: `/${TEST_UUIDS.FAMILY_1}`,
        payload: validUpdateData,
      });

      expect(response.statusCode).toBe(500);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.error).toBe(FAMILY_ERRORS.UPDATE_FAILED);
    });

    it("should handle empty update data", async () => {
      const updatedFamily = mockFamily;
      mockFamilyUpdate.mockResolvedValue(updatedFamily);

      const response = await fastify.inject({
        method: "PUT",
        url: `/${TEST_UUIDS.FAMILY_1}`,
        payload: {},
      });

      expect(response.statusCode).toBe(200);
      expect(mockFamilyUpdate).toHaveBeenCalledWith(TEST_UUIDS.FAMILY_1, {});
    });
  });

  describe("DELETE /:id", () => {
    it("should successfully delete family", async () => {
      mockFamilyDelete.mockResolvedValue(undefined);

      const response = await fastify.inject({
        method: "DELETE",
        url: `/${TEST_UUIDS.FAMILY_1}`,
      });

      expect(response.statusCode).toBe(204);
      expect(response.body).toBe("");
      expect(mockFamilyDelete).toHaveBeenCalledWith(TEST_UUIDS.FAMILY_1);
    });

    it("should return 500 for database error", async () => {
      mockFamilyDelete.mockRejectedValue(
        new Error(FAMILY_ERRORS.DELETE_FAILED)
      );

      const response = await fastify.inject({
        method: "DELETE",
        url: `/${TEST_UUIDS.FAMILY_1}`,
      });

      expect(response.statusCode).toBe(500);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.error).toBe(FAMILY_ERRORS.DELETE_FAILED);
    });

    it("should return 500 for unexpected error", async () => {
      mockFamilyDelete.mockRejectedValue("String error");

      const response = await fastify.inject({
        method: "DELETE",
        url: `/${TEST_UUIDS.FAMILY_1}`,
      });

      expect(response.statusCode).toBe(500);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.error).toBe(FAMILY_ERRORS.DELETE_FAILED);
    });
  });

  describe("POST /:id/members", () => {
    const validMemberData = {
      user_id: TEST_UUIDS.USER_2,
    };

    it("should successfully add member to family", async () => {
      mockFamilyAddMember.mockResolvedValue(undefined);

      const response = await fastify.inject({
        method: "POST",
        url: `/${TEST_UUIDS.FAMILY_1}/members`,
        payload: validMemberData,
      });

      expect(response.statusCode).toBe(200);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.message).toBe("Member added successfully");
      expect(mockFamilyAddMember).toHaveBeenCalledWith(
        TEST_UUIDS.FAMILY_1,
        TEST_UUIDS.USER_2
      );
    });

    it("should return 400 for missing user_id", async () => {
      const response = await fastify.inject({
        method: "POST",
        url: `/${TEST_UUIDS.FAMILY_1}/members`,
        payload: {},
      });

      expect(response.statusCode).toBe(400);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.error).toBe(FAMILY_ERRORS.USER_ID_REQUIRED);
    });

    it("should return 500 for database error", async () => {
      mockFamilyAddMember.mockRejectedValue(new Error("Add member error"));

      const response = await fastify.inject({
        method: "POST",
        url: `/${TEST_UUIDS.FAMILY_1}/members`,
        payload: validMemberData,
      });

      expect(response.statusCode).toBe(500);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.error).toBe("Add member error");
    });

    it("should return 500 for unexpected error", async () => {
      mockFamilyAddMember.mockRejectedValue("String error");

      const response = await fastify.inject({
        method: "POST",
        url: `/${TEST_UUIDS.FAMILY_1}/members`,
        payload: validMemberData,
      });

      expect(response.statusCode).toBe(500);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.error).toBe(FAMILY_ERRORS.ADD_MEMBER_FAILED);
    });
  });

  describe("DELETE /:id/members/:userId", () => {
    it("should successfully remove member from family", async () => {
      mockFamilyRemoveMember.mockResolvedValue(undefined);

      const response = await fastify.inject({
        method: "DELETE",
        url: `/${TEST_UUIDS.FAMILY_1}/members/${TEST_UUIDS.USER_2}`,
      });

      expect(response.statusCode).toBe(200);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.message).toBe("Member removed successfully");
      expect(mockFamilyRemoveMember).toHaveBeenCalledWith(
        TEST_UUIDS.FAMILY_1,
        TEST_UUIDS.USER_2
      );
    });

    it("should return 500 for database error", async () => {
      mockFamilyRemoveMember.mockRejectedValue(
        new Error("Remove member error")
      );

      const response = await fastify.inject({
        method: "DELETE",
        url: `/${TEST_UUIDS.FAMILY_1}/members/${TEST_UUIDS.USER_2}`,
      });

      expect(response.statusCode).toBe(500);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.error).toBe("Remove member error");
    });

    it("should return 500 for unexpected error", async () => {
      mockFamilyRemoveMember.mockRejectedValue("String error");

      const response = await fastify.inject({
        method: "DELETE",
        url: `/${TEST_UUIDS.FAMILY_1}/members/${TEST_UUIDS.USER_2}`,
      });

      expect(response.statusCode).toBe(500);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.error).toBe(FAMILY_ERRORS.REMOVE_MEMBER_FAILED);
    });
  });

  describe("GET /:id/related", () => {
    it("should successfully get related families", async () => {
      const mockRelatedFamilies = [mockRelatedFamily];
      mockFamilyGetRelatedFamilies.mockResolvedValue(mockRelatedFamilies);

      const response = await fastify.inject({
        method: "GET",
        url: `/${TEST_UUIDS.FAMILY_1}/related`,
      });

      expect(response.statusCode).toBe(200);
      const responseBody = JSON.parse(response.body);
      expect(responseBody).toEqual(mockRelatedFamilies);
      expect(mockFamilyGetRelatedFamilies).toHaveBeenCalledWith(TEST_UUIDS.FAMILY_1);
    });

    it("should return 500 for database error", async () => {
      mockFamilyGetRelatedFamilies.mockRejectedValue(
        new Error("Database error")
      );

      const response = await fastify.inject({
        method: "GET",
        url: `/${TEST_UUIDS.FAMILY_1}/related`,
      });

      expect(response.statusCode).toBe(500);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.error).toBe(FAMILY_ERRORS.GET_RELATED_FAILED);
    });
  });

  describe("POST /:id/related", () => {
    const validRelatedFamilyData = {
      family_id: TEST_UUIDS.FAMILY_2,
    };

    it("should successfully add related family", async () => {
      mockFamilyAddRelatedFamily.mockResolvedValue(undefined);

      const response = await fastify.inject({
        method: "POST",
        url: `/${TEST_UUIDS.FAMILY_1}/related`,
        payload: validRelatedFamilyData,
      });

      expect(response.statusCode).toBe(201);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.message).toBe("Related family added successfully");
      expect(mockFamilyAddRelatedFamily).toHaveBeenCalledWith(
        TEST_UUIDS.FAMILY_1,
        TEST_UUIDS.FAMILY_2
      );
    });

    it("should return 400 for missing family_id", async () => {
      const response = await fastify.inject({
        method: "POST",
        url: `/${TEST_UUIDS.FAMILY_1}/related`,
        payload: {},
      });

      expect(response.statusCode).toBe(400);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.error).toBe(FAMILY_ERRORS.FAMILY_ID_REQUIRED);
    });

    it("should return 500 for database error", async () => {
      mockFamilyAddRelatedFamily.mockRejectedValue(
        new Error("Add related family error")
      );

      const response = await fastify.inject({
        method: "POST",
        url: `/${TEST_UUIDS.FAMILY_1}/related`,
        payload: validRelatedFamilyData,
      });

      expect(response.statusCode).toBe(500);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.error).toBe("Add related family error");
    });

    it("should return 500 for unexpected error", async () => {
      mockFamilyAddRelatedFamily.mockRejectedValue("String error");

      const response = await fastify.inject({
        method: "POST",
        url: `/${TEST_UUIDS.FAMILY_1}/related`,
        payload: validRelatedFamilyData,
      });

      expect(response.statusCode).toBe(500);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.error).toBe(FAMILY_ERRORS.ADD_RELATED_FAILED);
    });
  });

  describe("DELETE /:id/related/:relatedId", () => {
    it("should successfully remove related family", async () => {
      mockFamilyRemoveRelatedFamily.mockResolvedValue(undefined);

      const response = await fastify.inject({
        method: "DELETE",
        url: `/${TEST_UUIDS.FAMILY_1}/related/${TEST_UUIDS.FAMILY_2}`,
      });

      expect(response.statusCode).toBe(200);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.message).toBe("Related family removed successfully");
      expect(mockFamilyRemoveRelatedFamily).toHaveBeenCalledWith(
        TEST_UUIDS.FAMILY_1,
        TEST_UUIDS.FAMILY_2
      );
    });

    it("should return 500 for database error", async () => {
      mockFamilyRemoveRelatedFamily.mockRejectedValue(
        new Error("Remove related family error")
      );

      const response = await fastify.inject({
        method: "DELETE",
        url: `/${TEST_UUIDS.FAMILY_1}/related/${TEST_UUIDS.FAMILY_2}`,
      });

      expect(response.statusCode).toBe(500);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.error).toBe("Remove related family error");
    });

    it("should return 500 for unexpected error", async () => {
      mockFamilyRemoveRelatedFamily.mockRejectedValue("String error");

      const response = await fastify.inject({
        method: "DELETE",
        url: `/${TEST_UUIDS.FAMILY_1}/related/${TEST_UUIDS.FAMILY_2}`,
      });

      expect(response.statusCode).toBe(500);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.error).toBe(FAMILY_ERRORS.REMOVE_RELATED_FAILED);
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
      expect(responseBody.error).toBe(FAMILY_ERRORS.OWNER_ID_REQUIRED);
    });

    it("should properly handle URL parameters", async () => {
      mockFamilyGetById.mockResolvedValue(mockFamily);

      const response = await fastify.inject({
        method: "GET",
        url: "/family-123-with-dashes",
      });

      expect(response.statusCode).toBe(200);
      expect(mockFamilyGetById).toHaveBeenCalledWith("family-123-with-dashes");
    });

    it("should handle special characters in family ID", async () => {
      mockFamilyGetById.mockResolvedValue(mockFamily);

      const familyId = "550e8400-e29b-41d4-a716-446655440000";
      const response = await fastify.inject({
        method: "GET",
        url: `/${familyId}`,
      });

      expect(response.statusCode).toBe(200);
      expect(mockFamilyGetById).toHaveBeenCalledWith(familyId);
    });

    it("should handle family creation with only required fields", async () => {
      mockFamilyCreate.mockResolvedValue(mockFamilyPublic);

      const response = await fastify.inject({
        method: "POST",
        url: "/",
        payload: {
          name: "Minimal Family",
          owner_id: "user-123",
        },
      });

      expect(response.statusCode).toBe(201);
      expect(mockFamilyCreate).toHaveBeenCalledWith(
        { name: "Minimal Family" },
        "user-123"
      );
    });
  });
});

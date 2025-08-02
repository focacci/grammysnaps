import Fastify, { FastifyInstance } from "fastify";
import familyRoutes from "./family.routes";
import {
  Family,
  FamilyUpdate,
  FamilyPublic,
  FamilyMember,
  RelatedFamily,
} from "../types/family.types";

describe("Family Routes", () => {
  let fastify: FastifyInstance;
  let mockFamilyPlugin: {
    create: jest.MockedFunction<any>;
    get: jest.MockedFunction<any>;
    getById: jest.MockedFunction<any>;
    exists: jest.MockedFunction<any>;
    getUserFamilies: jest.MockedFunction<any>;
    getMembers: jest.MockedFunction<any>;
    getRelatedFamilies: jest.MockedFunction<any>;
    addRelatedFamily: jest.MockedFunction<any>;
    removeRelatedFamily: jest.MockedFunction<any>;
    update: jest.MockedFunction<any>;
    delete: jest.MockedFunction<any>;
    addMember: jest.MockedFunction<any>;
    removeMember: jest.MockedFunction<any>;
  };

  const mockFamily: Family = {
    id: "family-123",
    name: "The Smiths",
    members: ["user-1", "user-2"],
    owner_id: "user-1",
    related_families: ["family-456"],
    created_at: "2023-01-01T00:00:00Z",
    updated_at: "2023-01-01T00:00:00Z",
  };

  const mockFamilyPublic: FamilyPublic = {
    id: "family-123",
    name: "The Smiths",
    member_count: 2,
    owner_id: "user-1",
    user_role: "owner",
    related_families: ["family-456"],
    created_at: "2023-01-01T00:00:00Z",
    updated_at: "2023-01-01T00:00:00Z",
  };

  const mockFamilyMember: FamilyMember = {
    id: "user-1",
    first_name: "John",
    last_name: "Smith",
    email: "john@example.com",
    birthday: "1990-01-01",
    role: "owner",
    joined_at: "2023-01-01T00:00:00Z",
  };

  const mockRelatedFamily: RelatedFamily = {
    id: "family-456",
    name: "The Johnsons",
    member_count: 3,
    created_at: "2023-01-01T00:00:00Z",
  };

  beforeEach(async () => {
    // Create a new Fastify instance for each test
    fastify = Fastify({ logger: false });

    // Create mock family plugin
    mockFamilyPlugin = {
      create: jest.fn(),
      get: jest.fn(),
      getById: jest.fn(),
      exists: jest.fn(),
      getUserFamilies: jest.fn(),
      getMembers: jest.fn(),
      getRelatedFamilies: jest.fn(),
      addRelatedFamily: jest.fn(),
      removeRelatedFamily: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      addMember: jest.fn(),
      removeMember: jest.fn(),
    };

    // Decorate the fastify instance with mock plugin
    fastify.decorate("family", mockFamilyPlugin);

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
      mockFamilyPlugin.get.mockResolvedValue(mockFamilies);

      const response = await fastify.inject({
        method: "GET",
        url: "/",
      });

      expect(response.statusCode).toBe(200);
      const responseBody = JSON.parse(response.body);
      expect(responseBody).toEqual(mockFamilies);
      expect(mockFamilyPlugin.get).toHaveBeenCalledWith();
    });

    it("should return 500 for database error", async () => {
      mockFamilyPlugin.get.mockRejectedValue(new Error("Database error"));

      const response = await fastify.inject({
        method: "GET",
        url: "/",
      });

      expect(response.statusCode).toBe(500);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.error).toBe("Failed to fetch families");
    });
  });

  describe("GET /user/:userId", () => {
    it("should successfully get families for a user", async () => {
      const mockFamilies = [mockFamilyPublic];
      mockFamilyPlugin.getUserFamilies.mockResolvedValue(mockFamilies);

      const response = await fastify.inject({
        method: "GET",
        url: "/user/user-123",
      });

      expect(response.statusCode).toBe(200);
      const responseBody = JSON.parse(response.body);
      expect(responseBody).toEqual(mockFamilies);
      expect(mockFamilyPlugin.getUserFamilies).toHaveBeenCalledWith("user-123");
    });

    it("should return 500 for database error", async () => {
      mockFamilyPlugin.getUserFamilies.mockRejectedValue(
        new Error("Database error")
      );

      const response = await fastify.inject({
        method: "GET",
        url: "/user/user-123",
      });

      expect(response.statusCode).toBe(500);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.error).toBe("Failed to fetch user families");
    });
  });

  describe("GET /:id", () => {
    it("should successfully get family by ID", async () => {
      mockFamilyPlugin.getById.mockResolvedValue(mockFamily);

      const response = await fastify.inject({
        method: "GET",
        url: "/family-123",
      });

      expect(response.statusCode).toBe(200);
      const responseBody = JSON.parse(response.body);
      expect(responseBody).toEqual(mockFamily);
      expect(mockFamilyPlugin.getById).toHaveBeenCalledWith("family-123");
    });

    it("should return 404 for non-existent family", async () => {
      mockFamilyPlugin.getById.mockResolvedValue(null);

      const response = await fastify.inject({
        method: "GET",
        url: "/family-123",
      });

      expect(response.statusCode).toBe(404);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.error).toBe("Family not found");
    });

    it("should return 500 for database error", async () => {
      mockFamilyPlugin.getById.mockRejectedValue(new Error("Database error"));

      const response = await fastify.inject({
        method: "GET",
        url: "/family-123",
      });

      expect(response.statusCode).toBe(500);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.error).toBe("Failed to fetch family");
    });
  });

  describe("GET /:id/members", () => {
    it("should successfully get family members", async () => {
      const mockMembers = [mockFamilyMember];
      mockFamilyPlugin.getMembers.mockResolvedValue(mockMembers);

      const response = await fastify.inject({
        method: "GET",
        url: "/family-123/members",
      });

      expect(response.statusCode).toBe(200);
      const responseBody = JSON.parse(response.body);
      expect(responseBody).toEqual(mockMembers);
      expect(mockFamilyPlugin.getMembers).toHaveBeenCalledWith("family-123");
    });

    it("should return 500 for database error", async () => {
      mockFamilyPlugin.getMembers.mockRejectedValue(
        new Error("Database error")
      );

      const response = await fastify.inject({
        method: "GET",
        url: "/family-123/members",
      });

      expect(response.statusCode).toBe(500);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.error).toBe("Failed to fetch family members");
    });
  });

  describe("POST /", () => {
    const validFamilyData = {
      name: "The Johnsons",
      description: "A lovely family",
      owner_id: "user-123",
    };

    it("should successfully create a new family", async () => {
      mockFamilyPlugin.create.mockResolvedValue(mockFamilyPublic);

      const response = await fastify.inject({
        method: "POST",
        url: "/",
        payload: validFamilyData,
      });

      expect(response.statusCode).toBe(201);
      const responseBody = JSON.parse(response.body);
      expect(responseBody).toEqual(mockFamilyPublic);
      expect(mockFamilyPlugin.create).toHaveBeenCalledWith(
        { name: "The Johnsons", description: "A lovely family" },
        "user-123"
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
      expect(responseBody.error).toBe("owner_id is required");
    });

    it("should return 400 for missing family name", async () => {
      const response = await fastify.inject({
        method: "POST",
        url: "/",
        payload: {
          owner_id: "user-123",
        },
      });

      expect(response.statusCode).toBe(400);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.error).toBe("Family name is required");
    });

    it("should return 400 for empty family name", async () => {
      const response = await fastify.inject({
        method: "POST",
        url: "/",
        payload: {
          name: "   ",
          owner_id: "user-123",
        },
      });

      expect(response.statusCode).toBe(400);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.error).toBe("Family name is required");
    });

    it("should return 500 for database error", async () => {
      mockFamilyPlugin.create.mockRejectedValue(new Error("Database error"));

      const response = await fastify.inject({
        method: "POST",
        url: "/",
        payload: validFamilyData,
      });

      expect(response.statusCode).toBe(500);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.error).toBe("Database error");
    });

    it("should return 500 for unexpected error", async () => {
      mockFamilyPlugin.create.mockRejectedValue("String error");

      const response = await fastify.inject({
        method: "POST",
        url: "/",
        payload: validFamilyData,
      });

      expect(response.statusCode).toBe(500);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.error).toBe("Failed to create family");
    });
  });

  describe("PUT /:id", () => {
    const validUpdateData: FamilyUpdate = {
      name: "Updated Family Name",
      description: "Updated description",
    };

    it("should successfully update family", async () => {
      const updatedFamily = { ...mockFamily, ...validUpdateData };
      mockFamilyPlugin.update.mockResolvedValue(updatedFamily);

      const response = await fastify.inject({
        method: "PUT",
        url: "/family-123",
        payload: validUpdateData,
      });

      expect(response.statusCode).toBe(200);
      const responseBody = JSON.parse(response.body);
      expect(responseBody).toEqual(updatedFamily);
      expect(mockFamilyPlugin.update).toHaveBeenCalledWith(
        "family-123",
        validUpdateData
      );
    });

    it("should return 404 for non-existent family", async () => {
      mockFamilyPlugin.update.mockResolvedValue(null);

      const response = await fastify.inject({
        method: "PUT",
        url: "/family-123",
        payload: validUpdateData,
      });

      expect(response.statusCode).toBe(404);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.error).toBe("Family not found");
    });

    it("should return 500 for database error", async () => {
      mockFamilyPlugin.update.mockRejectedValue(new Error("Update error"));

      const response = await fastify.inject({
        method: "PUT",
        url: "/family-123",
        payload: validUpdateData,
      });

      expect(response.statusCode).toBe(500);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.error).toBe("Update error");
    });

    it("should return 500 for unexpected error", async () => {
      mockFamilyPlugin.update.mockRejectedValue("String error");

      const response = await fastify.inject({
        method: "PUT",
        url: "/family-123",
        payload: validUpdateData,
      });

      expect(response.statusCode).toBe(500);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.error).toBe("Failed to update family");
    });

    it("should handle empty update data", async () => {
      const updatedFamily = mockFamily;
      mockFamilyPlugin.update.mockResolvedValue(updatedFamily);

      const response = await fastify.inject({
        method: "PUT",
        url: "/family-123",
        payload: {},
      });

      expect(response.statusCode).toBe(200);
      expect(mockFamilyPlugin.update).toHaveBeenCalledWith("family-123", {});
    });
  });

  describe("DELETE /:id", () => {
    it("should successfully delete family", async () => {
      mockFamilyPlugin.delete.mockResolvedValue(undefined);

      const response = await fastify.inject({
        method: "DELETE",
        url: "/family-123",
      });

      expect(response.statusCode).toBe(204);
      expect(response.body).toBe("");
      expect(mockFamilyPlugin.delete).toHaveBeenCalledWith("family-123");
    });

    it("should return 500 for database error", async () => {
      mockFamilyPlugin.delete.mockRejectedValue(new Error("Delete error"));

      const response = await fastify.inject({
        method: "DELETE",
        url: "/family-123",
      });

      expect(response.statusCode).toBe(500);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.error).toBe("Delete error");
    });

    it("should return 500 for unexpected error", async () => {
      mockFamilyPlugin.delete.mockRejectedValue("String error");

      const response = await fastify.inject({
        method: "DELETE",
        url: "/family-123",
      });

      expect(response.statusCode).toBe(500);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.error).toBe("Failed to delete family");
    });
  });

  describe("POST /:id/members", () => {
    const validMemberData = {
      user_id: "user-456",
    };

    it("should successfully add member to family", async () => {
      mockFamilyPlugin.addMember.mockResolvedValue(undefined);

      const response = await fastify.inject({
        method: "POST",
        url: "/family-123/members",
        payload: validMemberData,
      });

      expect(response.statusCode).toBe(200);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.message).toBe("Member added successfully");
      expect(mockFamilyPlugin.addMember).toHaveBeenCalledWith(
        "family-123",
        "user-456"
      );
    });

    it("should return 400 for missing user_id", async () => {
      const response = await fastify.inject({
        method: "POST",
        url: "/family-123/members",
        payload: {},
      });

      expect(response.statusCode).toBe(400);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.error).toBe("user_id is required");
    });

    it("should return 500 for database error", async () => {
      mockFamilyPlugin.addMember.mockRejectedValue(
        new Error("Add member error")
      );

      const response = await fastify.inject({
        method: "POST",
        url: "/family-123/members",
        payload: validMemberData,
      });

      expect(response.statusCode).toBe(500);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.error).toBe("Add member error");
    });

    it("should return 500 for unexpected error", async () => {
      mockFamilyPlugin.addMember.mockRejectedValue("String error");

      const response = await fastify.inject({
        method: "POST",
        url: "/family-123/members",
        payload: validMemberData,
      });

      expect(response.statusCode).toBe(500);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.error).toBe("Failed to add member");
    });
  });

  describe("DELETE /:id/members/:userId", () => {
    it("should successfully remove member from family", async () => {
      mockFamilyPlugin.removeMember.mockResolvedValue(undefined);

      const response = await fastify.inject({
        method: "DELETE",
        url: "/family-123/members/user-456",
      });

      expect(response.statusCode).toBe(200);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.message).toBe("Member removed successfully");
      expect(mockFamilyPlugin.removeMember).toHaveBeenCalledWith(
        "family-123",
        "user-456"
      );
    });

    it("should return 500 for database error", async () => {
      mockFamilyPlugin.removeMember.mockRejectedValue(
        new Error("Remove member error")
      );

      const response = await fastify.inject({
        method: "DELETE",
        url: "/family-123/members/user-456",
      });

      expect(response.statusCode).toBe(500);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.error).toBe("Remove member error");
    });

    it("should return 500 for unexpected error", async () => {
      mockFamilyPlugin.removeMember.mockRejectedValue("String error");

      const response = await fastify.inject({
        method: "DELETE",
        url: "/family-123/members/user-456",
      });

      expect(response.statusCode).toBe(500);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.error).toBe("Failed to remove member");
    });
  });

  describe("GET /:id/related", () => {
    it("should successfully get related families", async () => {
      const mockRelatedFamilies = [mockRelatedFamily];
      mockFamilyPlugin.getRelatedFamilies.mockResolvedValue(
        mockRelatedFamilies
      );

      const response = await fastify.inject({
        method: "GET",
        url: "/family-123/related",
      });

      expect(response.statusCode).toBe(200);
      const responseBody = JSON.parse(response.body);
      expect(responseBody).toEqual(mockRelatedFamilies);
      expect(mockFamilyPlugin.getRelatedFamilies).toHaveBeenCalledWith(
        "family-123"
      );
    });

    it("should return 500 for database error", async () => {
      mockFamilyPlugin.getRelatedFamilies.mockRejectedValue(
        new Error("Database error")
      );

      const response = await fastify.inject({
        method: "GET",
        url: "/family-123/related",
      });

      expect(response.statusCode).toBe(500);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.error).toBe("Failed to fetch related families");
    });
  });

  describe("POST /:id/related", () => {
    const validRelatedFamilyData = {
      family_id: "family-456",
    };

    it("should successfully add related family", async () => {
      mockFamilyPlugin.addRelatedFamily.mockResolvedValue(undefined);

      const response = await fastify.inject({
        method: "POST",
        url: "/family-123/related",
        payload: validRelatedFamilyData,
      });

      expect(response.statusCode).toBe(201);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.message).toBe("Related family added successfully");
      expect(mockFamilyPlugin.addRelatedFamily).toHaveBeenCalledWith(
        "family-123",
        "family-456"
      );
    });

    it("should return 400 for missing family_id", async () => {
      const response = await fastify.inject({
        method: "POST",
        url: "/family-123/related",
        payload: {},
      });

      expect(response.statusCode).toBe(400);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.error).toBe("family_id is required");
    });

    it("should return 500 for database error", async () => {
      mockFamilyPlugin.addRelatedFamily.mockRejectedValue(
        new Error("Add related family error")
      );

      const response = await fastify.inject({
        method: "POST",
        url: "/family-123/related",
        payload: validRelatedFamilyData,
      });

      expect(response.statusCode).toBe(500);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.error).toBe("Add related family error");
    });

    it("should return 500 for unexpected error", async () => {
      mockFamilyPlugin.addRelatedFamily.mockRejectedValue("String error");

      const response = await fastify.inject({
        method: "POST",
        url: "/family-123/related",
        payload: validRelatedFamilyData,
      });

      expect(response.statusCode).toBe(500);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.error).toBe("Failed to add related family");
    });
  });

  describe("DELETE /:id/related/:relatedId", () => {
    it("should successfully remove related family", async () => {
      mockFamilyPlugin.removeRelatedFamily.mockResolvedValue(undefined);

      const response = await fastify.inject({
        method: "DELETE",
        url: "/family-123/related/family-456",
      });

      expect(response.statusCode).toBe(200);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.message).toBe("Related family removed successfully");
      expect(mockFamilyPlugin.removeRelatedFamily).toHaveBeenCalledWith(
        "family-123",
        "family-456"
      );
    });

    it("should return 500 for database error", async () => {
      mockFamilyPlugin.removeRelatedFamily.mockRejectedValue(
        new Error("Remove related family error")
      );

      const response = await fastify.inject({
        method: "DELETE",
        url: "/family-123/related/family-456",
      });

      expect(response.statusCode).toBe(500);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.error).toBe("Remove related family error");
    });

    it("should return 500 for unexpected error", async () => {
      mockFamilyPlugin.removeRelatedFamily.mockRejectedValue("String error");

      const response = await fastify.inject({
        method: "DELETE",
        url: "/family-123/related/family-456",
      });

      expect(response.statusCode).toBe(500);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.error).toBe("Failed to remove related family");
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
      expect(responseBody.error).toBe("owner_id is required");
    });

    it("should properly handle URL parameters", async () => {
      mockFamilyPlugin.getById.mockResolvedValue(mockFamily);

      const response = await fastify.inject({
        method: "GET",
        url: "/family-123-with-dashes",
      });

      expect(response.statusCode).toBe(200);
      expect(mockFamilyPlugin.getById).toHaveBeenCalledWith(
        "family-123-with-dashes"
      );
    });

    it("should handle special characters in family ID", async () => {
      mockFamilyPlugin.getById.mockResolvedValue(mockFamily);

      const familyId = "550e8400-e29b-41d4-a716-446655440000";
      const response = await fastify.inject({
        method: "GET",
        url: `/${familyId}`,
      });

      expect(response.statusCode).toBe(200);
      expect(mockFamilyPlugin.getById).toHaveBeenCalledWith(familyId);
    });

    it("should handle family creation with only required fields", async () => {
      mockFamilyPlugin.create.mockResolvedValue(mockFamilyPublic);

      const response = await fastify.inject({
        method: "POST",
        url: "/",
        payload: {
          name: "Minimal Family",
          owner_id: "user-123",
        },
      });

      expect(response.statusCode).toBe(201);
      expect(mockFamilyPlugin.create).toHaveBeenCalledWith(
        { name: "Minimal Family" },
        "user-123"
      );
    });
  });
});

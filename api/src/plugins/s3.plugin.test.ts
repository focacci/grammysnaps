import { FastifyInstance } from "fastify";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import s3Plugin, { S3Config, UploadOptions, ImageInfo } from "./s3.plugin";

// Mock AWS SDK
jest.mock("@aws-sdk/client-s3");
jest.mock("@aws-sdk/s3-request-presigner");
jest.mock("fastify-plugin", () => (plugin: any) => plugin);

const MockedS3Client = S3Client as jest.MockedClass<typeof S3Client>;

describe("S3 Plugin", () => {
  let mockFastify: jest.Mocked<FastifyInstance>;
  let mockS3Send: jest.MockedFunction<any>;
  let s3Decorator: any;

  const mockConfig: S3Config = {
    region: "us-east-1",
    bucket: "test-bucket",
    accessKeyId: "test-access-key",
    secretAccessKey: "test-secret-key",
  };

  const mockConfigWithEndpoint: S3Config = {
    ...mockConfig,
    endpoint: "http://localhost:9000",
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mock S3Client send method
    mockS3Send = jest.fn();

    // Mock the S3Client constructor to return our mock instance
    MockedS3Client.mockImplementation(
      () =>
        ({
          send: mockS3Send,
        } as any)
    );

    // Create mock Fastify instance
    mockFastify = {
      decorate: jest.fn(),
      addHook: jest.fn(),
      log: {
        debug: jest.fn(),
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
      },
    } as any;
  });

  describe("Plugin Registration", () => {
    it("should register the s3 decorator with correct methods", async () => {
      await s3Plugin(mockFastify, mockConfig);

      expect(mockFastify.decorate).toHaveBeenCalledWith("s3", {
        createKey: expect.any(Function),
        upload: expect.any(Function),
        download: expect.any(Function),
        delete: expect.any(Function),
        getInfo: expect.any(Function),
        getPublicUrl: expect.any(Function),
        getSignedUrl: expect.any(Function),
        listImages: expect.any(Function),
        exists: expect.any(Function),
      });
    });

    it("should initialize S3Client with correct configuration", async () => {
      await s3Plugin(mockFastify, mockConfig);

      expect(S3Client).toHaveBeenCalledWith({
        region: mockConfig.region,
        credentials: {
          accessKeyId: mockConfig.accessKeyId,
          secretAccessKey: mockConfig.secretAccessKey,
        },
        endpoint: undefined,
        forcePathStyle: false,
      });
    });

    it("should initialize S3Client with endpoint configuration", async () => {
      await s3Plugin(mockFastify, mockConfigWithEndpoint);

      expect(S3Client).toHaveBeenCalledWith({
        region: mockConfigWithEndpoint.region,
        credentials: {
          accessKeyId: mockConfigWithEndpoint.accessKeyId,
          secretAccessKey: mockConfigWithEndpoint.secretAccessKey,
        },
        endpoint: mockConfigWithEndpoint.endpoint,
        forcePathStyle: true,
      });
    });

    it("should initialize S3Client without credentials when not provided", async () => {
      const configWithoutCredentials = {
        region: "us-east-1",
        bucket: "test-bucket",
      };

      await s3Plugin(mockFastify, configWithoutCredentials);

      expect(S3Client).toHaveBeenCalledWith({
        region: configWithoutCredentials.region,
        credentials: undefined,
        endpoint: undefined,
        forcePathStyle: false,
      });
    });

    it("should throw error when region is missing", async () => {
      const invalidConfig = { bucket: "test-bucket" } as S3Config;

      await expect(s3Plugin(mockFastify, invalidConfig)).rejects.toThrow(
        "S3 region and bucket are required"
      );
    });

    it("should throw error when bucket is missing", async () => {
      const invalidConfig = { region: "us-east-1" } as S3Config;

      await expect(s3Plugin(mockFastify, invalidConfig)).rejects.toThrow(
        "S3 region and bucket are required"
      );
    });

    it("should register onClose hook", async () => {
      await s3Plugin(mockFastify, mockConfig);

      expect(mockFastify.addHook).toHaveBeenCalledWith(
        "onClose",
        expect.any(Function)
      );
    });
  });

  describe("createKey", () => {
    beforeEach(async () => {
      await s3Plugin(mockFastify, mockConfig);
      s3Decorator = (mockFastify.decorate as jest.Mock).mock.calls[0][1];
    });

    it("should create correct S3 key format", () => {
      const result = s3Decorator.createKey(
        "testing",
        "images",
        "123",
        "photo.jpg"
      );
      expect(result).toBe("testing/images/123/photo.jpg");
    });

    it("should handle different types and filenames", () => {
      const result = s3Decorator.createKey(
        "testing",
        "thumbnails",
        "abc-def",
        "thumb.png"
      );
      expect(result).toBe("testing/thumbnails/abc-def/thumb.png");
    });
  });

  describe("upload", () => {
    beforeEach(async () => {
      await s3Plugin(mockFastify, mockConfig);
      s3Decorator = (mockFastify.decorate as jest.Mock).mock.calls[0][1];
    });

    it("should upload file successfully with default content type", async () => {
      const uploadOptions: UploadOptions = {
        key: "images/123/photo.jpg",
        buffer: Buffer.from("test-image-data"),
      };

      mockS3Send.mockResolvedValueOnce({});

      const result = await s3Decorator.upload(uploadOptions);

      expect(mockS3Send).toHaveBeenCalledWith(expect.any(PutObjectCommand));
      expect(result).toBe(uploadOptions.key);
    });

    it("should upload file with custom content type and metadata", async () => {
      const uploadOptions: UploadOptions = {
        key: "images/123/photo.png",
        buffer: Buffer.from("test-image-data"),
        contentType: "image/png",
        metadata: {
          userId: "123",
          originalName: "photo.png",
        },
      };

      mockS3Send.mockResolvedValueOnce({});

      const result = await s3Decorator.upload(uploadOptions);

      expect(mockS3Send).toHaveBeenCalledWith(expect.any(PutObjectCommand));
      expect(result).toBe(uploadOptions.key);
    });

    it("should handle upload errors", async () => {
      const uploadOptions: UploadOptions = {
        key: "images/123/photo.jpg",
        buffer: Buffer.from("test-image-data"),
      };

      const mockError = new Error("S3 upload failed");
      mockS3Send.mockRejectedValueOnce(mockError);

      await expect(s3Decorator.upload(uploadOptions)).rejects.toThrow(
        "Failed to upload image: Error: S3 upload failed"
      );

      expect(mockFastify.log.error).toHaveBeenCalledWith(mockError);
    });
  });

  describe("download", () => {
    beforeEach(async () => {
      await s3Plugin(mockFastify, mockConfig);
      s3Decorator = (mockFastify.decorate as jest.Mock).mock.calls[0][1];
    });

    it("should download file successfully", async () => {
      const key = "images/123/photo.jpg";
      const mockBuffer = Buffer.from("test-image-data");

      // Mock readable stream
      const mockStream = {
        async *[Symbol.asyncIterator]() {
          yield mockBuffer;
        },
      };

      mockS3Send.mockResolvedValueOnce({
        Body: mockStream,
      });

      const result = await s3Decorator.download(key);

      expect(mockS3Send).toHaveBeenCalledWith(expect.any(GetObjectCommand));
      expect(result).toEqual(mockBuffer);
    });

    it("should handle missing response body", async () => {
      const key = "images/123/photo.jpg";

      mockS3Send.mockResolvedValueOnce({
        Body: null,
      });

      await expect(s3Decorator.download(key)).rejects.toThrow(
        "No data received from S3"
      );
    });

    it("should handle download errors", async () => {
      const key = "images/123/photo.jpg";
      const mockError = new Error("S3 download failed");
      mockS3Send.mockRejectedValueOnce(mockError);

      await expect(s3Decorator.download(key)).rejects.toThrow(
        "Failed to download image: Error: S3 download failed"
      );

      expect(mockFastify.log.error).toHaveBeenCalledWith(mockError);
    });
  });

  describe("delete", () => {
    beforeEach(async () => {
      await s3Plugin(mockFastify, mockConfig);
      s3Decorator = (mockFastify.decorate as jest.Mock).mock.calls[0][1];
    });

    it("should delete file successfully", async () => {
      const key = "images/123/photo.jpg";

      mockS3Send.mockResolvedValueOnce({});

      await s3Decorator.delete(key);

      expect(mockS3Send).toHaveBeenCalledWith(expect.any(DeleteObjectCommand));
    });

    it("should handle delete errors", async () => {
      const key = "images/123/photo.jpg";
      const mockError = new Error("S3 delete failed");
      mockS3Send.mockRejectedValueOnce(mockError);

      await expect(s3Decorator.delete(key)).rejects.toThrow(
        "Failed to delete image: Error: S3 delete failed"
      );

      expect(mockFastify.log.error).toHaveBeenCalledWith(mockError);
    });
  });

  describe("getInfo", () => {
    beforeEach(async () => {
      await s3Plugin(mockFastify, mockConfig);
      s3Decorator = (mockFastify.decorate as jest.Mock).mock.calls[0][1];
    });

    it("should get file info successfully", async () => {
      const key = "images/123/photo.jpg";
      const mockSignedUrl = "https://signed-url.example.com";
      const mockLastModified = new Date("2023-01-01T00:00:00Z");
      const mockMetadata = { userId: "123" };

      mockS3Send.mockResolvedValueOnce({
        ContentLength: 1024,
        LastModified: mockLastModified,
        ContentType: "image/jpeg",
        Metadata: mockMetadata,
      });

      (
        getSignedUrl as jest.MockedFunction<typeof getSignedUrl>
      ).mockResolvedValueOnce(mockSignedUrl);

      const result = await s3Decorator.getInfo(key);

      expect(mockS3Send).toHaveBeenCalledWith(expect.any(HeadObjectCommand));
      expect(getSignedUrl).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(HeadObjectCommand),
        { expiresIn: 3600 }
      );
      expect(result).toEqual({
        key,
        url: mockSignedUrl,
        size: 1024,
        lastModified: mockLastModified,
        contentType: "image/jpeg",
        metadata: mockMetadata,
      });
    });

    it("should handle missing optional fields", async () => {
      const key = "images/123/photo.jpg";
      const mockSignedUrl = "https://signed-url.example.com";

      mockS3Send.mockResolvedValueOnce({});

      (
        getSignedUrl as jest.MockedFunction<typeof getSignedUrl>
      ).mockResolvedValueOnce(mockSignedUrl);

      const result = await s3Decorator.getInfo(key);

      expect(result).toEqual({
        key,
        url: mockSignedUrl,
        size: 0,
        lastModified: expect.any(Date),
        contentType: "application/octet-stream",
        metadata: undefined,
      });
    });

    it("should handle getInfo errors", async () => {
      const key = "images/123/photo.jpg";
      const mockError = new Error("S3 head object failed");
      mockS3Send.mockRejectedValueOnce(mockError);

      await expect(s3Decorator.getInfo(key)).rejects.toThrow(
        "Failed to get image info: Error: S3 head object failed"
      );

      expect(mockFastify.log.error).toHaveBeenCalledWith(mockError);
    });
  });

  describe("getPublicUrl", () => {
    beforeEach(async () => {
      await s3Plugin(mockFastify, mockConfig);
      s3Decorator = (mockFastify.decorate as jest.Mock).mock.calls[0][1];
    });

    it("should generate correct public URL", () => {
      const key = "images/123/photo.jpg";
      const result = s3Decorator.getPublicUrl(key);

      expect(result).toBe(
        `https://${mockConfig.bucket}.s3.${mockConfig.region}.amazonaws.com/${key}`
      );
    });
  });

  describe("getSignedUrl", () => {
    beforeEach(async () => {
      await s3Plugin(mockFastify, mockConfig);
      s3Decorator = (mockFastify.decorate as jest.Mock).mock.calls[0][1];
    });

    it("should generate signed URL with default expiration", async () => {
      const key = "images/123/photo.jpg";
      const mockSignedUrl = "https://signed-url.example.com";

      (
        getSignedUrl as jest.MockedFunction<typeof getSignedUrl>
      ).mockResolvedValueOnce(mockSignedUrl);

      const result = await s3Decorator.getSignedUrl(key);

      expect(getSignedUrl).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(GetObjectCommand),
        { expiresIn: 3600 }
      );
      expect(result).toBe(mockSignedUrl);
    });

    it("should generate signed URL with custom expiration", async () => {
      const key = "images/123/photo.jpg";
      const expiresIn = 7200;
      const mockSignedUrl = "https://signed-url.example.com";

      (
        getSignedUrl as jest.MockedFunction<typeof getSignedUrl>
      ).mockResolvedValueOnce(mockSignedUrl);

      const result = await s3Decorator.getSignedUrl(key, expiresIn);

      expect(getSignedUrl).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(GetObjectCommand),
        { expiresIn }
      );
      expect(result).toBe(mockSignedUrl);
    });

    it("should handle signed URL generation errors", async () => {
      const key = "images/123/photo.jpg";
      const mockError = new Error("Signed URL generation failed");

      (
        getSignedUrl as jest.MockedFunction<typeof getSignedUrl>
      ).mockRejectedValueOnce(mockError);

      await expect(s3Decorator.getSignedUrl(key)).rejects.toThrow(
        "Failed to generate signed URL: Error: Signed URL generation failed"
      );

      expect(mockFastify.log.error).toHaveBeenCalledWith(mockError);
    });
  });

  describe("listImages", () => {
    beforeEach(async () => {
      await s3Plugin(mockFastify, mockConfig);
      s3Decorator = (mockFastify.decorate as jest.Mock).mock.calls[0][1];

      // Mock the fastify.s3.getInfo method for the internal listImages call
      mockFastify.s3 = {
        ...s3Decorator,
        getInfo: jest.fn(),
      } as any;
    });

    it("should list images without prefix", async () => {
      const mockObjects = [
        { Key: "images/123/photo1.jpg" },
        { Key: "images/456/photo2.png" },
      ];

      const mockImageInfo1: ImageInfo = {
        key: "images/123/photo1.jpg",
        url: "https://signed-url1.example.com",
        size: 1024,
        lastModified: new Date(),
        contentType: "image/jpeg",
      };

      const mockImageInfo2: ImageInfo = {
        key: "images/456/photo2.png",
        url: "https://signed-url2.example.com",
        size: 2048,
        lastModified: new Date(),
        contentType: "image/png",
      };

      mockS3Send.mockResolvedValueOnce({
        Contents: mockObjects,
      });

      (mockFastify.s3.getInfo as jest.MockedFunction<any>)
        .mockResolvedValueOnce(mockImageInfo1)
        .mockResolvedValueOnce(mockImageInfo2);

      const result = await s3Decorator.listImages();

      expect(mockS3Send).toHaveBeenCalledWith(expect.any(ListObjectsV2Command));
      expect(result).toEqual([mockImageInfo1, mockImageInfo2]);
    });

    it("should list images with prefix", async () => {
      const prefix = "images/123/";
      const mockObjects = [{ Key: "images/123/photo1.jpg" }];

      const mockImageInfo: ImageInfo = {
        key: "images/123/photo1.jpg",
        url: "https://signed-url.example.com",
        size: 1024,
        lastModified: new Date(),
        contentType: "image/jpeg",
      };

      mockS3Send.mockResolvedValueOnce({
        Contents: mockObjects,
      });

      (
        mockFastify.s3.getInfo as jest.MockedFunction<any>
      ).mockResolvedValueOnce(mockImageInfo);

      const result = await s3Decorator.listImages(prefix);

      expect(mockS3Send).toHaveBeenCalledWith(expect.any(ListObjectsV2Command));
      expect(result).toEqual([mockImageInfo]);
    });

    it("should return empty array when no contents", async () => {
      mockS3Send.mockResolvedValueOnce({
        Contents: undefined,
      });

      const result = await s3Decorator.listImages();

      expect(result).toEqual([]);
    });

    it("should skip objects without keys", async () => {
      const mockObjects = [
        { Key: "images/123/photo1.jpg" },
        { Key: undefined },
        { Key: "images/456/photo2.png" },
      ];

      const mockImageInfo: ImageInfo = {
        key: "images/456/photo2.png",
        url: "https://signed-url.example.com",
        size: 1024,
        lastModified: new Date(),
        contentType: "image/png",
      };

      mockS3Send.mockResolvedValueOnce({
        Contents: mockObjects,
      });

      (mockFastify.s3.getInfo as jest.MockedFunction<any>)
        .mockRejectedValueOnce(new Error("Access denied"))
        .mockResolvedValueOnce(mockImageInfo);

      const result = await s3Decorator.listImages();

      expect(mockFastify.log.warn).toHaveBeenCalledWith(
        expect.stringContaining("Failed to get info for images/123/photo1.jpg:")
      );
      expect(result).toEqual([mockImageInfo]);
    });

    it("should handle list images errors", async () => {
      const mockError = new Error("S3 list failed");
      mockS3Send.mockRejectedValueOnce(mockError);

      await expect(s3Decorator.listImages()).rejects.toThrow(
        "Failed to list images: Error: S3 list failed"
      );

      expect(mockFastify.log.error).toHaveBeenCalledWith(mockError);
    });
  });

  describe("exists", () => {
    beforeEach(async () => {
      await s3Plugin(mockFastify, mockConfig);
      s3Decorator = (mockFastify.decorate as jest.Mock).mock.calls[0][1];
    });

    it("should return true when object exists", async () => {
      const key = "images/123/photo.jpg";

      mockS3Send.mockResolvedValueOnce({});

      const result = await s3Decorator.exists(key);

      expect(mockS3Send).toHaveBeenCalledWith(expect.any(HeadObjectCommand));
      expect(result).toBe(true);
    });

    it("should return false when object not found by name", async () => {
      const key = "images/123/nonexistent.jpg";
      const notFoundError = new Error("Object not found");
      notFoundError.name = "NotFound";

      mockS3Send.mockRejectedValueOnce(notFoundError);

      const result = await s3Decorator.exists(key);

      expect(result).toBe(false);
    });

    it("should return false when object not found by status code", async () => {
      const key = "images/123/nonexistent.jpg";
      const notFoundError = new Error("Object not found");
      (notFoundError as any).$metadata = { httpStatusCode: 404 };

      mockS3Send.mockRejectedValueOnce(notFoundError);

      const result = await s3Decorator.exists(key);

      expect(result).toBe(false);
    });

    it("should throw error for other AWS errors", async () => {
      const key = "images/123/photo.jpg";
      const mockError = new Error("S3 service error");
      (mockError as any).$metadata = { httpStatusCode: 500 };

      mockS3Send.mockRejectedValueOnce(mockError);

      await expect(s3Decorator.exists(key)).rejects.toThrow(
        "Failed to check if image exists: Error: S3 service error"
      );

      expect(mockFastify.log.error).toHaveBeenCalledWith(mockError);
    });
  });

  describe("onClose hook", () => {
    it("should log cleanup message when server closes", async () => {
      await s3Plugin(mockFastify, mockConfig);

      const onCloseCallback = (mockFastify.addHook as jest.Mock).mock
        .calls[0][1];
      await onCloseCallback();

      expect(mockFastify.log.info).toHaveBeenCalledWith("S3 plugin cleaned up");
    });
  });
});

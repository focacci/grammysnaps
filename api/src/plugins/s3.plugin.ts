import { FastifyPluginAsync, FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export interface S3Config {
  region: string;
  bucket: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  endpoint?: string;
}

export interface UploadOptions {
  key: string;
  buffer: Buffer;
  contentType?: string;
  metadata?: Record<string, string>;
}

export interface ImageInfo {
  key: string;
  url: string;
  size: number;
  lastModified: Date;
  contentType: string;
  metadata?: Record<string, string>;
}

declare module "fastify" {
  interface FastifyInstance {
    s3: {
      createKey: (type: string, s3Id: string, filename: string) => string;
      upload: (options: UploadOptions) => Promise<string>;
      download: (key: string) => Promise<Buffer>;
      delete: (key: string) => Promise<void>;
      getInfo: (key: string) => Promise<ImageInfo>;
      getPublicUrl: (key: string) => string;
      getSignedUrl: (key: string, expiresIn?: number) => Promise<string>;
      listImages: (prefix?: string) => Promise<ImageInfo[]>;
      exists: (key: string) => Promise<boolean>;
    };
  }
}

const s3Plugin: FastifyPluginAsync<S3Config> = async (
  fastify: FastifyInstance,
  options: S3Config
) => {
  const { region, bucket, accessKeyId, secretAccessKey, endpoint } = options;

  if (!region || !bucket) {
    throw new Error("S3 region and bucket are required");
  }

  // Initialize S3 client
  const s3Client = new S3Client({
    region,
    credentials:
      accessKeyId && secretAccessKey
        ? {
            accessKeyId,
            secretAccessKey,
          }
        : undefined,
    endpoint,
    forcePathStyle: !!endpoint, // Required for local S3-compatible services
  });

  fastify.decorate("s3", {
    /**
     * Create a unique S3 key for an image based on imageId
     */
    createKey: (type: string, s3Id: string, filename: string) => {
      return `${type}/${s3Id}/${filename}`;
    },

    /**
     * Upload an image file to S3
     */
    async upload(options: UploadOptions): Promise<string> {
      const { key, buffer, contentType = "image/jpeg", metadata } = options;

      try {
        const command = new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: buffer,
          ContentType: contentType,
          Metadata: metadata,
        });

        await s3Client.send(command);

        // Return the S3 object key
        return key;
      } catch (err) {
        fastify.log.error(err);
        throw new Error(`Failed to upload image: ${err}`);
      }
    },

    /**
     * Download an image file from S3
     */
    async download(key: string): Promise<Buffer> {
      try {
        const command = new GetObjectCommand({
          Bucket: bucket,
          Key: key,
        });

        const response = await s3Client.send(command);

        if (!response.Body) {
          throw new Error("No data received from S3");
        }

        // Convert stream to buffer
        const chunks: Uint8Array[] = [];
        const stream = response.Body as any;

        for await (const chunk of stream) {
          chunks.push(chunk);
        }

        return Buffer.concat(chunks);
      } catch (err) {
        fastify.log.error(err);
        throw new Error(`Failed to download image: ${err}`);
      }
    },

    /**
     * Delete an image file from S3
     */
    async delete(key: string): Promise<void> {
      try {
        const command = new DeleteObjectCommand({
          Bucket: bucket,
          Key: key,
        });

        await s3Client.send(command);
      } catch (err) {
        fastify.log.error(err);
        throw new Error(`Failed to delete image: ${err}`);
      }
    },

    /**
     * Get image information and metadata
     */
    async getInfo(key: string): Promise<ImageInfo> {
      try {
        const command = new HeadObjectCommand({
          Bucket: bucket,
          Key: key,
        });

        const response = await s3Client.send(command);

        const signedUrl = await getSignedUrl(s3Client, command, {
          expiresIn: 3600,
        });

        return {
          key,
          url: signedUrl,
          size: response.ContentLength || 0,
          lastModified: response.LastModified || new Date(),
          contentType: response.ContentType || "application/octet-stream",
          metadata: response.Metadata,
        };
      } catch (err) {
        fastify.log.error(err);
        throw new Error(`Failed to get image info: ${err}`);
      }
    },

    /**
     * Generate a public URL for an S3 object
     */
    getPublicUrl(key: string): string {
      return `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
    },

    /**
     * Generate a signed URL for temporary access to an image
     */
    async getSignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
      try {
        const command = new GetObjectCommand({
          Bucket: bucket,
          Key: key,
        });

        const signedUrl = await getSignedUrl(s3Client, command, {
          expiresIn,
        });

        return signedUrl;
      } catch (err) {
        fastify.log.error(err);
        throw new Error(`Failed to generate signed URL: ${err}`);
      }
    },

    /**
     * List all images in the bucket with optional prefix filter
     */
    async listImages(prefix?: string): Promise<ImageInfo[]> {
      try {
        const command = new ListObjectsV2Command({
          Bucket: bucket,
          Prefix: prefix,
        });

        const response = await s3Client.send(command);

        if (!response.Contents) {
          return [];
        }

        const imageInfos: ImageInfo[] = [];

        for (const object of response.Contents) {
          if (object.Key) {
            try {
              const info = await fastify.s3.getInfo(object.Key);
              imageInfos.push(info);
            } catch (err) {
              // Skip objects that can't be accessed
              fastify.log.warn(`Failed to get info for ${object.Key}: ${err}`);
            }
          }
        }

        return imageInfos;
      } catch (err) {
        fastify.log.error(err);
        throw new Error(`Failed to list images: ${err}`);
      }
    },

    /**
     * Check if an image exists in S3
     */
    async exists(key: string): Promise<boolean> {
      try {
        const command = new HeadObjectCommand({
          Bucket: bucket,
          Key: key,
        });

        await s3Client.send(command);
        return true;
      } catch (err: any) {
        if (err.name === "NotFound" || err.$metadata?.httpStatusCode === 404) {
          return false;
        }

        fastify.log.error(err);
        throw new Error(`Failed to check if image exists: ${err}`);
      }
    },
  });

  // Add cleanup on server close
  fastify.addHook("onClose", async () => {
    // AWS SDK v3 doesn't require explicit cleanup
    fastify.log.info("S3 plugin cleaned up");
  });
};

export default fp(s3Plugin, {
  name: "s3",
  dependencies: [],
});

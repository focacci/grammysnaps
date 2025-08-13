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
import { S3Key, S3KeyParams, S3Environment, S3MediaType, S3Config, UploadOptions, ImageInfo } from "../types/s3.types";
import { UUID } from "crypto";



declare module "fastify" {
  interface FastifyInstance {
    s3: {
      createKey: (params: S3KeyParams) => S3Key;
      parseKey(key: S3Key): S3KeyParams;
      upload: (options: UploadOptions) => Promise<S3Key>;
      download: (key: S3Key) => Promise<Buffer>;
      delete: (key: S3Key) => Promise<void>;
      getInfo: (key: S3Key) => Promise<ImageInfo>;
      getPublicUrl: (key: S3Key) => string;
      getSignedUrl: (key: S3Key, expiresIn?: number) => Promise<string>;
      listImages: (prefix?: string) => Promise<ImageInfo[]>;
      exists: (key: S3Key) => Promise<boolean>;
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
     * Create a unique S3 key for an image based on parameters
     */
    createKey: (params: S3KeyParams) => {
      const { env, userId, type, s3Id, filename } = params;
      return `${env}/users/${userId}/images/${s3Id}/${type}/${filename}` as S3Key;
    },

    /**
     * Parse an S3 key into its components
     */
    parseKey(key: S3Key): S3KeyParams {
      const [env, userId, type, s3Id, filename] = key.split("/") as [
        S3Environment,
        UUID,
        S3MediaType,
        UUID,
        string
      ];

      return { env, userId, type, s3Id, filename };
    },

    /**
     * Upload an image file to S3
     */
    async upload(options: UploadOptions): Promise<S3Key> {
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
    async download(key: S3Key): Promise<Buffer> {
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
        const chunks: Buffer[] = [];
        const stream = response.Body as NodeJS.ReadableStream;

        for await (const chunk of stream) {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
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
    async delete(key: S3Key): Promise<void> {
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
    async getInfo(key: S3Key): Promise<ImageInfo> {
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
    getPublicUrl(key: S3Key): string {
      return `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
    },

    /**
     * Generate a signed URL for temporary access to an image
     */
    async getSignedUrl(key: S3Key, expiresIn: number = 3600): Promise<string> {
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
              // Validate and cast the key to S3Key type - check if it follows our key format
              if (object.Key.includes('/users/') && object.Key.match(/^[^/]+\/users\/[^/]+\/[^/]+\/[^/]+\/[^/]+$/)) {
                const info = await fastify.s3.getInfo(object.Key as S3Key);
                imageInfos.push(info);
              } else {
                fastify.log.warn(`Skipping non-standard key: ${object.Key}`);
              }
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
    async exists(key: S3Key): Promise<boolean> {
      try {
        const command = new HeadObjectCommand({
          Bucket: bucket,
          Key: key,
        });

        await s3Client.send(command);
        return true;
      } catch (err: unknown) {
        if (err && typeof err === 'object' && 'name' in err && (err.name === "NotFound" || ('$metadata' in err && err.$metadata && typeof err.$metadata === 'object' && 'httpStatusCode' in err.$metadata && err.$metadata.httpStatusCode === 404))) {
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

export default fp(s3Plugin, { name: "s3" });

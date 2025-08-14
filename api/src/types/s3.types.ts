import { UUID } from "crypto";

export interface S3Config {
  region: string;
  bucket: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  endpoint?: string;
}

export interface UploadOptions {
  key: S3Key;
  buffer: Buffer;
  contentType?: string;
  metadata?: Record<string, string>;
}

export interface ImageInfo {
  key: S3Key;
  url: string;
  size: number;
  lastModified: Date;
  contentType: string;
  metadata?: Record<string, string>;
}

/**
 * S3 key structure and types for type-safe S3 operations
 */

// Environment literal values
export type S3Environment = 'local' | 'staging' | 'production';

// Type literal values for collections
export type S3MediaType = 'original' | 'thumbnail' | 'profile';

// S3 key template type
export type S3Key = `${S3Environment}/users/${UUID}/images/${UUID}/${S3MediaType}/${string}`;

/**
 * S3 key builder parameters
 */
export interface S3KeyParams {
  env: S3Environment;
  userId: UUID;
  type: S3MediaType;
  s3Id: UUID;
  filename: string;
}


import { UUID } from "crypto";
import { S3Key } from "./s3.types";

export interface ImageInput {
  file?: Buffer;
  title?: string;
  filename?: string;
  tags?: UUID[];
  collection_ids?: UUID[];
  original_key?: S3Key;
  thumbnail_key?: S3Key;
}

export interface Image {
  id: UUID;
  title?: string;
  filename: string;
  created_at: string;
  updated_at: string;
  tags?: UUID[];
  collection_ids?: UUID[];
  original_key?: S3Key;
  thumbnail_key?: S3Key;
}

export interface ImagePublic {
  id: UUID;
  title?: string;
  filename: string;
  created_at: string;
  updated_at: string;
  tags?: UUID[];
  collection_ids?: UUID[];
  original_url: string | null;
  thumbnail_url: string | null;
}

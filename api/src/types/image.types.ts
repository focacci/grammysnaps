import { Tag } from "./tag.types";

export interface ImageInput {
  file?: Buffer;
  title?: string;
  filename?: string;
  tags?: string[];
  s3Url?: string;
}

export interface Image {
  id: string;
  title?: string;
  filename: string;
  created_at: string;
  updated_at: string;
  tags?: string[];
  s3_url?: string;
}

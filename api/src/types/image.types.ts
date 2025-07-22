import { Tag } from "./tag.types";

export interface Image {
  id: string;
  filename: string;
  created_at: string;
  updated_at: string;
  s3_url?: string;
}

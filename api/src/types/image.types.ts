import { Tag } from "./tag.types";

export interface ImageInput {
  filename?: string;
  tags?: string[];
}

export interface Image {
  id: string;
  filename: string;
  created_at: string;
  updated_at: string;
  tags?: string[];
}

// User type definitions

import { UUID } from "crypto";
import { S3Key } from "./s3.types";

export interface User {
  id: UUID;
  email: string;
  password_hash: string;
  first_name?: string | null;
  middle_name?: string | null;
  last_name?: string | null;
  birthday?: string | null; // YYYY-MM-DD format
  families: UUID[];
  profile_picture_key?: S3Key | null;
  profile_picture_thumbnail_key?: S3Key | null;
  created_at: string;
  updated_at: string;
}

export interface UserInput {
  email: string;
  password: string;
  first_name: string | null;
  middle_name: string | null;
  last_name: string | null;
  birthday: string | null;
  families: UUID[];
  profile_picture_key?: S3Key;
  invite_key?: string;
}

export interface UserUpdate {
  email?: string;
  first_name?: string | null;
  middle_name?: string | null;
  last_name?: string | null;
  birthday?: string | null;
  families?: UUID[];
  profile_picture_key?: S3Key;
  profile_picture_thumbnail_key?: S3Key;
}

export interface UserPublic {
  id: UUID;
  email: string;
  first_name?: string | null;
  middle_name?: string | null;
  last_name?: string | null;
  birthday?: string | null;
  families: UUID[];
  profile_picture_key?: S3Key | null;
  profile_picture_thumbnail_key?: S3Key | null;
  profile_picture_url?: string | null;
  profile_picture_thumbnail_url?: string | null;
  created_at: string;
  updated_at: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface PasswordChangeInput {
  current_password: string;
  new_password: string;
}

export interface SecurityUpdateInput {
  current_password?: string;
  new_password?: string;
}

export interface LoginResponse {
  user: UserPublic;
  token?: string;
}

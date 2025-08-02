// User type definitions

export interface User {
  id: string;
  email: string;
  password_hash: string;
  first_name?: string | null;
  middle_name?: string | null;
  last_name?: string | null;
  birthday?: string | null; // YYYY-MM-DD format
  families: string[];
  profile_picture_url?: string | null;
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
  families: string[];
  profile_picture_url?: string;
  invite_key?: string;
}

export interface UserUpdate {
  email?: string;
  first_name?: string | null;
  middle_name?: string | null;
  last_name?: string | null;
  birthday?: string | null;
  families?: string[];
  profile_picture_url?: string;
}

export interface UserPublic {
  id: string;
  email: string;
  first_name?: string | null;
  middle_name?: string | null;
  last_name?: string | null;
  birthday?: string | null;
  families: string[];
  profile_picture_url?: string | null;
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

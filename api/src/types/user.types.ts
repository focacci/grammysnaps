// User type definitions

export interface User {
  id: string;
  email: string;
  password_hash: string;
  first_name?: string;
  middle_name?: string;
  last_name?: string;
  birthday?: string; // ISO date string
  families: string[];
  profile_picture_url?: string;
  created_at: string;
  updated_at: string;
}

export interface UserInput {
  email: string;
  password: string;
  first_name?: string;
  middle_name?: string;
  last_name?: string;
  birthday?: string;
  families?: string[];
  profile_picture_url?: string;
}

export interface UserUpdate {
  email?: string;
  first_name?: string;
  middle_name?: string;
  last_name?: string;
  birthday?: string;
  families?: string[];
  profile_picture_url?: string;
}

export interface UserPublic {
  id: string;
  email: string;
  first_name?: string;
  middle_name?: string;
  last_name?: string;
  birthday?: string;
  families: string[];
  profile_picture_url?: string;
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

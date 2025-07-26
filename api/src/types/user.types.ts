// User type definitions

export interface User {
  id: string;
  email: string;
  password_hash: string;
  families: string[];
  created_at: string;
  updated_at: string;
}

export interface UserInput {
  email: string;
  password: string;
  families?: string[];
}

export interface UserUpdate {
  email?: string;
  families?: string[];
}

export interface UserPublic {
  id: string;
  email: string;
  families: string[];
  created_at: string;
  updated_at: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface LoginResponse {
  user: UserPublic;
  token?: string;
}

import { UUID } from "crypto";
import { User } from "./user.types";

export interface Family {
  id: UUID;
  name: string;
  members: UUID[]; // array of user IDs
  owner_id: UUID;
  related_families: UUID[]; // array of family IDs
  created_at: string;
  updated_at: string;
}

export interface FamilyInput {
  name: string;
  description?: string;
  related_families?: UUID[]; // array of family IDs
}

export interface FamilyUpdate {
  name?: string;
  description?: string;
  related_families?: UUID[];
}

export interface FamilyPublic {
  id: UUID;
  name: string;
  member_count: number;
  owner_id: UUID;
  user_role: "owner" | "member";
  related_families: UUID[]; // array of family IDs
  created_at: string;
  updated_at: string;
}

export interface FamilyMember extends User {
  role: "owner" | "member";
  joined_at: string;
}

export interface RelatedFamily {
  id: UUID;
  name: string;
  member_count: number;
  created_at: string;
}

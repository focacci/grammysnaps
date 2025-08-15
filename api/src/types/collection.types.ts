import { UUID } from "crypto";
import { UserPublic } from "./user.types";

export interface Collection {
  id: UUID;
  name: string;
  members: UUID[]; // array of user IDs
  owner_id: UUID;
  related_collections: UUID[]; // array of collection IDs
  created_at: string;
  updated_at: string;
}

export interface CollectionInput {
  name: string;
  description?: string;
  related_collections?: UUID[]; // array of collection IDs
}

export interface CollectionUpdate {
  name?: string;
  description?: string;
  related_collections?: UUID[];
}

export interface CollectionPublic {
  id: UUID;
  name: string;
  member_count: number;
  owner_id: UUID;
  user_role: "owner" | "member";
  related_collections: UUID[]; // array of collection IDs
  created_at: string;
  updated_at: string;
}

export interface CollectionMember extends UserPublic {
  role: "owner" | "member";
  joined_at: string;
}

export interface RelatedCollection {
  id: UUID;
  name: string;
  member_count: number;
  created_at: string;
}

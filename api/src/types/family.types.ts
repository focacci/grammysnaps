export interface Family {
  id: string;
  name: string;
  members: string[]; // array of user IDs
  owner_id: string;
  related_families: string[]; // array of family IDs
  created_at: string;
  updated_at: string;
}

export interface FamilyInput {
  name: string;
  description?: string;
  related_families?: string[]; // array of family IDs
}

export interface FamilyUpdate {
  name?: string;
  description?: string;
  related_families?: string[];
}

export interface FamilyPublic {
  id: string;
  name: string;
  member_count: number;
  owner_id: string;
  user_role: "owner" | "member";
  related_families: string[]; // array of family IDs
  created_at: string;
  updated_at: string;
}

export interface FamilyMember {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  birthday?: string;
  profile_picture_url?: string | null;
  profile_picture_thumbnail_url?: string | null;
  role: "owner" | "member";
  joined_at: string;
}

export interface RelatedFamily {
  id: string;
  name: string;
  member_count: number;
  created_at: string;
}

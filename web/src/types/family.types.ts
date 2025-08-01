export interface FamilyGroup {
  id: string;
  name: string;
  member_count: number;
  owner_id: string;
  user_role: "owner" | "member";
  related_families: string[];
  created_at: string;
  updated_at: string;
}

export interface FamilyInput {
  name: string;
  description?: string;
}

export interface FamilyMember {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  birthday?: string | null;
  role: "owner" | "member";
  joined_at: string;
}

export interface RelatedFamily {
  id: string;
  name: string;
  member_count: number;
  created_at: string;
}

export interface FamilyGroup {
  id: string;
  name: string;
  member_count: number;
  owner_id: string;
  user_role: "owner" | "member";
  created_at: string;
  updated_at: string;
}

export interface FamilyInput {
  name: string;
  description?: string;
}

export interface FamilyMember {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: "owner" | "member";
  joined_at: string;
}

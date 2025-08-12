import { UUID } from "crypto";

export type Tag = {
  id: UUID;
  name: string;
  family_id: UUID;
  created_at: string;
  updated_at: string;
};

export type PersonTag = Tag & {
  type: "Person";
  firstname?: string;
  lastname?: string;
  mother?: PersonTag;
  father?: PersonTag;
  spouse?: PersonTag;
};

export type LocationTag = Tag & {
  type: "Location";
  address?: string;
  country?: string;
  state?: string;
  city?: string;
  postalCode?: string;
  latitude?: number;
  longitude?: number;
};

export type EventTag = Tag & {
  type: "Event";
  date?: Date | Date[]; // Array for range [start, end]
};

export type TimeTag = Tag & {
  type: "Time";
  time?: string; // Could be a specific time or a range
};

export interface TagInput {
  type: "Person" | "Location" | "Event" | "Time";
  name: string;
  family_id: UUID;
  created_by: UUID;
}

export interface TagUpdateInput {
  type: "Person" | "Location" | "Event" | "Time";
  name: string;
  family_id: UUID;
}

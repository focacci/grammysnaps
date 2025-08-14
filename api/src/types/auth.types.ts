import { UUID } from "crypto";

export interface TokenPayload {
  userId: UUID;
  email: string;
}

export interface RefreshTokenPayload {
  userId: UUID;
  tokenVersion: number;
}
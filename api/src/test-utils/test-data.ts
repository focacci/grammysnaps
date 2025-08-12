import { v4 as uuidv4 } from "uuid";
import { UUID } from "crypto";
import { S3Key } from "../types/s3.types";

/**
 * Test utilities for generating mock data with correct types
 */

// Generate valid UUIDs for tests
export const TEST_UUIDS = {
  USER_1: "550e8400-e29b-41d4-a716-446655440001" as UUID,
  USER_2: "550e8400-e29b-41d4-a716-446655440002" as UUID,
  FAMILY_1: "550e8400-e29b-41d4-a716-446655440011" as UUID,
  FAMILY_2: "550e8400-e29b-41d4-a716-446655440012" as UUID,
  IMAGE_1: "550e8400-e29b-41d4-a716-446655440021" as UUID,
  IMAGE_2: "550e8400-e29b-41d4-a716-446655440022" as UUID,
  TAG_1: "550e8400-e29b-41d4-a716-446655440031" as UUID,
  TAG_2: "550e8400-e29b-41d4-a716-446655440032" as UUID,
  TAG_3: "550e8400-e29b-41d4-a716-446655440033" as UUID,
  S3_ID_1: "550e8400-e29b-41d4-a716-446655440041" as UUID,
  S3_ID_2: "550e8400-e29b-41d4-a716-446655440042" as UUID,
};

// Generate valid S3 keys for tests
export const TEST_S3_KEYS = {
  ORIGINAL_1: "local/users/550e8400-e29b-41d4-a716-446655440001/original/550e8400-e29b-41d4-a716-446655440041/test.jpg" as S3Key,
  THUMBNAIL_1: "local/users/550e8400-e29b-41d4-a716-446655440001/thumbnail/550e8400-e29b-41d4-a716-446655440041/thumb_test.jpg" as S3Key,
  ORIGINAL_2: "local/users/550e8400-e29b-41d4-a716-446655440002/original/550e8400-e29b-41d4-a716-446655440042/test2.jpg" as S3Key,
  THUMBNAIL_2: "local/users/550e8400-e29b-41d4-a716-446655440002/thumbnail/550e8400-e29b-41d4-a716-446655440042/thumb_test2.jpg" as S3Key,
};

/**
 * Generate a random UUID for tests
 */
export function generateTestUUID(): UUID {
  return uuidv4() as UUID;
}

/**
 * Generate a valid S3 key for tests
 */
export function generateTestS3Key(
  userId: UUID = TEST_UUIDS.USER_1,
  type: "original" | "thumbnail" | "profile" = "original",
  s3Id: UUID = TEST_UUIDS.S3_ID_1,
  filename: string = "test.jpg"
): S3Key {
  return `local/users/${userId}/${type}/${s3Id}/${filename}` as S3Key;
}

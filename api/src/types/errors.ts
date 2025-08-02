/**
 * Centralized error messages for the API
 * All error messages should be imported from this file to ensure consistency
 */

// Authentication Errors
export const AUTH_ERRORS = {
  RATE_LIMIT: "Too many authentication attempts, please try again later.",
  PASSWORD_REQUIRED: "Password is required and must be a valid string",
  INVALID_CREDENTIALS: "Invalid email or password",
  LOGIN_FAILED:
    "Unable to log in at this time. Please check your credentials and try again.",
  REFRESH_TOKEN_REQUIRED: "Refresh token is required to get a new access token",
  SESSION_EXPIRED: "Your session has expired. Please log in again.",
  ACCOUNT_NOT_FOUND:
    "Your account no longer exists. Please contact support if this is unexpected.",
  REFRESH_FAILED: "Unable to refresh your session. Please log in again.",
  LOGOUT_FAILED: "Unable to log out at this time. Please try again.",
  TOKEN_REQUIRED: "Authentication token is required. Please log in first.",
  SESSION_INVALID: "Your session is no longer valid. Please log in again.",
  VALIDATION_FAILED:
    "Unable to validate your session. Please try logging in again.",
  MIDDLEWARE_TOKEN_REQUIRED:
    "Authentication token is required. Please log in to access this resource.",
  MIDDLEWARE_SESSION_EXPIRED:
    "Your session has expired or is invalid. Please log in again.",
  MIDDLEWARE_SERVICE_UNAVAILABLE:
    "Authentication service is temporarily unavailable. Please try again.",
} as const;

// User Errors
export const USER_ERRORS = {
  ACCOUNT_EXISTS:
    "An account with this email address already exists. Please use a different email or try logging in instead.",
  INVITE_KEY_REQUIRED:
    "An invite key is required to create an account in the development environment.",
  INVITE_KEY_INVALID:
    "The invite key you provided is invalid. Please check with your administrator.",
  CREATE_FAILED:
    "Unable to create your account at this time. Please try again later.",
  RETRIEVE_FAILED:
    "Unable to retrieve users at this time. Please try again later.",
  NOT_FOUND:
    "The requested user could not be found. They may have been deleted or the ID is incorrect.",
  GET_BY_ID_FAILED:
    "Unable to retrieve the user by ID at this time. Please try again later.",
  EMAIL_NOT_FOUND:
    "No user found with this email address. Please check the email and try again.",
  GET_BY_EMAIL_FAILED:
    "Unable to retrieve the user by email at this time. Please try again later.",
  UPDATE_NOT_FOUND:
    "The user you're trying to update could not be found. They may have been deleted.",
  EMAIL_IN_USE:
    "This email address is already in use by another account. Please choose a different email.",
  UPDATE_FAILED:
    "Unable to update your profile at this time. Please try again later.",
  SECURITY_UPDATE_NOT_FOUND:
    "The user account could not be found. Please try logging in again.",
  INCORRECT_PASSWORD:
    "The current password you entered is incorrect. Please try again.",
  CURRENT_PASSWORD_REQUIRED:
    "Your current password is required to make security changes.",
  SECURITY_UPDATE_FAILED:
    "Unable to update your security settings at this time. Please try again later.",
  DELETE_NOT_FOUND:
    "The user account could not be found or has already been deleted.",
  DELETE_FAILED:
    "Unable to delete the user account at this time. Please try again later.",
  ADD_TO_FAMILY_USER_NOT_FOUND:
    "The user could not be found. They may have been deleted.",
  ADD_TO_FAMILY_FAMILY_NOT_FOUND:
    "The family could not be found. It may have been deleted.",
  ADD_TO_FAMILY_FAILED:
    "Unable to add the user to the family at this time. Please try again later.",
  REMOVE_FROM_FAMILY_USER_NOT_FOUND:
    "The user could not be found. They may have been deleted.",
  REMOVE_FROM_FAMILY_FAMILY_NOT_FOUND:
    "The family could not be found. It may have been deleted.",
  REMOVE_FROM_FAMILY_FAILED:
    "Unable to remove the user from the family at this time. Please try again later.",
  PROFILE_PICTURE_MULTIPART_REQUIRED: "Request must be multipart/form-data",
  PROFILE_PICTURE_PROCESSING_ERROR: "Error processing form data",
  PROFILE_PICTURE_NO_FILE:
    "No file uploaded. Please provide a profile picture.",
  PROFILE_PICTURE_INVALID_TYPE:
    "Invalid file type. Only JPEG, PNG, GIF, and WebP images are allowed.",
  PROFILE_PICTURE_EMPTY: "Uploaded file is empty",
  PROFILE_PICTURE_TOO_LARGE: "File size exceeds 5 MB limit",
  PROFILE_PICTURE_UPLOAD_FAILED:
    "Unable to save profile picture. Please try again later.",
  PROFILE_PICTURE_USER_NOT_FOUND: "User not found",
  PROFILE_PICTURE_GENERAL_FAILED: "Profile picture upload failed",
} as const;

// Family Errors
export const FAMILY_ERRORS = {
  RETRIEVE_FAILED:
    "Unable to retrieve families at this time. Please try again later.",
  RETRIEVE_USER_FAMILIES_FAILED:
    "Unable to retrieve user's families at this time. Please try again later.",
  NOT_FOUND:
    "The requested family could not be found. It may have been deleted.",
  GET_BY_ID_FAILED:
    "Unable to retrieve the family at this time. Please try again later.",
  GET_MEMBERS_FAILED:
    "Unable to retrieve family members at this time. Please try again later.",
  OWNER_ID_REQUIRED:
    "Owner ID is required to create a family. Please log in and try again.",
  NAME_REQUIRED: "Family name is required and cannot be empty.",
  CREATE_FAILED:
    "Unable to create the family at this time. Please try again later.",
  UPDATE_NOT_FOUND:
    "The family you're trying to update could not be found. It may have been deleted.",
  UPDATE_FAILED:
    "Unable to update the family at this time. Please try again later.",
  DELETE_FAILED:
    "Unable to delete the family at this time. Please try again later.",
  USER_ID_REQUIRED: "user_id is required",
  ADD_MEMBER_FAILED:
    "Unable to add member to the family at this time. Please try again later.",
  REMOVE_MEMBER_FAILED:
    "Unable to remove member from the family at this time. Please try again later.",
  GET_RELATED_FAILED:
    "Unable to retrieve related families at this time. Please try again later.",
  FAMILY_ID_REQUIRED: "family_id is required",
  ADD_RELATED_FAILED:
    "Unable to link families at this time. Please try again later.",
  REMOVE_RELATED_FAILED:
    "Unable to unlink families at this time. Please try again later.",
} as const;

// Image Errors
export const IMAGE_ERRORS = {
  NOT_FOUND: "Image not found",
  FILE_NOT_FOUND: "Image file not found in storage",
  DOWNLOAD_FAILED:
    "Unable to download the image at this time. Please try again later.",
  MULTIPART_REQUIRED: "Request must be multipart/form-data",
  PROCESSING_ERROR: "Error processing form data",
  NO_FILE: "No file uploaded. Please provide an image file.",
  FAMILY_REQUIRED: "At least one family must be associated with the image.",
  INVALID_TYPE:
    "Invalid file type. Only JPEG, PNG, GIF, and WebP images are allowed.",
  TOO_LARGE: "File too large. Maximum size is 10MB.",
  UPLOAD_FAILED: "Unable to upload image at this time. Please try again later.",
  GET_BY_FAMILY_FAILED:
    "Unable to retrieve family images at this time. Please try again later.",
  DELETE_FAILED:
    "Unable to delete the image at this time. Please try again later.",
  GET_BY_FAMILIES_FAILED:
    "Unable to retrieve images at this time. Please try again later.",
} as const;

// Tag Errors
export const TAG_ERRORS = {
  NOT_FOUND: "Tag not found",
  DELETE_FAILED:
    "Unable to delete the tag at this time. Please try again later.",
} as const;

// Rate Limiting Errors
export const RATE_LIMIT_ERRORS = {
  TOO_MANY_REQUESTS: "Too many requests, please try again later.",
} as const;

// General Server Errors
export const SERVER_ERRORS = {
  HEALTH_CHECK_FAILED: "Server health check failed",
  INTERNAL_ERROR: "An internal server error occurred",
} as const;

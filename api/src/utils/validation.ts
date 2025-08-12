import validator from "validator";
import DOMPurify from "dompurify";
import { JSDOM } from "jsdom";
import { UUID } from "crypto";

// Create a DOM window for server-side DOMPurify
const window = new JSDOM("").window;
const purify = DOMPurify(window as any);

export class ValidationUtils {
  /**
   * Sanitize and validate email input
   */
  static sanitizeEmail(email: string): string {
    if (!email || typeof email !== "string") {
      throw new Error("Email is required and must be a string");
    }

    // Trim whitespace and convert to lowercase
    const sanitized = email.trim().toLowerCase();

    // Validate email format
    if (!validator.isEmail(sanitized)) {
      throw new Error("Invalid email format");
    }

    // Additional length check
    if (sanitized.length > 254) {
      throw new Error("Email is too long");
    }

    return sanitized;
  }

  /**
   * Sanitize and validate password input
   */
  static sanitizePassword(password: string): string {
    if (!password || typeof password !== "string") {
      throw new Error("Password is required and must be a string");
    }

    // Don't trim passwords as leading/trailing spaces might be intentional
    if (password.length < 6) {
      throw new Error("Password must be at least 6 characters long");
    }

    if (password.length > 128) {
      throw new Error("Password is too long (max 128 characters)");
    }

    // Check for common weak passwords
    const commonPasswords = [
      "password",
      "123456",
      "password123",
      "admin",
      "qwerty",
      "adminpassword",
    ];
    if (commonPasswords.includes(password.toLowerCase())) {
      throw new Error(
        "Password is too common. Please choose a stronger password"
      );
    }

    return password;
  }

  /**
   * Sanitize text input (names, etc.)
   */
  static sanitizeText(
    text: string,
    fieldName: string,
    required: boolean = false,
    maxLength: number = 100
  ): string {
    if (!text || typeof text !== "string") {
      if (required) {
        throw new Error(`${fieldName} is required and must be a string`);
      }
      return "";
    }

    // Trim whitespace
    let sanitized = text.trim();

    // Check if empty after trimming
    if (required && sanitized.length === 0) {
      throw new Error(`${fieldName} cannot be empty`);
    }

    // Length validation
    if (sanitized.length > maxLength) {
      throw new Error(`${fieldName} is too long (max ${maxLength} characters)`);
    }

    // Sanitize HTML to prevent XSS
    sanitized = purify.sanitize(sanitized, { ALLOWED_TAGS: [] });

    // Additional validation for names (only letters, spaces, hyphens, apostrophes)
    if (fieldName.toLowerCase().includes("name")) {
      // eslint-disable-next-line no-useless-escape
      const nameRegex = /^[a-zA-Z\s\-'\.]+$/;
      if (!nameRegex.test(sanitized)) {
        throw new Error(
          `${fieldName} contains invalid characters. Only letters, spaces, hyphens, and apostrophes are allowed`
        );
      }
    }

    return sanitized;
  }

  /**
   * Sanitize and validate date input
   */
  static sanitizeDate(dateString: string): string | null {
    if (!dateString || typeof dateString !== "string") {
      return null;
    }

    const trimmed = dateString.trim();
    if (!trimmed) {
      return null;
    }

    // Validate date format (YYYY-MM-DD)
    if (!validator.isDate(trimmed, { format: "YYYY-MM-DD" })) {
      throw new Error("Invalid date format. Please use YYYY-MM-DD format");
    }

    const date = new Date(trimmed);
    const now = new Date();

    // Check if date is in the future
    if (date > now) {
      throw new Error("Birthday cannot be in the future");
    }

    // Check if date is too far in the past (e.g., before 1900)
    const minDate = new Date("1900-01-01");
    if (date < minDate) {
      throw new Error("Birthday cannot be before 1900");
    }

    return trimmed;
  }

  /**
   * Sanitize array of family IDs
   */
  static sanitizeFamilyIds(families: UUID[]): UUID[] {
    if (!Array.isArray(families)) {
      return [];
    }

    const sanitized: UUID[] = [];

    for (const familyId of families) {
      if (typeof familyId === "string") {
        const trimmed = familyId.trim();
        if (trimmed) {
          // Validate family ID format (UUID)
          if (!validator.isUUID(trimmed)) {
            throw new Error("Family ID must be a valid UUID");
          }

          sanitized.push(trimmed as UUID);
        }
      }
    }

    // Remove duplicates
    return [...new Set(sanitized)];
  }

  /**
   * Sanitize and validate UUID
   */
  static sanitizeUUID(uuid: UUID, fieldName: string): UUID {
    const trimmed = uuid.trim();
    if (!validator.isUUID(trimmed)) {
      throw new Error(`Invalid ${fieldName} format`);
    }

    return trimmed as UUID;
  }

  /**
   * Rate limiting helper - check if too many requests from same source
   */
  static checkRateLimit(attempts: number, maxAttempts: number = 5): void {
    if (attempts >= maxAttempts) {
      throw new Error("Too many attempts. Please try again later");
    }
  }

  /**
   * Sanitize and validate URL input
   */
  static sanitizeURL(url: string, fieldName: string = "URL"): string {
    if (!url || typeof url !== "string") {
      throw new Error(`${fieldName} is required and must be a string`);
    }

    const trimmed = url.trim();

    // Validate URL format
    if (!validator.isURL(trimmed, { require_protocol: true })) {
      throw new Error(`Invalid ${fieldName} format`);
    }

    // Optionally, limit length
    if (trimmed.length > 2048) {
      throw new Error(`${fieldName} is too long (max 2048 characters)`);
    }

    // Sanitize to remove any embedded HTML
    const sanitized = purify.sanitize(trimmed, { ALLOWED_TAGS: [] });

    return sanitized;
  }
}

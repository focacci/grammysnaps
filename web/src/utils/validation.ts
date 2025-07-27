import validator from "validator";
import DOMPurify from "dompurify";

export class ClientValidationUtils {
  /**
   * Sanitize and validate email input on the client side
   */
  static sanitizeEmail(email: string): {
    sanitized: string;
    error: string | null;
  } {
    if (!email || typeof email !== "string") {
      return { sanitized: "", error: "Email is required" };
    }

    // Trim whitespace and convert to lowercase
    const sanitized = email.trim().toLowerCase();

    if (!sanitized) {
      return { sanitized: "", error: "Email cannot be empty" };
    }

    // Validate email format
    if (!validator.isEmail(sanitized)) {
      return { sanitized, error: "Please enter a valid email address" };
    }

    // Additional length check
    if (sanitized.length > 254) {
      return { sanitized, error: "Email is too long" };
    }

    return { sanitized, error: null };
  }

  /**
   * Validate password strength on the client side
   */
  static validatePassword(password: string): {
    error: string | null;
    strength: "weak" | "medium" | "strong";
  } {
    if (!password || typeof password !== "string") {
      return { error: "Password is required", strength: "weak" };
    }

    if (password.length < 6) {
      return {
        error: "Password must be at least 6 characters long",
        strength: "weak",
      };
    }

    if (password.length > 128) {
      return {
        error: "Password is too long (max 128 characters)",
        strength: "weak",
      };
    }

    // Check for common weak passwords
    const commonPasswords = [
      "password",
      "123456",
      "password123",
      "admin",
      "qwerty",
      "111111",
      "abc123",
    ];
    if (commonPasswords.includes(password.toLowerCase())) {
      return {
        error: "Password is too common. Please choose a stronger password",
        strength: "weak",
      };
    }

    // Calculate password strength
    let strength: "weak" | "medium" | "strong" = "weak";
    let score = 0;

    // Length bonus
    if (password.length >= 8) score += 1;
    if (password.length >= 12) score += 1;

    // Character variety
    if (/[a-z]/.test(password)) score += 1; // lowercase
    if (/[A-Z]/.test(password)) score += 1; // uppercase
    if (/[0-9]/.test(password)) score += 1; // numbers
    if (/[^a-zA-Z0-9]/.test(password)) score += 1; // special characters

    if (score >= 4) strength = "strong";
    else if (score >= 2) strength = "medium";

    return { error: null, strength };
  }

  /**
   * Sanitize text input (names, etc.) on the client side
   */
  static sanitizeText(
    text: string,
    fieldName: string,
    required: boolean = false,
    maxLength: number = 100
  ): { sanitized: string; error: string | null } {
    if (!text || typeof text !== "string") {
      if (required) {
        return { sanitized: "", error: `${fieldName} is required` };
      }
      return { sanitized: "", error: null };
    }

    // Trim whitespace
    let sanitized = text.trim();

    // Check if empty after trimming
    if (required && sanitized.length === 0) {
      return { sanitized: "", error: `${fieldName} cannot be empty` };
    }

    // Length validation
    if (sanitized.length > maxLength) {
      return {
        sanitized,
        error: `${fieldName} is too long (max ${maxLength} characters)`,
      };
    }

    // Sanitize HTML to prevent XSS
    sanitized = DOMPurify.sanitize(sanitized, { ALLOWED_TAGS: [] });

    // Additional validation for names (only letters, spaces, hyphens, apostrophes)
    if (fieldName.toLowerCase().includes("name")) {
      const nameRegex = /^[a-zA-Z\s\-'\.]+$/;
      if (sanitized && !nameRegex.test(sanitized)) {
        return {
          sanitized,
          error: `${fieldName} contains invalid characters. Only letters, spaces, hyphens, and apostrophes are allowed`,
        };
      }
    }

    return { sanitized, error: null };
  }

  /**
   * Validate date input on the client side
   */
  static validateDate(dateString: string): {
    sanitized: string | null;
    error: string | null;
  } {
    if (!dateString || typeof dateString !== "string") {
      return { sanitized: null, error: null };
    }

    const trimmed = dateString.trim();
    if (!trimmed) {
      return { sanitized: null, error: null };
    }

    // Validate date format (YYYY-MM-DD)
    if (!validator.isDate(trimmed, { format: "YYYY-MM-DD" })) {
      return {
        sanitized: null,
        error: "Please enter a valid date in YYYY-MM-DD format",
      };
    }

    const date = new Date(trimmed);
    const now = new Date();

    // Check if date is in the future
    if (date > now) {
      return { sanitized: null, error: "Birthday cannot be in the future" };
    }

    // Check if date is too far in the past (e.g., before 1900)
    const minDate = new Date("1900-01-01");
    if (date < minDate) {
      return { sanitized: null, error: "Birthday cannot be before 1900" };
    }

    return { sanitized: trimmed, error: null };
  }

  /**
   * Validate family ID on the client side
   */
  static validateFamilyId(familyId: string): {
    sanitized: string;
    error: string | null;
  } {
    if (!familyId || typeof familyId !== "string") {
      return { sanitized: "", error: "Family ID cannot be empty" };
    }

    const trimmed = familyId.trim();
    if (!trimmed) {
      return { sanitized: "", error: "Family ID cannot be empty" };
    }

    // Validate family ID format (alphanumeric with hyphens and underscores)
    if (!/^[a-zA-Z0-9\-_]+$/.test(trimmed)) {
      return {
        sanitized: trimmed,
        error:
          "Family ID can only contain letters, numbers, hyphens, and underscores",
      };
    }

    if (trimmed.length > 50) {
      return {
        sanitized: trimmed,
        error: "Family ID is too long (max 50 characters)",
      };
    }

    return { sanitized: trimmed, error: null };
  }

  /**
   * Real-time input sanitization for preventing XSS
   */
  static sanitizeInput(input: string): string {
    if (!input || typeof input !== "string") {
      return "";
    }

    // Remove any HTML tags and return plain text
    return DOMPurify.sanitize(input, { ALLOWED_TAGS: [] });
  }

  /**
   * Check if passwords match
   */
  static validatePasswordMatch(
    password: string,
    confirmPassword: string
  ): string | null {
    if (!confirmPassword) {
      return null; // Don't show error until user starts typing
    }

    if (password !== confirmPassword) {
      return "Passwords do not match";
    }

    return null;
  }
}

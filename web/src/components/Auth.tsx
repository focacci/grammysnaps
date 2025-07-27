import { useState, useEffect } from "react";
import "./Auth.css";
import authService from "../services/auth.service";
import { ClientValidationUtils } from "../utils/validation";
import { API_BASE_URL } from "../services/api.service";

interface AuthProps {
  onLogin: (user: any) => void;
  onCancel: () => void;
}

const Auth = ({ onLogin, onCancel }: AuthProps) => {
  const [isLogin, setIsLogin] = useState(true);

  // Lock body scroll when modal is open to prevent background scrolling
  useEffect(() => {
    // Store original body overflow style
    const originalStyle = document.body.style.overflow;
    // Prevent body scroll
    document.body.style.overflow = "hidden";

    // Handle Escape key to close modal
    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onCancel();
      }
    };

    // Add event listener
    document.addEventListener("keydown", handleEscapeKey);

    // Focus the first input field when modal opens
    const firstInput = document.querySelector(
      ".auth-form input"
    ) as HTMLInputElement;
    if (firstInput) {
      // Small delay to ensure the modal is fully rendered
      setTimeout(() => {
        firstInput.focus();
      }, 100);
    }

    // Cleanup: restore original overflow style and remove event listener when component unmounts
    return () => {
      document.body.style.overflow = originalStyle;
      document.removeEventListener("keydown", handleEscapeKey);
    };
  }, [onCancel, isLogin]); // Add isLogin to dependencies so focus is set correctly when switching modes

  // Basic auth fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // New user profile fields
  const [firstName, setFirstName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [lastName, setLastName] = useState("");
  const [birthday, setBirthday] = useState("");
  const [families, setFamilies] = useState<string[]>([]);
  const [familyInput, setFamilyInput] = useState("");

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [passwordMismatch, setPasswordMismatch] = useState(false);

  // Field-specific validation errors
  const [fieldErrors, setFieldErrors] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    firstName: "",
    lastName: "",
    birthday: "",
    familyInput: "",
  });

  // Check for password mismatch in real-time
  const checkPasswordMatch = (password: string, confirmPassword: string) => {
    const matchError = ClientValidationUtils.validatePasswordMatch(
      password,
      confirmPassword
    );
    setPasswordMismatch(!!matchError);
    setFieldErrors((prev) => ({ ...prev, confirmPassword: matchError || "" }));
  };

  // Validate email input
  const handleEmailChange = (value: string) => {
    // Sanitize input in real-time
    const sanitized = ClientValidationUtils.sanitizeInput(value);
    setEmail(sanitized);

    // Validate email format
    const { error } = ClientValidationUtils.sanitizeEmail(sanitized);
    setFieldErrors((prev) => ({ ...prev, email: error || "" }));
  };

  // Validate password input
  const handlePasswordChange = (value: string) => {
    setPassword(value);

    // Only validate password strength for signup
    if (!isLogin) {
      const { error } = ClientValidationUtils.validatePassword(value);
      setFieldErrors((prev) => ({ ...prev, password: error || "" }));
    }

    checkPasswordMatch(value, confirmPassword);
  };

  // Validate text fields
  const handleTextFieldChange = (
    value: string,
    fieldName: string,
    setter: (value: string) => void,
    required: boolean = false
  ) => {
    const sanitized = ClientValidationUtils.sanitizeInput(value);
    setter(sanitized);

    const { error } = ClientValidationUtils.sanitizeText(
      sanitized,
      fieldName,
      required,
      50
    );
    setFieldErrors((prev) => ({
      ...prev,
      [fieldName.toLowerCase().replace(/\s+/g, "")]: error || "",
    }));
  };

  // Validate birthday
  const handleBirthdayChange = (value: string) => {
    setBirthday(value);

    const { error } = ClientValidationUtils.validateDate(value);
    setFieldErrors((prev) => ({ ...prev, birthday: error || "" }));
  };

  // Add family ID to the list
  const addFamily = () => {
    const { sanitized, error } =
      ClientValidationUtils.validateFamilyId(familyInput);

    if (error) {
      setFieldErrors((prev) => ({ ...prev, familyInput: error }));
      return;
    }

    if (families.includes(sanitized)) {
      setFieldErrors((prev) => ({
        ...prev,
        familyInput: "Family ID already added",
      }));
      return;
    }

    setFamilies([...families, sanitized]);
    setFamilyInput("");
    setFieldErrors((prev) => ({ ...prev, familyInput: "" }));
  };

  // Remove family ID from the list
  const removeFamily = (familyId: string) => {
    setFamilies(families.filter((id) => id !== familyId));
  };

  // Clear all form fields
  const clearForm = () => {
    setEmail("");
    setPassword("");
    setConfirmPassword("");
    setFirstName("");
    setMiddleName("");
    setLastName("");
    setBirthday("");
    setFamilies([]);
    setFamilyInput("");
    setError("");
    setPasswordMismatch(false);
    setFieldErrors({
      email: "",
      password: "",
      confirmPassword: "",
      firstName: "",
      lastName: "",
      birthday: "",
      familyInput: "",
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // Client-side validation
      const emailValidation = ClientValidationUtils.sanitizeEmail(email);
      if (emailValidation.error) {
        setError(emailValidation.error);
        setLoading(false);
        return;
      }

      const passwordValidation =
        ClientValidationUtils.validatePassword(password);
      if (passwordValidation.error) {
        setError(passwordValidation.error);
        setLoading(false);
        return;
      }

      if (!isLogin) {
        // Additional signup validation
        if (password !== confirmPassword) {
          setError("Passwords don't match");
          setLoading(false);
          return;
        }

        const firstNameValidation = ClientValidationUtils.sanitizeText(
          firstName,
          "First name",
          true,
          50
        );
        if (firstNameValidation.error) {
          setError(firstNameValidation.error);
          setLoading(false);
          return;
        }

        const lastNameValidation = ClientValidationUtils.sanitizeText(
          lastName,
          "Last name",
          true,
          50
        );
        if (lastNameValidation.error) {
          setError(lastNameValidation.error);
          setLoading(false);
          return;
        }

        if (middleName) {
          const middleNameValidation = ClientValidationUtils.sanitizeText(
            middleName,
            "Middle name",
            false,
            50
          );
          if (middleNameValidation.error) {
            setError(middleNameValidation.error);
            setLoading(false);
            return;
          }
        }

        if (birthday) {
          const birthdayValidation =
            ClientValidationUtils.validateDate(birthday);
          if (birthdayValidation.error) {
            setError(birthdayValidation.error);
            setLoading(false);
            return;
          }
        }
      }

      const endpoint = isLogin ? "/user/login" : "/user";
      const body = isLogin
        ? { email: emailValidation.sanitized, password }
        : {
            email: emailValidation.sanitized,
            password,
            first_name: firstName.trim(),
            middle_name: middleName.trim() || undefined,
            last_name: lastName.trim(),
            birthday: birthday || undefined,
            families,
          };

      if (isLogin) {
        // Use auth service for login
        const user = await authService.login(
          emailValidation.sanitized,
          password
        );
        onLogin(user);
      } else {
        // For signup, use the regular API
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Authentication failed");
        }

        // For signup, we get the user directly
        onLogin(data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="auth-overlay"
      onClick={(e) => {
        // Close modal when clicking on the backdrop (overlay itself)
        if (e.target === e.currentTarget) {
          onCancel();
        }
      }}
    >
      <div className="auth-modal">
        <div className="auth-header">
          <h2>{isLogin ? "Welcome Back" : "Create Account"}</h2>
          <button className="auth-close" onClick={onCancel}>
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          {!isLogin && (
            <>
              <div className="form-group">
                <label htmlFor="firstName">First Name *</label>
                <input
                  type="text"
                  id="firstName"
                  value={firstName}
                  onChange={(e) =>
                    handleTextFieldChange(
                      e.target.value,
                      "First name",
                      setFirstName,
                      true
                    )
                  }
                  required
                  placeholder="Enter your first name"
                />
                {fieldErrors.firstName && (
                  <div className="field-error">{fieldErrors.firstName}</div>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="middleName">Middle Name</label>
                <input
                  type="text"
                  id="middleName"
                  value={middleName}
                  onChange={(e) =>
                    handleTextFieldChange(
                      e.target.value,
                      "Middle name",
                      setMiddleName,
                      false
                    )
                  }
                  placeholder="Enter your middle name (optional)"
                />
              </div>

              <div className="form-group">
                <label htmlFor="lastName">Last Name *</label>
                <input
                  type="text"
                  id="lastName"
                  value={lastName}
                  onChange={(e) =>
                    handleTextFieldChange(
                      e.target.value,
                      "Last name",
                      setLastName,
                      true
                    )
                  }
                  required
                  placeholder="Enter your last name"
                />
                {fieldErrors.lastName && (
                  <div className="field-error">{fieldErrors.lastName}</div>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="birthday">Birthday</label>
                <input
                  type="date"
                  id="birthday"
                  value={birthday}
                  onChange={(e) => handleBirthdayChange(e.target.value)}
                  placeholder="Select your birthday (optional)"
                />
                {fieldErrors.birthday && (
                  <div className="field-error">{fieldErrors.birthday}</div>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="families">Family IDs (Optional)</label>
                <div className="family-input-container">
                  <input
                    type="text"
                    id="familyInput"
                    value={familyInput}
                    onChange={(e) => {
                      const sanitized = ClientValidationUtils.sanitizeInput(
                        e.target.value
                      );
                      setFamilyInput(sanitized);
                      setFieldErrors((prev) => ({ ...prev, familyInput: "" }));
                    }}
                    placeholder="Enter a family ID"
                    onKeyPress={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addFamily();
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="add-family-btn"
                    onClick={addFamily}
                    disabled={!familyInput.trim()}
                  >
                    Add
                  </button>
                </div>
                {fieldErrors.familyInput && (
                  <div className="field-error">{fieldErrors.familyInput}</div>
                )}
                {families.length > 0 && (
                  <div className="family-list">
                    {families.map((familyId, index) => (
                      <div key={index} className="family-item">
                        <span>{familyId}</span>
                        <button
                          type="button"
                          className="remove-family-btn"
                          onClick={() => removeFamily(familyId)}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          <div className="form-group">
            <label htmlFor="email">Email *</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => handleEmailChange(e.target.value)}
              required
              placeholder="Enter your email"
            />
            {fieldErrors.email && (
              <div className="field-error">{fieldErrors.email}</div>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="password">Password *</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => handlePasswordChange(e.target.value)}
              required
              placeholder="Enter your password"
              minLength={isLogin ? undefined : 6}
            />
            {!isLogin && fieldErrors.password && (
              <div className="field-error">{fieldErrors.password}</div>
            )}
          </div>

          {!isLogin && (
            <div className="form-group">
              <label htmlFor="confirmPassword">Confirm Password *</label>
              <input
                type="password"
                id="confirmPassword"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  checkPasswordMatch(password, e.target.value);
                }}
                required
                placeholder="Confirm your password"
                minLength={6}
              />
              {fieldErrors.confirmPassword && (
                <div className="field-error">{fieldErrors.confirmPassword}</div>
              )}
            </div>
          )}

          {error && <div className="auth-error">{error}</div>}

          <button
            type="submit"
            className="auth-submit"
            disabled={loading || (!isLogin && passwordMismatch)}
          >
            {loading ? "..." : isLogin ? "Sign In" : "Create Account"}
          </button>
        </form>

        <div className="auth-switch">
          <p>
            {isLogin ? "Don't have an account?" : "Already have an account?"}{" "}
            <button
              type="button"
              className="auth-switch-btn"
              onClick={() => {
                setIsLogin(!isLogin);
                clearForm();
              }}
            >
              {isLogin ? "Sign up" : "Sign in"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Auth;

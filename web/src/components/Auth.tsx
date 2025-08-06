import { useState, useEffect } from "react";
import "./Auth.css";
import authService from "../services/auth.service";
import { ClientValidationUtils } from "../utils/validation";
import { getApiEndpoint } from "../services/api.service";
import { env } from "../utils/environment";

interface AuthProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onLogin: (user: any) => void;
  onCancel: () => void;
  initialMode?: "login" | "signup";
}

const Auth = ({ onLogin, onCancel, initialMode = "login" }: AuthProps) => {
  const [isLogin, setIsLogin] = useState(initialMode === "login");
  const [showProfileCompletion, setShowProfileCompletion] = useState(false);
  const [createdUser, setCreatedUser] = useState<{
    id: string;
    email: string;
    first_name: string | null;
    middle_name?: string | null;
    last_name: string | null;
    birthday?: string | null;
    families: string[];
    created_at: string;
    updated_at: string;
    profile_picture_url?: string | null;
  } | null>(null);

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
  }, [onCancel, isLogin, showProfileCompletion]); // Add showProfileCompletion to dependencies so focus is set correctly when switching modes

  // Basic auth fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [inviteKey, setInviteKey] = useState("");

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
    inviteKey: "",
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

    // Only validate if field has content or if it's required
    if (sanitized.trim() || required) {
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
    } else {
      // Clear error if field is empty and not required
      setFieldErrors((prev) => ({
        ...prev,
        [fieldName.toLowerCase().replace(/\s+/g, "")]: "",
      }));
    }
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
    setInviteKey("");
    setFirstName("");
    setMiddleName("");
    setLastName("");
    setBirthday("");
    setFamilies([]);
    setFamilyInput("");
    setError("");
    setPasswordMismatch(false);
    setShowProfileCompletion(false);
    setCreatedUser(null);
    setFieldErrors({
      email: "",
      password: "",
      confirmPassword: "",
      firstName: "",
      lastName: "",
      birthday: "",
      familyInput: "",
      inviteKey: "",
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

        // Check if invite key is required (development mode)
        if (env.isStaging() && !inviteKey.trim()) {
          setError(
            "An invite key is required to create an account in development mode"
          );
          setLoading(false);
          return;
        }

        // Prepare signup data
        const signupData: {
          email: string;
          password: string;
          invite_key?: string;
        } = {
          email: emailValidation.sanitized,
          password,
        };

        // Add invite key if in staging mode
        if (env.isStaging() && inviteKey.trim()) {
          signupData.invite_key = inviteKey.trim();
        }

        // First step of signup - create user with email and password only
        const response = await fetch(getApiEndpoint("/user"), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(signupData),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Authentication failed");
        }

        // After user creation, automatically log them in to get proper tokens
        const user = await authService.login(
          emailValidation.sanitized,
          password
        );

        // Store the created user and show profile completion modal
        setCreatedUser(user);
        setShowProfileCompletion(true);
      } else {
        // Login flow remains the same
        const user = await authService.login(
          emailValidation.sanitized,
          password
        );
        onLogin(user);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  // Handle profile completion (second step of signup)
  const handleProfileCompletion = async (skipProfile: boolean = false) => {
    if (!createdUser) return;

    setLoading(true);
    setError("");

    try {
      if (!skipProfile) {
        // Validate profile fields if not skipping
        if (firstName.trim()) {
          const firstNameValidation = ClientValidationUtils.sanitizeText(
            firstName,
            "First name",
            false,
            50
          );
          if (firstNameValidation.error) {
            setError(firstNameValidation.error);
            setLoading(false);
            return;
          }
        }

        if (lastName.trim()) {
          const lastNameValidation = ClientValidationUtils.sanitizeText(
            lastName,
            "Last name",
            false,
            50
          );
          if (lastNameValidation.error) {
            setError(lastNameValidation.error);
            setLoading(false);
            return;
          }
        }

        if (middleName.trim()) {
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

        if (birthday.trim()) {
          const birthdayValidation =
            ClientValidationUtils.validateDate(birthday);
          if (birthdayValidation.error) {
            setError(birthdayValidation.error);
            setLoading(false);
            return;
          }
        }

        // Update user profile
        const response = await authService.apiCall(
          getApiEndpoint(`/user/${createdUser.id}`),
          {
            method: "PUT",
            body: JSON.stringify({
              first_name: firstName.trim() || null,
              middle_name: middleName.trim() || null,
              last_name: lastName.trim() || null,
              birthday: birthday.trim() || null,
              families,
            }),
          }
        );

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Failed to update profile");
        }

        const updatedUser = await response.json();
        onLogin(updatedUser);
      } else {
        // Skip profile completion, just login with the created user
        onLogin(createdUser);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update profile");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-overlay">
      <div className="auth-modal">
        <div className="auth-header">
          <h2>
            {showProfileCompletion
              ? "Complete Your Profile"
              : isLogin
              ? "Welcome Back"
              : "Create Account"}
          </h2>
          <button
            className="auth-close"
            onClick={
              showProfileCompletion
                ? () => handleProfileCompletion(true)
                : onCancel
            }
          >
            ×
          </button>
        </div>

        {showProfileCompletion ? (
          // Profile completion form (second step of signup)
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleProfileCompletion(false);
            }}
            className="auth-form"
          >
            <div className="form-group">
              <label htmlFor="firstName">First Name</label>
              <input
                type="text"
                id="firstName"
                name="firstName"
                autoComplete="given-name"
                value={firstName}
                onChange={(e) =>
                  handleTextFieldChange(
                    e.target.value,
                    "First name",
                    setFirstName,
                    false
                  )
                }
                placeholder="Enter your first name (optional)"
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
                name="middleName"
                autoComplete="additional-name"
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
              <label htmlFor="lastName">Last Name</label>
              <input
                type="text"
                id="lastName"
                name="lastName"
                autoComplete="family-name"
                value={lastName}
                onChange={(e) =>
                  handleTextFieldChange(
                    e.target.value,
                    "Last name",
                    setLastName,
                    false
                  )
                }
                placeholder="Enter your last name (optional)"
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
                name="birthday"
                autoComplete="bday"
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
                  name="familyId"
                  autoComplete="off"
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

            {error && <div className="auth-error">{error}</div>}

            <div className="auth-button-group">
              <button
                type="button"
                className="auth-submit secondary"
                onClick={() => handleProfileCompletion(true)}
                disabled={loading}
              >
                {loading ? "..." : "Skip"}
              </button>
              <button
                type="submit"
                className="auth-submit primary"
                disabled={loading}
              >
                {loading ? "..." : "Save"}
              </button>
            </div>
          </form>
        ) : (
          // Login/Signup form (first step)
          <form onSubmit={handleSubmit} className="auth-form">
            <div className="form-group">
              <label htmlFor="email">Email</label>
              <input
                type="email"
                id="email"
                name="email"
                autoComplete="email"
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
              <label htmlFor="password">Password</label>
              <input
                type="password"
                id="password"
                name="password"
                autoComplete={isLogin ? "current-password" : "new-password"}
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
                <label htmlFor="confirmPassword">Confirm Password</label>
                <input
                  type="password"
                  id="confirmPassword"
                  name="confirmPassword"
                  autoComplete="new-password"
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
                  <div className="field-error">
                    {fieldErrors.confirmPassword}
                  </div>
                )}
              </div>
            )}

            {!isLogin && env.isStaging() && (
              <div className="form-group">
                <label htmlFor="inviteKey">Invite Key</label>
                <input
                  type="text"
                  id="inviteKey"
                  name="inviteKey"
                  autoComplete="off"
                  value={inviteKey}
                  onChange={(e) => {
                    setInviteKey(e.target.value.trim());
                    setFieldErrors((prev) => ({ ...prev, inviteKey: "" }));
                  }}
                  required
                  placeholder="Enter the invite key Michael gave you"
                />
                {fieldErrors.inviteKey && (
                  <div className="field-error">{fieldErrors.inviteKey}</div>
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
        )}

        {!showProfileCompletion && (
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
        )}
      </div>
    </div>
  );
};

export default Auth;

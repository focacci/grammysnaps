import { useState } from "react";
import "./Auth.css";
import authService from "../services/auth.service";

interface AuthProps {
  onLogin: (user: any) => void;
  onCancel: () => void;
}

const Auth = ({ onLogin, onCancel }: AuthProps) => {
  const [isLogin, setIsLogin] = useState(true);

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

  // Check for password mismatch in real-time
  const checkPasswordMatch = (password: string, confirmPassword: string) => {
    if (!isLogin && confirmPassword && password !== confirmPassword) {
      setPasswordMismatch(true);
    } else {
      setPasswordMismatch(false);
    }
  };

  // Add family ID to the list
  const addFamily = () => {
    if (familyInput.trim() && !families.includes(familyInput.trim())) {
      setFamilies([...families, familyInput.trim()]);
      setFamilyInput("");
    }
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
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (!isLogin) {
        // Sign up validation
        if (password !== confirmPassword) {
          setError("Passwords don't match");
          setLoading(false);
          return;
        }
        if (password.length < 6) {
          setError("Password must be at least 6 characters");
          setLoading(false);
          return;
        }
        if (!firstName.trim()) {
          setError("First name is required");
          setLoading(false);
          return;
        }
        if (!lastName.trim()) {
          setError("Last name is required");
          setLoading(false);
          return;
        }
      }

      const endpoint = isLogin ? "/user/login" : "/user";
      const body = isLogin
        ? { email, password }
        : {
            email,
            password,
            first_name: firstName.trim(),
            middle_name: middleName.trim() || undefined,
            last_name: lastName.trim(),
            birthday: birthday || undefined,
            families,
          };

      if (isLogin) {
        // Use auth service for login
        const user = await authService.login(email, password);
        onLogin(user);
      } else {
        // For signup, use the regular API
        const response = await fetch(`http://localhost:3000${endpoint}`, {
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
    <div className="auth-overlay">
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
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                  placeholder="Enter your first name"
                />
              </div>

              <div className="form-group">
                <label htmlFor="middleName">Middle Name</label>
                <input
                  type="text"
                  id="middleName"
                  value={middleName}
                  onChange={(e) => setMiddleName(e.target.value)}
                  placeholder="Enter your middle name (optional)"
                />
              </div>

              <div className="form-group">
                <label htmlFor="lastName">Last Name *</label>
                <input
                  type="text"
                  id="lastName"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                  placeholder="Enter your last name"
                />
              </div>

              <div className="form-group">
                <label htmlFor="birthday">Birthday</label>
                <input
                  type="date"
                  id="birthday"
                  value={birthday}
                  onChange={(e) => setBirthday(e.target.value)}
                  placeholder="Select your birthday (optional)"
                />
              </div>

              <div className="form-group">
                <label htmlFor="families">Family IDs (Optional)</label>
                <div className="family-input-container">
                  <input
                    type="text"
                    id="familyInput"
                    value={familyInput}
                    onChange={(e) => setFamilyInput(e.target.value)}
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
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="Enter your email"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password *</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                checkPasswordMatch(e.target.value, confirmPassword);
              }}
              required
              placeholder="Enter your password"
              minLength={isLogin ? undefined : 6}
            />
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
              {passwordMismatch && (
                <div className="password-mismatch-error">
                  Passwords don't match
                </div>
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

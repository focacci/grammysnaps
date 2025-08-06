/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useRef } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useNavigate,
  useLocation,
} from "react-router-dom";
import "./App.css";
import PhotoView from "./components/PhotoView";
import Account from "./components/Account";
import Auth from "./components/Auth";
import authService from "./services/auth.service";
import { env } from "./utils/environment";

// Protected Route component
const ProtectedRoute = ({
  children,
  user,
  isLoadingAuth,
}: {
  children: React.ReactNode;
  user: any;
  isLoadingAuth: boolean;
}) => {
  if (isLoadingAuth) {
    return <div className="loading-state">Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
};

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

// Main App Content (moved inside Router)
function AppContent() {
  const navigate = useNavigate();
  const location = useLocation();
  const [darkMode, setDarkMode] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [showAuth, setShowAuth] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Check for system preference and saved preference on mount
  useEffect(() => {
    // Log environment configuration in development
    env.logConfig();

    const savedTheme = localStorage.getItem("theme");
    const systemPrefersDark = window.matchMedia(
      "(prefers-color-scheme: dark)"
    ).matches;

    if (savedTheme) {
      setDarkMode(savedTheme === "dark");
    } else {
      setDarkMode(systemPrefersDark);
    }

    // Validate current session on mount
    const validateSession = async () => {
      try {
        const sessionUser = await authService.validateSession();
        if (sessionUser) {
          setUser(sessionUser);
        } else {
          setUser(null);
        }
      } catch (error) {
        console.error("Session validation failed:", error);
        setUser(null);
      } finally {
        setIsLoadingAuth(false);
      }
    };

    validateSession();
  }, []);

  // Handle redirect logic separately when user state changes
  useEffect(() => {
    // Only redirect to photo-view if user just logged in and is on the root path
    if (user && location.pathname === "/") {
      navigate("/photo-view", { replace: true });
    }
  }, [user, location.pathname, navigate]);

  // Apply theme to document
  useEffect(() => {
    document.documentElement.setAttribute(
      "data-theme",
      darkMode ? "dark" : "light"
    );
    localStorage.setItem("theme", darkMode ? "dark" : "light");
  }, [darkMode]);

  // Handle clicks outside dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
  };

  const toggleDropdown = () => {
    setDropdownOpen(!dropdownOpen);
  };

  const handleLogin = (userData: any) => {
    setUser(userData);
    setShowAuth(false);
    navigate("/photo-view");
  };

  const handleLogout = async () => {
    try {
      await authService.logout();
    } catch (error) {
      console.error("Logout failed:", error);
    }
    setUser(null);
    navigate("/");
    setDropdownOpen(false);
  };

  const handleGetStarted = () => {
    setAuthMode("signup");
    setShowAuth(true);
  };

  return (
    <div className="app">
      <nav className="navbar">
        <div className="navbar-left">
          <div
            className="logo"
            onClick={() => navigate(user ? "/photo-view" : "/")}
          >
            Grammysnaps
          </div>
        </div>
        <div className="navbar-center">
          {/* Photos tab removed - users go directly to photos when logged in */}
        </div>
        <div className="navbar-right">
          {user ? (
            <div className="profile-dropdown" ref={dropdownRef}>
              <button
                className="profile-icon"
                onClick={toggleDropdown}
                aria-label="Profile menu"
              >
                {user.profile_picture_thumbnail_url ? (
                  <img
                    src={user.profile_picture_thumbnail_url}
                    alt="Profile"
                    className="profile-avatar"
                  />
                ) : (
                  <span className="profile-avatar-icon">👤</span>
                )}
              </button>
              {dropdownOpen && (
                <div className="dropdown-menu">
                  <button
                    className="dropdown-item"
                    onClick={() => {
                      navigate("/account");
                      setDropdownOpen(false);
                    }}
                  >
                    Account
                  </button>
                  <button className="dropdown-item" onClick={handleLogout}>
                    Log Out
                  </button>
                  <div className="dropdown-toggle-container">
                    <span className="toggle-label">
                      {darkMode ? "Dark Mode" : "Light Mode"}
                    </span>
                    <button
                      className={`theme-toggle ${darkMode ? "active" : ""}`}
                      onClick={toggleDarkMode}
                      aria-label={`Switch to ${
                        darkMode ? "light" : "dark"
                      } mode`}
                    >
                      <span className="toggle-slider">
                        <span className="toggle-icon">
                          {darkMode ? "🌙" : "☀️"}
                        </span>
                      </span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <button
              className="nav-button"
              onClick={() => {
                setAuthMode("login");
                setShowAuth(true);
              }}
            >
              Sign In
            </button>
          )}
        </div>
      </nav>
      <main className="main-content">
        {" "}
        <Routes>
          <Route
            path="/"
            element={
              isLoadingAuth ? (
                <div className="loading-state">Loading...</div>
              ) : user ? (
                <Navigate to="/photo-view" replace />
              ) : (
                <div className="home-view">
                  <div className="home-content">
                    <h1>Welcome to Grammysnaps</h1>
                    <p>Your family photo sharing app</p>
                    <button
                      onClick={handleGetStarted}
                      className="get-started-btn"
                    >
                      Get Started
                    </button>
                  </div>
                </div>
              )
            }
          />
          <Route
            path="/photo-view"
            element={
              <ProtectedRoute user={user} isLoadingAuth={isLoadingAuth}>
                <PhotoView user={user} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/account"
            element={
              <ProtectedRoute user={user} isLoadingAuth={isLoadingAuth}>
                <Account user={user} onUserUpdate={handleLogin} />
              </ProtectedRoute>
            }
          />
        </Routes>
      </main>
      {showAuth && (
        <Auth
          onLogin={handleLogin}
          onCancel={() => {
            setShowAuth(false);
            setAuthMode("login");
          }}
          initialMode={authMode}
        />
      )}
    </div>
  );
}

export default App;

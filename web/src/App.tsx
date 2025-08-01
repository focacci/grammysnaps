/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useRef } from "react";
import "./App.css";
import PhotoView from "./components/PhotoView";
import Account from "./components/Account";
import Auth from "./components/Auth";
import authService from "./services/auth.service";

function App() {
  const [currentView, setCurrentView] = useState<"home" | "photos" | "account">(
    "home"
  );
  const [darkMode, setDarkMode] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [showAuth, setShowAuth] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Check for system preference and saved preference on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem("theme");
    const systemPrefersDark = window.matchMedia(
      "(prefers-color-scheme: dark)"
    ).matches;

    if (savedTheme) {
      setDarkMode(savedTheme === "dark");
    } else {
      setDarkMode(systemPrefersDark);
    }

    // Validate current session
    const validateSession = async () => {
      try {
        const sessionUser = await authService.validateSession();
        if (sessionUser) {
          setUser(sessionUser);
          // If user is logged in, go directly to photos
          setCurrentView("photos");
        } else {
          setUser(null);
        }
      } catch (error) {
        console.error("Session validation failed:", error);
        setUser(null);
      }
    };

    validateSession();
  }, []);

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
    setCurrentView("photos");
  };

  const handleLogout = async () => {
    try {
      await authService.logout();
    } catch (error) {
      console.error("Logout failed:", error);
    }
    setUser(null);
    setCurrentView("home");
    setDropdownOpen(false);
  };

  const handleGetStarted = () => {
    setShowAuth(true);
  };

  const handleUserUpdate = (updatedUser: any) => {
    setUser(updatedUser);
  };

  const renderCurrentView = () => {
    switch (currentView) {
      case "photos":
        if (!user) {
          setShowAuth(true);
          setCurrentView("home");
          return null;
        }
        return <PhotoView user={user} />;
      case "account":
        if (!user) {
          setShowAuth(true);
          setCurrentView("home");
          return null;
        }
        return <Account user={user} onUserUpdate={handleUserUpdate} />;
      case "home":
      default:
        // If user is logged in and somehow on home, redirect to photos
        if (user) {
          setCurrentView("photos");
          return <PhotoView user={user} />;
        }
        return (
          <div className="home-view">
            <div className="home-content">
              <h1>Welcome to Grammysnaps</h1>
              <p>Your family photo management system</p>
              <button className="get-started-btn" onClick={handleGetStarted}>
                Get Started
              </button>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="app">
      <nav className="navbar">
        <div className="navbar-left">
          <div
            className="logo"
            onClick={() => setCurrentView(user ? "photos" : "home")}
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
                {user.profile_picture_url ? (
                  <img
                    src={user.profile_picture_url}
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
                      setCurrentView("account");
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
            <button className="nav-button" onClick={handleGetStarted}>
              Sign In
            </button>
          )}
        </div>
      </nav>
      <main className="main-content">{renderCurrentView()}</main>
      {showAuth && (
        <Auth onLogin={handleLogin} onCancel={() => setShowAuth(false)} />
      )}
    </div>
  );
}

export default App;

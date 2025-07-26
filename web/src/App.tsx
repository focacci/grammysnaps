import { useState, useEffect, useRef } from "react";
import "./App.css";
import PhotoView from "./components/PhotoView";
import Account from "./components/Account";
import Auth from "./components/Auth";

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

    // Check for saved user
    const savedUser = localStorage.getItem("user");
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch (error) {
        localStorage.removeItem("user");
      }
    }
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

  const getFullName = (user: any) => {
    if (!user) return "";
    const parts = [user.first_name, user.middle_name, user.last_name].filter(
      Boolean
    );
    return parts.join(" ");
  };

  const handleLogin = (userData: any) => {
    setUser(userData);
    localStorage.setItem("user", JSON.stringify(userData));
    setShowAuth(false);
    setCurrentView("photos");
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem("user");
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
        return <PhotoView />;
      case "account":
        if (!user) {
          setShowAuth(true);
          setCurrentView("home");
          return null;
        }
        return <Account user={user} onUserUpdate={handleUserUpdate} />;
      case "home":
      default:
        return (
          <div className="home-view">
            <div className="home-content">
              <h1>Welcome to Grammysnaps</h1>
              <p>Your family photo management system</p>
              {user ? (
                <div>
                  <p>Welcome back, {getFullName(user)}!</p>
                  <button
                    className="get-started-btn"
                    onClick={() => setCurrentView("photos")}
                  >
                    View Photos
                  </button>
                </div>
              ) : (
                <button className="get-started-btn" onClick={handleGetStarted}>
                  Get Started
                </button>
              )}
            </div>
          </div>
        );
    }
  };

  return (
    <div className="app">
      <nav className="navbar">
        <div className="navbar-left">
          <div className="logo" onClick={() => setCurrentView("home")}>
            Grammysnaps
          </div>
        </div>
        <div className="navbar-center">
          {user && (
            <button
              className={`nav-button ${
                currentView === "photos" ? "active" : ""
              }`}
              onClick={() => setCurrentView("photos")}
            >
              Photos
            </button>
          )}
        </div>
        <div className="navbar-right">
          {user ? (
            <div className="profile-dropdown" ref={dropdownRef}>
              <button
                className="profile-icon"
                onClick={toggleDropdown}
                aria-label="Profile menu"
              >
                <span>👤</span>
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
                  <button className="dropdown-item" onClick={toggleDarkMode}>
                    {darkMode ? "☀️ Light Mode" : "🌙 Dark Mode"}
                  </button>
                  <button className="dropdown-item" onClick={handleLogout}>
                    Sign Out
                  </button>
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

import { useState, useEffect, useRef } from "react";
import "./App.css";
import PhotoView from "./components/PhotoView";

function App() {
  const [currentView, setCurrentView] = useState<"home" | "photos">("home");
  const [darkMode, setDarkMode] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
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

  const renderCurrentView = () => {
    switch (currentView) {
      case "photos":
        return <PhotoView />;
      case "home":
      default:
        return (
          <div className="home-view">
            <div className="home-content">
              <h1>Welcome to Grammy Snaps</h1>
              <p>Your family photo management system</p>
              <button
                className="get-started-btn"
                onClick={() => setCurrentView("photos")}
              >
                View Photos
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
          <div className="logo" onClick={() => setCurrentView("home")}>
            Grammysnaps
          </div>
        </div>
        <div className="navbar-center">
          <button
            className={`nav-button ${currentView === "photos" ? "active" : ""}`}
            onClick={() => setCurrentView("photos")}
          >
            Photos
          </button>
        </div>
        <div className="navbar-right">
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
                  onClick={() => console.log("Account clicked")}
                >
                  Account
                </button>
                <button className="dropdown-item" onClick={toggleDarkMode}>
                  {darkMode ? "☀️ Light Mode" : "🌙 Dark Mode"}
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>
      <main className="main-content">{renderCurrentView()}</main>
    </div>
  );
}

export default App;

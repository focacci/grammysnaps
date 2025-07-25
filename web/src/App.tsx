import { useState } from "react";
import "./App.css";
import PhotoView from "./components/PhotoView";

function App() {
  const [currentView, setCurrentView] = useState<"home" | "photos">("home");

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
          <div className="profile-icon">
            <span>👨‍💼</span>
          </div>
        </div>
      </nav>
      <main className="main-content">{renderCurrentView()}</main>
    </div>
  );
}

export default App;

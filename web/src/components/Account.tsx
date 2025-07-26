import { useState } from "react";
import "./Account.css";

// Type definitions
interface User {
  id: string;
  name: string;
  email: string;
  profilePicture?: string;
}

interface FamilyGroup {
  id: string;
  name: string;
  role: "admin" | "member";
  memberCount: number;
  created_at: string;
}

function Account() {
  const [collapsedSections, setCollapsedSections] = useState<{
    [key: string]: boolean;
  }>({
    familyGroups: false,
  });

  // Mock data - replace with actual API calls later
  const user: User = {
    id: "1",
    name: "John Doe",
    email: "john.doe@example.com",
    profilePicture: undefined, // Will show default avatar
  };

  const familyGroups: FamilyGroup[] = [
    {
      id: "1",
      name: "The Doe Family",
      role: "admin",
      memberCount: 5,
      created_at: "2023-01-15T10:30:00Z",
    },
    {
      id: "2",
      name: "Smith Relatives",
      role: "member",
      memberCount: 12,
      created_at: "2023-06-20T14:45:00Z",
    },
    {
      id: "3",
      name: "College Friends",
      role: "member",
      memberCount: 8,
      created_at: "2023-09-10T09:15:00Z",
    },
  ];

  const toggleSection = (sectionName: string) => {
    setCollapsedSections((prev) => ({
      ...prev,
      [sectionName]: !prev[sectionName],
    }));
  };

  const getRoleBadge = (role: "admin" | "member") => {
    return (
      <span className={`role-badge ${role}`}>
        {role === "admin" ? "👑 Admin" : "👤 Member"}
      </span>
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <div className="account-view">
      <div className="account-container">
        {/* Profile Section */}
        <div className="profile-section">
          <div className="profile-picture-container">
            {user.profilePicture ? (
              <img
                src={user.profilePicture}
                alt={`${user.name}'s profile`}
                className="profile-picture"
              />
            ) : (
              <div className="profile-picture-placeholder">
                <span className="profile-avatar-icon">👤</span>
              </div>
            )}
          </div>
          <div className="user-info">
            <h1 className="user-name">{user.name}</h1>
            <p className="user-email">{user.email}</p>
          </div>
        </div>

        {/* Family Groups Section */}
        <div className="account-section">
          <button
            className="section-header"
            onClick={() => toggleSection("familyGroups")}
            aria-expanded={!collapsedSections.familyGroups}
          >
            <span
              className={`section-caret ${
                collapsedSections.familyGroups ? "collapsed" : ""
              }`}
            >
              ▼
            </span>
            <span className="section-title">Family Groups</span>
            <span className="section-count">({familyGroups.length})</span>
          </button>

          {!collapsedSections.familyGroups && (
            <div className="section-content">
              {familyGroups.length === 0 ? (
                <div className="empty-state">
                  <p>You're not a member of any family groups yet.</p>
                  <button className="create-family-btn">
                    + Create Family Group
                  </button>
                </div>
              ) : (
                <div className="family-groups-list">
                  {familyGroups.map((family) => (
                    <div key={family.id} className="family-group-card">
                      <div className="family-group-header">
                        <h3 className="family-group-name">{family.name}</h3>
                        {getRoleBadge(family.role)}
                      </div>
                      <div className="family-group-details">
                        <div className="family-group-info">
                          <span className="member-count">
                            👥 {family.memberCount} members
                          </span>
                          <span className="created-date">
                            📅 Created {formatDate(family.created_at)}
                          </span>
                        </div>
                        <div className="family-group-actions">
                          <button className="action-btn view-btn">
                            View Photos
                          </button>
                          {family.role === "admin" && (
                            <button className="action-btn manage-btn">
                              Manage
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="section-footer">
                <button className="join-family-btn">+ Join Family Group</button>
              </div>
            </div>
          )}
        </div>

        {/* Account Settings Section */}
        <div className="account-section">
          <h2 className="section-title-static">Account Settings</h2>
          <div className="section-content">
            <div className="settings-grid">
              <button className="setting-item">
                <span className="setting-icon">✏️</span>
                <span className="setting-label">Edit Profile</span>
                <span className="setting-arrow">→</span>
              </button>
              <button className="setting-item">
                <span className="setting-icon">🔒</span>
                <span className="setting-label">Privacy Settings</span>
                <span className="setting-arrow">→</span>
              </button>
              <button className="setting-item">
                <span className="setting-icon">🔔</span>
                <span className="setting-label">Notifications</span>
                <span className="setting-arrow">→</span>
              </button>
              <button className="setting-item">
                <span className="setting-icon">📱</span>
                <span className="setting-label">Connected Devices</span>
                <span className="setting-arrow">→</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Account;

import { useState, useEffect } from "react";
import "./Account.css";

// Type definitions
interface User {
  id: string;
  email: string;
  first_name: string;
  middle_name?: string;
  last_name: string;
  birthday?: string;
  families: string[];
  created_at: string;
  updated_at: string;
  profilePicture?: string;
}

interface FamilyGroup {
  id: string;
  name: string;
  member_count: number;
  owner_id: string;
  user_role: "owner" | "member";
  created_at: string;
  updated_at: string;
}

interface AccountProps {
  user: User;
  onUserUpdate: (updatedUser: User) => void;
}

function Account({ user, onUserUpdate }: AccountProps) {
  const [collapsedSections, setCollapsedSections] = useState<{
    [key: string]: boolean;
  }>({
    familyGroups: false,
  });

  // Family state
  const [familyGroups, setFamilyGroups] = useState<FamilyGroup[]>([]);
  const [loadingFamilies, setLoadingFamilies] = useState(true);

  // Edit Profile Modal State
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({
    first_name: user.first_name,
    middle_name: user.middle_name || "",
    last_name: user.last_name,
    birthday: user.birthday || "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Create Family Modal State
  const [showCreateFamilyModal, setShowCreateFamilyModal] = useState(false);
  const [createFamilyForm, setCreateFamilyForm] = useState({
    name: "",
    description: "",
  });
  const [createFamilyLoading, setCreateFamilyLoading] = useState(false);
  const [createFamilyError, setCreateFamilyError] = useState("");

  // Load user's families on component mount
  useEffect(() => {
    loadUserFamilies();
  }, [user.id]);

  const loadUserFamilies = async () => {
    try {
      setLoadingFamilies(true);
      const response = await fetch(
        `http://localhost:3000/user/${user.id}/families`
      );
      if (response.ok) {
        const families = await response.json();
        setFamilyGroups(families);
      } else {
        console.error("Failed to fetch families");
      }
    } catch (error) {
      console.error("Error fetching families:", error);
    } finally {
      setLoadingFamilies(false);
    }
  };

  const toggleSection = (sectionName: string) => {
    setCollapsedSections((prev) => ({
      ...prev,
      [sectionName]: !prev[sectionName],
    }));
  };

  const getRoleBadge = (role: "owner" | "member") => {
    return (
      <span className={`role-badge ${role}`}>
        {role === "owner" ? "👑 Owner" : "👤 Member"}
      </span>
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const formatBirthday = (birthday?: string) => {
    if (!birthday) return null;

    try {
      // Parse YYYY-MM-DD format safely
      const [year, month, day] = birthday.split("-").map(Number);

      // Validate date components
      if (
        isNaN(year) ||
        isNaN(month) ||
        isNaN(day) ||
        month < 1 ||
        month > 12 ||
        day < 1 ||
        day > 31
      ) {
        console.error("Invalid birthday format:", birthday);
        return null;
      }

      // Create date using local timezone (month is 0-indexed in Date constructor)
      const date = new Date(year, month - 1, day);

      // Verify the date is valid
      if (isNaN(date.getTime())) {
        console.error("Invalid date created:", birthday);
        return null;
      }

      // Format using toLocaleDateString for consistent display
      return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    } catch (error) {
      console.error("Error formatting birthday:", error, "Input:", birthday);
      return null;
    }
  };

  const getFullName = (user: User) => {
    const parts = [user.first_name, user.middle_name, user.last_name].filter(
      Boolean
    );
    return parts.join(" ");
  };

  // Create Family Handlers
  const handleCreateFamily = () => {
    setShowCreateFamilyModal(true);
    setCreateFamilyForm({ name: "", description: "" });
    setCreateFamilyError("");
  };

  const handleCreateFamilySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateFamilyError("");
    setCreateFamilyLoading(true);

    try {
      const response = await fetch("http://localhost:3000/family", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: createFamilyForm.name.trim(),
          owner_id: user.id,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create family");
      }

      // Reload families to show the new one
      await loadUserFamilies();

      // Close modal
      setShowCreateFamilyModal(false);
    } catch (err) {
      setCreateFamilyError(
        err instanceof Error ? err.message : "Failed to create family"
      );
    } finally {
      setCreateFamilyLoading(false);
    }
  };

  const handleCloseCreateFamilyModal = () => {
    setShowCreateFamilyModal(false);
    setCreateFamilyError("");
  };

  // Edit Profile Handlers
  const handleEditProfile = () => {
    setShowEditModal(true);
    setEditForm({
      first_name: user.first_name,
      middle_name: user.middle_name || "",
      last_name: user.last_name,
      birthday: user.birthday || "",
    });
    setError("");
  };

  const handleEditFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch(`http://localhost:3000/user/${user.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          first_name: editForm.first_name.trim(),
          middle_name: editForm.middle_name.trim() || undefined,
          last_name: editForm.last_name.trim(),
          birthday: editForm.birthday || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to update profile");
      }

      // Update local storage
      localStorage.setItem("user", JSON.stringify(data));

      // Update parent component's user data
      onUserUpdate(data);

      // Close modal
      setShowEditModal(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update profile");
    } finally {
      setLoading(false);
    }
  };

  const handleCloseEditModal = () => {
    setShowEditModal(false);
    setError("");
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
                alt={`${getFullName(user)}'s profile`}
                className="profile-picture"
              />
            ) : (
              <div className="profile-picture-placeholder">
                <span className="profile-avatar-icon">👤</span>
              </div>
            )}
          </div>
          <div className="user-info">
            <h1 className="user-name">{getFullName(user)}</h1>
            <p className="user-email">{user.email}</p>
            {user.birthday && formatBirthday(user.birthday) && (
              <p className="user-birthday">
                🎂 Born {formatBirthday(user.birthday)}
              </p>
            )}
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
              {loadingFamilies ? (
                <div className="loading-state">
                  <p>Loading family groups...</p>
                </div>
              ) : familyGroups.length === 0 ? (
                <div className="empty-state">
                  <p>You're not a member of any family groups yet.</p>
                  <button
                    className="create-family-btn"
                    onClick={handleCreateFamily}
                  >
                    + Create Family Group
                  </button>
                </div>
              ) : (
                <div className="family-groups-list">
                  {familyGroups.map((family) => (
                    <div key={family.id} className="family-group-card">
                      <div className="family-group-header">
                        <h3 className="family-group-name">{family.name}</h3>
                        {getRoleBadge(family.user_role)}
                      </div>
                      <div className="family-group-details">
                        <div className="family-group-info">
                          <span className="member-count">
                            👥 {family.member_count} members
                          </span>
                          <span className="created-date">
                            📅 Created {formatDate(family.created_at)}
                          </span>
                        </div>
                        <div className="family-group-actions">
                          <button className="action-btn view-btn">
                            View Photos
                          </button>
                          {family.user_role === "owner" && (
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
                <button
                  className="create-family-btn-footer"
                  onClick={handleCreateFamily}
                >
                  + Create Family Group
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Account Settings Section */}
        <div className="account-section">
          <h2 className="section-title-static">Account Settings</h2>
          <div className="section-content">
            <div className="settings-grid">
              <button className="setting-item" onClick={handleEditProfile}>
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

      {/* Create Family Modal */}
      {showCreateFamilyModal && (
        <div className="auth-overlay">
          <div className="auth-modal">
            <div className="auth-header">
              <h2>Create Family Group</h2>
              <button
                className="auth-close"
                onClick={handleCloseCreateFamilyModal}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleCreateFamilySubmit} className="auth-form">
              <div className="form-group">
                <label htmlFor="familyName">Family Name *</label>
                <input
                  type="text"
                  id="familyName"
                  value={createFamilyForm.name}
                  onChange={(e) =>
                    setCreateFamilyForm({
                      ...createFamilyForm,
                      name: e.target.value,
                    })
                  }
                  required
                  placeholder="Enter your family group name"
                />
              </div>

              {createFamilyError && (
                <div className="auth-error">{createFamilyError}</div>
              )}

              <button
                type="submit"
                className="auth-submit"
                disabled={createFamilyLoading}
              >
                {createFamilyLoading ? "Creating..." : "Create Family Group"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Edit Profile Modal */}
      {showEditModal && (
        <div className="auth-overlay">
          <div className="auth-modal">
            <div className="auth-header">
              <h2>Edit Profile</h2>
              <button className="auth-close" onClick={handleCloseEditModal}>
                ×
              </button>
            </div>

            <form onSubmit={handleEditFormSubmit} className="auth-form">
              <div className="form-group">
                <label htmlFor="editFirstName">First Name *</label>
                <input
                  type="text"
                  id="editFirstName"
                  value={editForm.first_name}
                  onChange={(e) =>
                    setEditForm({ ...editForm, first_name: e.target.value })
                  }
                  required
                  placeholder="Enter your first name"
                />
              </div>

              <div className="form-group">
                <label htmlFor="editMiddleName">Middle Name</label>
                <input
                  type="text"
                  id="editMiddleName"
                  value={editForm.middle_name}
                  onChange={(e) =>
                    setEditForm({ ...editForm, middle_name: e.target.value })
                  }
                  placeholder="Enter your middle name (optional)"
                />
              </div>

              <div className="form-group">
                <label htmlFor="editLastName">Last Name *</label>
                <input
                  type="text"
                  id="editLastName"
                  value={editForm.last_name}
                  onChange={(e) =>
                    setEditForm({ ...editForm, last_name: e.target.value })
                  }
                  required
                  placeholder="Enter your last name"
                />
              </div>

              <div className="form-group">
                <label htmlFor="editBirthday">Birthday</label>
                <input
                  type="date"
                  id="editBirthday"
                  value={editForm.birthday}
                  onChange={(e) =>
                    setEditForm({ ...editForm, birthday: e.target.value })
                  }
                  placeholder="Select your birthday (optional)"
                />
              </div>

              {error && <div className="auth-error">{error}</div>}

              <button type="submit" className="auth-submit" disabled={loading}>
                {loading ? "Updating..." : "Update Profile"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Account;

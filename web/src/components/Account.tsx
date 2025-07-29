import { useState, useEffect } from "react";
import "./Account.css";
import authService from "../services/auth.service";
import { API_BASE_URL } from "../services/api.service";

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
  related_families: string[];
  created_at: string;
  updated_at: string;
}

interface FamilyMember {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  birthday?: string;
  role: "owner" | "member";
  joined_at: string;
}

interface RelatedFamily {
  id: string;
  name: string;
  member_count: number;
  created_at: string;
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

  // Join Family Modal State
  const [showJoinFamilyModal, setShowJoinFamilyModal] = useState(false);
  const [joinFamilyId, setJoinFamilyId] = useState("");
  const [joinFamilyInfo, setJoinFamilyInfo] = useState<FamilyGroup | null>(
    null
  );
  const [loadingJoinFamilyInfo, setLoadingJoinFamilyInfo] = useState(false);
  const [joinFamilyLoading, setJoinFamilyLoading] = useState(false);
  const [joinFamilyError, setJoinFamilyError] = useState("");

  // Manage Family Modal State
  const [showManageFamilyModal, setShowManageFamilyModal] = useState(false);
  const [selectedFamily, setSelectedFamily] = useState<FamilyGroup | null>(
    null
  );
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [addMemberEmail, setAddMemberEmail] = useState("");
  const [addMemberLoading, setAddMemberLoading] = useState(false);
  const [manageFamilyError, setManageFamilyError] = useState("");

  // Related Families State
  const [relatedFamilies, setRelatedFamilies] = useState<RelatedFamily[]>([]);
  const [loadingRelatedFamilies, setLoadingRelatedFamilies] = useState(false);
  const [addRelatedFamilyId, setAddRelatedFamilyId] = useState("");
  const [addRelatedFamilyLoading, setAddRelatedFamilyLoading] = useState(false);
  const [relatedFamilyError, setRelatedFamilyError] = useState("");

  // Delete Family State
  const [deleteFamilyLoading, setDeleteFamilyLoading] = useState(false);

  // Copy Feedback State
  const [copiedFamilyId, setCopiedFamilyId] = useState<string | null>(null);

  // Leave Family State
  const [leaveFamilyLoading, setLeaveFamilyLoading] = useState<string | null>(
    null
  );

  // View Members Modal State
  const [showViewMembersModal, setShowViewMembersModal] = useState(false);
  const [viewMembersFamily, setViewMembersFamily] =
    useState<FamilyGroup | null>(null);
  const [viewMembersList, setViewMembersList] = useState<FamilyMember[]>([]);
  const [loadingViewMembers, setLoadingViewMembers] = useState(false);

  // Security Modal State
  const [showSecurityModal, setShowSecurityModal] = useState(false);
  const [securityForm, setSecurityForm] = useState({
    email: user.email,
    current_password: "",
    new_password: "",
    confirm_password: "",
  });
  const [securityLoading, setSecurityLoading] = useState(false);
  const [securityError, setSecurityError] = useState("");
  const [securitySuccess, setSecuritySuccess] = useState(false);
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  });

  // Load user's families on component mount
  useEffect(() => {
    loadUserFamilies();
  }, [user.id]);

  const loadUserFamilies = async () => {
    try {
      setLoadingFamilies(true);
      const response = await fetch(`${API_BASE_URL}/family/user/${user.id}`);
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
      // Parse YYYY-MM-DD format safely from ISO string
      const [year, month, day] = birthday.split("T")[0].split("-").map(Number);

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

  // Copy Family ID to Clipboard
  const handleCopyFamilyId = async (familyId: string) => {
    try {
      // Check if clipboard API is available
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(familyId);
        setCopiedFamilyId(familyId);
        console.log("Copied via clipboard API:", familyId);
      } else {
        // Fallback for browsers without clipboard API
        const textArea = document.createElement("textarea");
        textArea.value = familyId;
        textArea.style.position = "fixed";
        textArea.style.top = "-1000px";
        textArea.style.left = "-1000px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
        setCopiedFamilyId(familyId);
        console.log("Copied via fallback method:", familyId);
      }

      // Clear the feedback after 3 seconds
      setTimeout(() => {
        setCopiedFamilyId(null);
      }, 3000);
    } catch (error) {
      console.error("Failed to copy family ID:", error);
      // Show error feedback to user
      alert(`Failed to copy. Family ID: ${familyId}`);
    }
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
      const response = await fetch(`${API_BASE_URL}/family`, {
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

  // Join Family Handlers
  const handleJoinFamily = () => {
    setShowJoinFamilyModal(true);
    setJoinFamilyId("");
    setJoinFamilyInfo(null);
    setJoinFamilyError("");
  };

  const handleJoinFamilyIdChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const familyId = e.target.value;
    setJoinFamilyId(familyId);
    setJoinFamilyInfo(null);
    setJoinFamilyError("");

    if (familyId.trim()) {
      setLoadingJoinFamilyInfo(true);
      try {
        const response = await fetch(
          `${API_BASE_URL}/family/${familyId.trim()}`
        );
        if (response.ok) {
          const familyData = await response.json();
          setJoinFamilyInfo(familyData);
        } else if (response.status === 404) {
          setJoinFamilyError("Family not found");
        } else {
          setJoinFamilyError("Failed to fetch family information");
        }
      } catch {
        setJoinFamilyError("Failed to fetch family information");
      } finally {
        setLoadingJoinFamilyInfo(false);
      }
    }
  };

  const handleJoinFamilySubmit = async () => {
    if (!joinFamilyInfo) return;

    setJoinFamilyLoading(true);
    setJoinFamilyError("");

    try {
      const response = await fetch(
        `${API_BASE_URL}/family/${joinFamilyInfo.id}/members`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            user_id: user.id,
          }),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to join family");
      }

      // Reload families to show the new one
      await loadUserFamilies();

      // Close modal
      setShowJoinFamilyModal(false);
    } catch (err) {
      setJoinFamilyError(
        err instanceof Error ? err.message : "Failed to join family"
      );
    } finally {
      setJoinFamilyLoading(false);
    }
  };

  const handleCloseJoinFamilyModal = () => {
    setShowJoinFamilyModal(false);
    setJoinFamilyId("");
    setJoinFamilyInfo(null);
    setJoinFamilyError("");
  };

  // Manage Family Handlers
  const handleManageFamily = async (family: FamilyGroup) => {
    console.log("Managing family:", family);
    console.log("User role:", family.user_role);
    setSelectedFamily(family);
    setShowManageFamilyModal(true);
    setManageFamilyError("");
    setRelatedFamilyError("");
    setAddMemberEmail("");
    setAddRelatedFamilyId("");
    await loadFamilyMembers(family.id);
    await loadRelatedFamilies(family.id);
  };

  const loadFamilyMembers = async (familyId: string) => {
    try {
      setLoadingMembers(true);
      const response = await fetch(
        `${API_BASE_URL}/family/${familyId}/members`
      );
      if (response.ok) {
        const members = await response.json();
        // Sort members so owner is always first
        const sortedMembers = members.sort(
          (a: FamilyMember, b: FamilyMember) => {
            if (a.role === "owner") return -1;
            if (b.role === "owner") return 1;
            return 0;
          }
        );
        setFamilyMembers(sortedMembers);
      } else {
        console.error("Failed to fetch family members");
        setManageFamilyError("Failed to load family members");
      }
    } catch (error) {
      console.error("Error fetching family members:", error);
      setManageFamilyError("Failed to load family members");
    } finally {
      setLoadingMembers(false);
    }
  };

  const loadRelatedFamilies = async (familyId: string) => {
    try {
      setLoadingRelatedFamilies(true);
      const response = await fetch(
        `${API_BASE_URL}/family/${familyId}/related`
      );
      if (response.ok) {
        const relatedFams = await response.json();
        setRelatedFamilies(relatedFams);
      } else {
        console.error("Failed to fetch related families");
        setRelatedFamilyError("Failed to load related families");
      }
    } catch (error) {
      console.error("Error fetching related families:", error);
      setRelatedFamilyError("Failed to load related families");
    } finally {
      setLoadingRelatedFamilies(false);
    }
  };

  const handleAddRelatedFamily = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFamily || !addRelatedFamilyId.trim()) return;

    setAddRelatedFamilyLoading(true);
    setRelatedFamilyError("");

    try {
      const response = await fetch(
        `${API_BASE_URL}/family/${selectedFamily.id}/related`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            family_id: addRelatedFamilyId.trim(),
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to add related family");
      }

      // Reload related families and families list
      await loadRelatedFamilies(selectedFamily.id);
      await loadUserFamilies();

      // Clear the input
      setAddRelatedFamilyId("");
    } catch (err) {
      setRelatedFamilyError(
        err instanceof Error ? err.message : "Failed to add related family"
      );
    } finally {
      setAddRelatedFamilyLoading(false);
    }
  };

  const handleRemoveRelatedFamily = async (relatedFamilyId: string) => {
    if (!selectedFamily) return;

    try {
      const response = await fetch(
        `${API_BASE_URL}/family/${selectedFamily.id}/related/${relatedFamilyId}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to remove related family");
      }

      // Reload related families and families list
      await loadRelatedFamilies(selectedFamily.id);
      await loadUserFamilies();
    } catch (err) {
      setRelatedFamilyError(
        err instanceof Error ? err.message : "Failed to remove related family"
      );
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFamily || !addMemberEmail.trim()) return;

    setAddMemberLoading(true);
    setManageFamilyError("");

    try {
      // First, find the user by email
      const userResponse = await fetch(
        `${API_BASE_URL}/user/email/${encodeURIComponent(
          addMemberEmail.trim()
        )}`
      );

      if (!userResponse.ok) {
        throw new Error("User not found with that email address");
      }

      const userData = await userResponse.json();

      // Add the user to the family
      const addResponse = await fetch(
        `${API_BASE_URL}/family/${selectedFamily.id}/members`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            user_id: userData.id,
          }),
        }
      );

      if (!addResponse.ok) {
        const errorData = await addResponse.json();
        throw new Error(errorData.error || "Failed to add member to family");
      }

      // Reload family members and families list
      await loadFamilyMembers(selectedFamily.id);
      await loadUserFamilies();

      // Clear the email input
      setAddMemberEmail("");
    } catch (err) {
      setManageFamilyError(
        err instanceof Error ? err.message : "Failed to add member"
      );
    } finally {
      setAddMemberLoading(false);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!selectedFamily) return;

    try {
      const response = await fetch(
        `${API_BASE_URL}/family/${selectedFamily.id}/members/${memberId}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to remove member");
      }

      // Reload family members and families list
      await loadFamilyMembers(selectedFamily.id);
      await loadUserFamilies();
    } catch (err) {
      setManageFamilyError(
        err instanceof Error ? err.message : "Failed to remove member"
      );
    }
  };

  const handleDeleteFamily = async () => {
    if (!selectedFamily) return;

    setDeleteFamilyLoading(true);
    setManageFamilyError("");

    try {
      const response = await fetch(
        `${API_BASE_URL}/family/${selectedFamily.id}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to delete family");
      }

      // Reload families list and close modal
      await loadUserFamilies();
      handleCloseManageFamilyModal();
    } catch (err) {
      setManageFamilyError(
        err instanceof Error ? err.message : "Failed to delete family"
      );
    } finally {
      setDeleteFamilyLoading(false);
    }
  };

  const handleCloseManageFamilyModal = () => {
    setShowManageFamilyModal(false);
    setSelectedFamily(null);
    setFamilyMembers([]);
    setRelatedFamilies([]);
    setManageFamilyError("");
    setRelatedFamilyError("");
    setAddMemberEmail("");
    setAddRelatedFamilyId("");
  };

  // View Members Modal Handlers
  const handleViewMembers = async (family: FamilyGroup) => {
    setViewMembersFamily(family);
    setShowViewMembersModal(true);
    await loadViewFamilyMembers(family.id);
  };

  const loadViewFamilyMembers = async (familyId: string) => {
    try {
      setLoadingViewMembers(true);
      const response = await fetch(
        `${API_BASE_URL}/family/${familyId}/members`
      );
      if (response.ok) {
        const members = await response.json();
        // Sort members so owner is always first
        const sortedMembers = members.sort(
          (a: FamilyMember, b: FamilyMember) => {
            if (a.role === "owner") return -1;
            if (b.role === "owner") return 1;
            return 0;
          }
        );
        setViewMembersList(sortedMembers);
      } else {
        console.error("Failed to fetch family members");
      }
    } catch (error) {
      console.error("Error fetching family members:", error);
    } finally {
      setLoadingViewMembers(false);
    }
  };

  const handleCloseViewMembersModal = () => {
    setShowViewMembersModal(false);
    setViewMembersFamily(null);
    setViewMembersList([]);
  };

  // Leave Family Handler
  const handleLeaveFamily = async (familyId: string) => {
    try {
      setLeaveFamilyLoading(familyId);

      const response = await fetch(
        `${API_BASE_URL}/family/${familyId}/members/${user.id}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        throw new Error("Failed to leave family");
      }

      // Refresh the family list
      await loadUserFamilies();
    } catch (error) {
      console.error("Error leaving family:", error);
      alert("Failed to leave family. Please try again.");
    } finally {
      setLeaveFamilyLoading(null);
    }
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
      const response = await fetch(`${API_BASE_URL}/user/${user.id}`, {
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

      // Update user data in auth service
      authService.setUser(data);

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

  // Security Settings Handlers
  const handleSecuritySettings = () => {
    setShowSecurityModal(true);
    setSecurityForm({
      email: user.email,
      current_password: "",
      new_password: "",
      confirm_password: "",
    });
    setSecurityError("");
    setSecuritySuccess(false);
    setShowPasswords({
      current: false,
      new: false,
      confirm: false,
    });
  };

  const handleSecurityFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSecurityError("");
    setSecurityLoading(true);

    try {
      // Validate passwords match if changing password
      if (securityForm.new_password) {
        if (securityForm.new_password !== securityForm.confirm_password) {
          throw new Error("New passwords do not match");
        }
        if (securityForm.new_password.length < 6) {
          throw new Error("New password must be at least 6 characters long");
        }
        if (!securityForm.current_password) {
          throw new Error("Current password is required to change password");
        }
      }

      // Prepare the request body
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const requestBody: any = {};

      // Only include email if it changed
      if (securityForm.email !== user.email) {
        requestBody.email = securityForm.email;
      }

      // Only include password fields if changing password
      if (securityForm.new_password) {
        requestBody.current_password = securityForm.current_password;
        requestBody.new_password = securityForm.new_password;
      }

      // Don't make the request if nothing changed
      if (Object.keys(requestBody).length === 0) {
        setShowSecurityModal(false);
        return;
      }

      const response = await fetch(`${API_BASE_URL}/user/${user.id}/security`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to update security settings");
      }

      // Update user data in auth service
      authService.setUser(data);

      // Update parent component's user data
      onUserUpdate(data);

      // Show success message
      setSecuritySuccess(true);

      // Close modal after showing success for 2 seconds
      setTimeout(() => {
        setShowSecurityModal(false);
        setSecuritySuccess(false);
      }, 2000);
    } catch (err) {
      setSecurityError(
        err instanceof Error
          ? err.message
          : "Failed to update security settings"
      );
    } finally {
      setSecurityLoading(false);
    }
  };

  const handleCloseSecurityModal = () => {
    setShowSecurityModal(false);
    setSecurityError("");
    setSecuritySuccess(false);
  };

  const togglePasswordVisibility = (field: "current" | "new" | "confirm") => {
    setShowPasswords((prev) => ({
      ...prev,
      [field]: !prev[field],
    }));
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
                          <span className="family-id-container">
                            <button
                              className="copy-id-btn"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleCopyFamilyId(family.id);
                              }}
                              onTouchEnd={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleCopyFamilyId(family.id);
                              }}
                              title="Click to copy family ID"
                              type="button"
                            >
                              {family.id}
                            </button>
                            {copiedFamilyId === family.id && (
                              <span className="copy-feedback">
                                Family ID copied to clipboard
                              </span>
                            )}
                          </span>
                        </div>
                        <div className="family-group-actions">
                          <button
                            className="action-btn view-btn"
                            onClick={() => handleViewMembers(family)}
                          >
                            View Members
                          </button>
                          {family.user_role === "owner" && (
                            <button
                              className="action-btn manage-btn"
                              onClick={() => handleManageFamily(family)}
                            >
                              Manage
                            </button>
                          )}
                          {family.user_role === "member" && (
                            <button
                              className="action-btn leave-btn"
                              onClick={() => handleLeaveFamily(family.id)}
                              disabled={leaveFamilyLoading === family.id}
                            >
                              {leaveFamilyLoading === family.id
                                ? "Leaving..."
                                : "Leave"}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="section-footer">
                <button className="join-family-btn" onClick={handleJoinFamily}>
                  Join Family
                </button>
                <button
                  className="create-family-btn-footer"
                  onClick={handleCreateFamily}
                >
                  Create Family
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
              <button className="setting-item" onClick={handleSecuritySettings}>
                <span className="setting-icon">🔒</span>
                <span className="setting-label">Security & Privacy</span>
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

      {/* Join Family Modal */}
      {showJoinFamilyModal && (
        <div className="auth-overlay">
          <div className="auth-modal join-family-modal">
            <div className="auth-header">
              <h2>Join Family Group</h2>
              <button
                className="auth-close"
                onClick={handleCloseJoinFamilyModal}
              >
                ×
              </button>
            </div>

            <div className="auth-form">
              <div className="form-group">
                <label htmlFor="familyId">Family ID *</label>
                <input
                  type="text"
                  id="familyId"
                  value={joinFamilyId}
                  onChange={handleJoinFamilyIdChange}
                  placeholder="Enter the family ID to join"
                />
              </div>

              {joinFamilyError && (
                <div className="auth-error">{joinFamilyError}</div>
              )}

              {loadingJoinFamilyInfo && (
                <div className="loading-state">
                  Loading family information...
                </div>
              )}

              {joinFamilyInfo && (
                <div className="family-preview">
                  <h3>Family Information</h3>
                  <div className="family-group-card">
                    <div className="family-group-header">
                      <h3 className="family-group-name">
                        {joinFamilyInfo.name}
                      </h3>
                    </div>
                    <div className="family-group-details">
                      <div className="family-group-info">
                        <span className="family-id-container">
                          <span className="family-id-display">
                            {joinFamilyInfo.id}
                          </span>
                        </span>
                      </div>
                    </div>
                  </div>

                  <button
                    className="auth-submit"
                    onClick={handleJoinFamilySubmit}
                    disabled={joinFamilyLoading}
                  >
                    {joinFamilyLoading ? "Joining..." : "Join Family"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Manage Family Modal */}
      {showManageFamilyModal && selectedFamily && (
        <div className="auth-overlay">
          <div className="auth-modal family-manage-modal">
            <div className="auth-header">
              <h2>Manage {selectedFamily.name}</h2>
              <div className="modal-header-actions">
                {/* Temporarily show button for all users to debug */}
                {selectedFamily.owner_id === user.id && (
                  <button
                    className="delete-family-btn"
                    onClick={handleDeleteFamily}
                    disabled={deleteFamilyLoading}
                    title={`Delete Family (Role: ${selectedFamily.user_role})`}
                  >
                    {deleteFamilyLoading ? "Deleting..." : "🗑️ Delete Family"}
                  </button>
                )}
                <button
                  className="auth-close"
                  onClick={handleCloseManageFamilyModal}
                >
                  ×
                </button>
              </div>
            </div>

            <div className="family-manage-content">
              {/* Related Families Section */}
              <div className="add-member-section">
                <h3>Related Families</h3>

                {relatedFamilyError && (
                  <div className="auth-error">{relatedFamilyError}</div>
                )}

                {/* Add Related Family Form */}
                <form
                  onSubmit={handleAddRelatedFamily}
                  className="add-member-form"
                >
                  <div className="form-group">
                    <input
                      type="text"
                      value={addRelatedFamilyId}
                      onChange={(e) => setAddRelatedFamilyId(e.target.value)}
                      placeholder="Enter family ID to add relation"
                      required
                      disabled={addRelatedFamilyLoading}
                    />
                    <button
                      type="submit"
                      disabled={
                        addRelatedFamilyLoading || !addRelatedFamilyId.trim()
                      }
                    >
                      {addRelatedFamilyLoading ? "Adding..." : "Add Relation"}
                    </button>
                  </div>
                </form>

                {/* Related Families List */}
                {loadingRelatedFamilies ? (
                  <div className="loading-state">
                    <p>Loading related families...</p>
                  </div>
                ) : relatedFamilies.length > 0 ? (
                  <div className="members-list" style={{ marginTop: "1rem" }}>
                    {relatedFamilies.map((relatedFamily) => (
                      <div key={relatedFamily.id} className="member-row">
                        <div className="member-avatar">
                          <span className="avatar-placeholder">👨‍👩‍👧‍👦</span>
                        </div>
                        <div className="member-info">
                          <div className="member-name">
                            {relatedFamily.name}
                          </div>
                          <div className="member-email">
                            👥 {relatedFamily.member_count} members
                          </div>
                          <div className="member-birthday">
                            📅 Created {formatDate(relatedFamily.created_at)}
                          </div>
                        </div>
                        <div className="member-actions">
                          <button
                            className="remove-btn"
                            onClick={() =>
                              handleRemoveRelatedFamily(relatedFamily.id)
                            }
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p
                    style={{ margin: "1rem 0", color: "var(--text-secondary)" }}
                  >
                    No related families yet.
                  </p>
                )}
              </div>

              {/* Add Member Section */}
              <div className="add-member-section">
                <h3>Add New Member</h3>
                <form onSubmit={handleAddMember} className="add-member-form">
                  <div className="form-group">
                    <input
                      type="email"
                      value={addMemberEmail}
                      onChange={(e) => setAddMemberEmail(e.target.value)}
                      placeholder="Enter email address to add member"
                      required
                      disabled={addMemberLoading}
                    />
                    <button
                      type="submit"
                      disabled={addMemberLoading || !addMemberEmail.trim()}
                    >
                      {addMemberLoading ? "Adding..." : "Add Member"}
                    </button>
                  </div>
                </form>
              </div>

              {/* Members List Section */}
              <div className="members-section">
                <h3>Family Members ({familyMembers.length})</h3>

                {manageFamilyError && (
                  <div className="auth-error">{manageFamilyError}</div>
                )}

                {loadingMembers ? (
                  <div className="loading-state">
                    <p>Loading family members...</p>
                  </div>
                ) : (
                  <div className="members-list">
                    {familyMembers.map((member) => (
                      <div key={member.id} className="member-row">
                        <div className="member-avatar">
                          <span className="avatar-placeholder">
                            {member.first_name[0]}
                            {member.last_name[0]}
                          </span>
                        </div>

                        <div className="member-info">
                          <div className="member-name">
                            {member.first_name} {member.last_name}
                            {member.role === "owner" && (
                              <span className="owner-badge">👑 Owner</span>
                            )}
                            {member.id === user.id && (
                              <span className="current-user-badge">👤 You</span>
                            )}
                          </div>
                          <div className="member-email">{member.email}</div>
                          <div className="member-birthday">
                            🎂{" "}
                            {member.birthday
                              ? formatBirthday(member.birthday) || "Unknown"
                              : "Unknown"}
                          </div>
                        </div>

                        <div className="member-actions">
                          {member.role !== "owner" && (
                            <button
                              className="remove-btn"
                              onClick={() => handleRemoveMember(member.id)}
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
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

      {/* View Members Modal */}
      {showViewMembersModal && viewMembersFamily && (
        <div className="auth-overlay">
          <div className="auth-modal family-manage-modal">
            <div className="auth-header">
              <h2>{viewMembersFamily.name} Members</h2>
              <button
                className="auth-close"
                onClick={handleCloseViewMembersModal}
              >
                ×
              </button>
            </div>

            <div className="family-manage-content">
              {/* Members List Section */}
              <div className="members-section">
                <h3>Family Members ({viewMembersList.length})</h3>

                {loadingViewMembers ? (
                  <div className="loading-state">
                    <p>Loading family members...</p>
                  </div>
                ) : (
                  <div className="members-list">
                    {viewMembersList.map((member) => (
                      <div key={member.id} className="member-row">
                        <div className="member-avatar">
                          <span className="avatar-placeholder">
                            {member.first_name[0]}
                            {member.last_name[0]}
                          </span>
                        </div>

                        <div className="member-info">
                          <div className="member-name">
                            {member.first_name} {member.last_name}
                            {member.role === "owner" && (
                              <span className="owner-badge">👑 Owner</span>
                            )}
                            {member.id === user.id && (
                              <span className="current-user-badge">👤 You</span>
                            )}
                          </div>
                          <div className="member-email">{member.email}</div>
                          <div className="member-birthday">
                            🎂{" "}
                            {member.birthday
                              ? formatBirthday(member.birthday) || "Unknown"
                              : "Unknown"}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Security Settings Modal */}
      {showSecurityModal && (
        <div className="auth-overlay">
          <div className="auth-modal">
            <div className="auth-header">
              <h2>Security & Privacy Settings</h2>
              <button className="auth-close" onClick={handleCloseSecurityModal}>
                ×
              </button>
            </div>

            <form onSubmit={handleSecurityFormSubmit} className="auth-form">
              <div className="form-group">
                <label htmlFor="securityEmail">Email Address *</label>
                <input
                  type="email"
                  id="securityEmail"
                  value={securityForm.email}
                  onChange={(e) =>
                    setSecurityForm({ ...securityForm, email: e.target.value })
                  }
                  required
                  placeholder="Enter your email address"
                />
              </div>

              <div className="form-divider">
                <span>Change Password</span>
              </div>

              <div className="form-group">
                <label htmlFor="currentPassword">Current Password</label>
                <div className="password-input-container">
                  <input
                    type={showPasswords.current ? "text" : "password"}
                    id="currentPassword"
                    value={securityForm.current_password}
                    onChange={(e) =>
                      setSecurityForm({
                        ...securityForm,
                        current_password: e.target.value,
                      })
                    }
                    placeholder="Enter your current password"
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => togglePasswordVisibility("current")}
                    tabIndex={-1}
                  >
                    {showPasswords.current ? "👁️" : "👁️‍🗨️"}
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="newPassword">New Password</label>
                <div className="password-input-container">
                  <input
                    type={showPasswords.new ? "text" : "password"}
                    id="newPassword"
                    value={securityForm.new_password}
                    onChange={(e) =>
                      setSecurityForm({
                        ...securityForm,
                        new_password: e.target.value,
                      })
                    }
                    placeholder="Enter your new password (minimum 6 characters)"
                    minLength={6}
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => togglePasswordVisibility("new")}
                    tabIndex={-1}
                  >
                    {showPasswords.new ? "👁️" : "👁️‍🗨️"}
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="confirmPassword">Confirm New Password</label>
                <div className="password-input-container">
                  <input
                    type={showPasswords.confirm ? "text" : "password"}
                    id="confirmPassword"
                    value={securityForm.confirm_password}
                    onChange={(e) =>
                      setSecurityForm({
                        ...securityForm,
                        confirm_password: e.target.value,
                      })
                    }
                    placeholder="Confirm your new password"
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => togglePasswordVisibility("confirm")}
                    tabIndex={-1}
                  >
                    {showPasswords.confirm ? "👁️" : "👁️‍🗨️"}
                  </button>
                </div>
              </div>

              {securityError && (
                <div className="auth-error">{securityError}</div>
              )}

              {securitySuccess && (
                <div className="auth-success">
                  Security settings updated successfully! 🎉
                </div>
              )}

              <button
                type="submit"
                className="auth-submit"
                disabled={securityLoading || securitySuccess}
              >
                {securityLoading
                  ? "Updating..."
                  : securitySuccess
                  ? "Success!"
                  : "Update Security Settings"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Account;

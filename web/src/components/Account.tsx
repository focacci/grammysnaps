import { useState, useEffect, useCallback } from "react";
import "./Account.css";
import authService from "../services/auth.service";
import { getApiEndpoint } from "../services/api.service";
import { env } from "../utils/environment";
import Modal from "./Modal";

// Type definitions
interface User {
  id: string;
  email: string;
  first_name: string | null;
  middle_name?: string | null;
  last_name: string | null;
  birthday?: string | null;
  collections: string[];
  created_at: string;
  updated_at: string;
  profile_picture_url?: string | null;
  profile_picture_thumbnail_url?: string | null;
}

interface CollectionGroup {
  id: string;
  name: string;
  member_count: number;
  owner_id: string;
  user_role: "owner" | "member";
  related_collections: string[];
  created_at: string;
  updated_at: string;
}

interface CollectionMember {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  birthday?: string | null;
  role: "owner" | "member";
  joined_at: string;
  profile_picture_url?: string | null;
  profile_picture_thumbnail_url?: string | null;
}

interface RelatedCollection {
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
    collections: false,
  });

  // Collection state
  const [collections, setCollections] = useState<CollectionGroup[]>([]);
  const [loadingCollections, setLoadingCollections] = useState(true);

  // Profile Picture and Edit Profile Modal State (merged)
  const [showProfilePictureModal, setShowProfilePictureModal] = useState(false);
  const [selectedProfileFile, setSelectedProfileFile] = useState<File | null>(
    null
  );
  const [profilePreviewUrl, setProfilePreviewUrl] = useState<string | null>(
    null
  );
  const [profileUploading, setProfileUploading] = useState(false);
  const [editForm, setEditForm] = useState({
    first_name: user.first_name || null,
    middle_name: user.middle_name || null,
    last_name: user.last_name || null,
    birthday: user.birthday || null,
  });
  const [error, setError] = useState("");

  // Create Collection Modal State
  const [showCreateCollectionModal, setShowCreateCollectionModal] = useState(false);
  const [createCollectionForm, setCreateCollectionForm] = useState({
    name: "",
    description: "",
  });
  const [createCollectionLoading, setCreateCollectionLoading] = useState(false);
  const [createCollectionError, setCreateCollectionError] = useState("");

  // Join Collection Modal State
  const [showJoinCollectionModal, setShowJoinCollectionModal] = useState(false);
  const [joinCollectionId, setJoinCollectionId] = useState("");
  const [joinCollectionInfo, setJoinCollectionInfo] = useState<CollectionGroup | null>(
    null
  );
  const [loadingJoinCollectionInfo, setLoadingJoinCollectionInfo] = useState(false);
  const [joinCollectionLoading, setJoinCollectionLoading] = useState(false);
  const [joinCollectionError, setJoinCollectionError] = useState("");

  // Manage Collection Modal State
  const [showManageCollectionModal, setShowManageCollectionModal] = useState(false);
  const [selectedCollection, setSelectedCollection] = useState<CollectionGroup | null>(
    null
  );
  const [collectionMembers, setCollectionMembers] = useState<CollectionMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [addMemberEmail, setAddMemberEmail] = useState("");
  const [addMemberLoading, setAddMemberLoading] = useState(false);
  const [manageCollectionError, setManageCollectionError] = useState("");

  // Related Collections State
  const [relatedCollections, setRelatedCollections] = useState<RelatedCollection[]>([]);
  const [loadingRelatedCollections, setLoadingRelatedCollections] = useState(false);
  const [addRelatedCollectionId, setAddRelatedCollectionId] = useState("");
  const [addRelatedCollectionLoading, setAddRelatedCollectionLoading] = useState(false);
  const [relatedCollectionError, setRelatedCollectionError] = useState("");

  // Delete Collection State
  const [deleteCollectionLoading, setDeleteCollectionLoading] = useState(false);

  // Remove Member Confirmation State
  const [showRemoveMemberModal, setShowRemoveMemberModal] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<CollectionMember | null>(
    null
  );

  // Remove Related Collection Confirmation State
  const [showRemoveRelatedCollectionModal, setShowRemoveRelatedCollectionModal] =
    useState(false);
  const [relatedCollectionToRemove, setRelatedCollectionToRemove] =
    useState<RelatedCollection | null>(null);

  // Copy Feedback State
  const [copiedCollectionId, setCopiedCollectionId] = useState<string | null>(null);

  // Leave Collection State
  const [leaveCollectionLoading, setLeaveCollectionLoading] = useState<string | null>(
    null
  );
  const [showLeaveCollectionModal, setShowLeaveCollectionModal] = useState(false);
  const [collectionToLeave, setCollectionToLeave] = useState<CollectionGroup | null>(null);

  // View Members Modal State
  const [showViewMembersModal, setShowViewMembersModal] = useState(false);
  const [viewMembersCollection, setViewMembersCollection] =
    useState<CollectionGroup | null>(null);
  const [viewMembersList, setViewMembersList] = useState<CollectionMember[]>([]);
  const [loadingViewMembers, setLoadingViewMembers] = useState(false);

  // Security Modal State
  const [showSecurityModal, setShowSecurityModal] = useState(false);
  const [securityForm, setSecurityForm] = useState({
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

  const loadUserCollections = useCallback(async () => {
    try {
      setLoadingCollections(true);
      const response = await authService.apiCall(
        getApiEndpoint(`/collection/user/${user.id}`)
      );
      if (response.ok) {
        const collections = await response.json();
        setCollections(collections);
      } else {
        console.error("Failed to fetch collections");
      }
    } catch (error) {
      console.error("Error fetching collections:", error);
    } finally {
      setLoadingCollections(false);
    }
  }, [user.id]);

  // Load user's collections on component mount
  useEffect(() => {
    loadUserCollections();
  }, [loadUserCollections]);

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

  // Copy Collection ID to Clipboard
  const handleCopyCollectionId = async (collectionId: string) => {
    try {
      // Check if clipboard API is available
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(collectionId);
        setCopiedCollectionId(collectionId);
        if (env.isDevelopment()) {
          console.log("Copied via clipboard API:", collectionId);
        }
      } else {
        // Fallback for browsers without clipboard API
        const textArea = document.createElement("textarea");
        textArea.value = collectionId;
        textArea.style.position = "fixed";
        textArea.style.top = "-1000px";
        textArea.style.left = "-1000px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
        setCopiedCollectionId(collectionId);
        if (env.isDevelopment()) {
          console.log("Copied via fallback method:", collectionId);
        }
      }

      // Clear the feedback after 3 seconds
      setTimeout(() => {
        setCopiedCollectionId(null);
      }, 3000);
    } catch (error) {
      console.error("Failed to copy collection ID:", error);
      // Show error feedback to user
      alert(`Failed to copy. Collection ID: ${collectionId}`);
    }
  };

  // Create Collection Handlers
  const handleCreateCollection = () => {
    setShowCreateCollectionModal(true);
    setCreateCollectionForm({ name: "", description: "" });
    setCreateCollectionError("");
  };

  const handleCreateCollectionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateCollectionError("");
    setCreateCollectionLoading(true);

    try {
      const response = await authService.apiCall(getApiEndpoint("/collection"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: createCollectionForm.name.trim(),
          owner_id: user.id,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create collection");
      }

      // Reload collections to show the new one
      await loadUserCollections();

      // Close modal
      setShowCreateCollectionModal(false);
    } catch (err) {
      setCreateCollectionError(
        err instanceof Error ? err.message : "Failed to create collection"
      );
    } finally {
      setCreateCollectionLoading(false);
    }
  };

  const handleCloseCreateCollectionModal = () => {
    setShowCreateCollectionModal(false);
    setCreateCollectionError("");
  };

  // Join Collection Handlers
  const handleJoinCollection = () => {
    setShowJoinCollectionModal(true);
    setJoinCollectionId("");
    setJoinCollectionInfo(null);
    setJoinCollectionError("");
  };

  const handleJoinCollectionIdChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const collectionId = e.target.value;
    setJoinCollectionId(collectionId);
    setJoinCollectionInfo(null);
    setJoinCollectionError("");

    if (collectionId.trim()) {
      setLoadingJoinCollectionInfo(true);
      try {
        const response = await authService.apiCall(
          getApiEndpoint(`/collection/${collectionId.trim()}`)
        );
        if (response.ok) {
          const collectionData = await response.json();
          setJoinCollectionInfo(collectionData);
        } else if (response.status === 404) {
          setJoinCollectionError("Collection not found");
        } else {
          setJoinCollectionError("Failed to fetch collection information");
        }
      } catch {
        setJoinCollectionError("Failed to fetch collection information");
      } finally {
        setLoadingJoinCollectionInfo(false);
      }
    }
  };

  const handleJoinCollectionSubmit = async () => {
    if (!joinCollectionInfo) return;

    setJoinCollectionLoading(true);
    setJoinCollectionError("");

    try {
      const response = await authService.apiCall(
        getApiEndpoint(`/collection/${joinCollectionInfo.id}/members`),
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
        throw new Error(data.error || "Failed to join collection");
      }

      // Reload collections to show the new one
      await loadUserCollections();

      // Close modal
      setShowJoinCollectionModal(false);
    } catch (err) {
      setJoinCollectionError(
        err instanceof Error ? err.message : "Failed to join collection"
      );
    } finally {
      setJoinCollectionLoading(false);
    }
  };

  const handleCloseJoinCollectionModal = () => {
    setShowJoinCollectionModal(false);
    setJoinCollectionId("");
    setJoinCollectionInfo(null);
    setJoinCollectionError("");
  };

  // Manage Collection Handlers
  const handleManageCollection = async (collection: CollectionGroup) => {
    if (env.isDevelopment()) {
      console.log("Managing collection:", collection);
      console.log("User role:", collection.user_role);
    }
    setSelectedCollection(collection);
    setShowManageCollectionModal(true);
    setManageCollectionError("");
    setRelatedCollectionError("");
    setAddMemberEmail("");
    setAddRelatedCollectionId("");
    await loadCollectionMembers(collection.id);
    await loadRelatedCollections(collection.id);
  };

  const loadCollectionMembers = async (collectionId: string) => {
    try {
      setLoadingMembers(true);
      const response = await authService.apiCall(
        getApiEndpoint(`/collection/${collectionId}/members`)
      );
      if (response.ok) {
        const members = await response.json();
        // Sort members so owner is always first
        const sortedMembers = members.sort(
          (a: CollectionMember, b: CollectionMember) => {
            if (a.role === "owner") return -1;
            if (b.role === "owner") return 1;
            return 0;
          }
        );
        setCollectionMembers(sortedMembers);
      } else {
        console.error("Failed to fetch collection members");
        setManageCollectionError("Failed to load collection members");
      }
    } catch (error) {
      console.error("Error fetching collection members:", error);
      setManageCollectionError("Failed to load collection members");
    } finally {
      setLoadingMembers(false);
    }
  };

  const loadRelatedCollections = async (collectionId: string) => {
    try {
      setLoadingRelatedCollections(true);
      const response = await authService.apiCall(
        getApiEndpoint(`/collection/${collectionId}/related`)
      );
      if (response.ok) {
        const relatedFams = await response.json();
        setRelatedCollections(relatedFams);
      } else {
        console.error("Failed to fetch related collections");
        setRelatedCollectionError("Failed to load related collections");
      }
    } catch (error) {
      console.error("Error fetching related collections:", error);
      setRelatedCollectionError("Failed to load related collections");
    } finally {
      setLoadingRelatedCollections(false);
    }
  };

  const handleAddRelatedCollection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCollection || !addRelatedCollectionId.trim()) return;

    setAddRelatedCollectionLoading(true);
    setRelatedCollectionError("");

    try {
      const response = await authService.apiCall(
        getApiEndpoint(`/collection/${selectedCollection.id}/related`),
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            collection_id: addRelatedCollectionId.trim(),
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to add related collection");
      }

      // Reload related collections and collections list
      await loadRelatedCollections(selectedCollection.id);
      await loadUserCollections();

      // Clear the input
      setAddRelatedCollectionId("");
    } catch (err) {
      setRelatedCollectionError(
        err instanceof Error ? err.message : "Failed to add related collection"
      );
    } finally {
      setAddRelatedCollectionLoading(false);
    }
  };

  const handleRemoveRelatedCollection = async () => {
    if (!selectedCollection || !relatedCollectionToRemove) return;

    try {
      const response = await authService.apiCall(
        getApiEndpoint(
          `/collection/${selectedCollection.id}/related/${relatedCollectionToRemove.id}`
        ),
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to remove related collection");
      }

      // Reload related collections and collections list
      await loadRelatedCollections(selectedCollection.id);
      await loadUserCollections();

      // Close the confirmation modal
      setShowRemoveRelatedCollectionModal(false);
      setRelatedCollectionToRemove(null);
    } catch (err) {
      setRelatedCollectionError(
        err instanceof Error ? err.message : "Failed to remove related collection"
      );
    }
  };

  const handleRemoveRelatedCollectionClick = (relatedCollection: RelatedCollection) => {
    setRelatedCollectionToRemove(relatedCollection);
    setShowRemoveRelatedCollectionModal(true);
  };

  const handleCloseRemoveRelatedCollectionModal = () => {
    setShowRemoveRelatedCollectionModal(false);
    setRelatedCollectionToRemove(null);
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCollection || !addMemberEmail.trim()) return;

    setAddMemberLoading(true);
    setManageCollectionError("");

    try {
      // First, find the user by email
      const userResponse = await authService.apiCall(
        getApiEndpoint(
          `/user/email/${encodeURIComponent(addMemberEmail.trim())}`
        )
      );

      if (!userResponse.ok) {
        throw new Error("User not found with that email address");
      }

      const userData = await userResponse.json();

      // Add the user to the collection
      const addResponse = await authService.apiCall(
        getApiEndpoint(`/collection/${selectedCollection.id}/members`),
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
        throw new Error(errorData.error || "Failed to add member to collection");
      }

      // Reload collection members and collections list
      await loadCollectionMembers(selectedCollection.id);
      await loadUserCollections();

      // Clear the email input
      setAddMemberEmail("");
    } catch (err) {
      setManageCollectionError(
        err instanceof Error ? err.message : "Failed to add member"
      );
    } finally {
      setAddMemberLoading(false);
    }
  };

  const handleRemoveMember = async () => {
    if (!selectedCollection || !memberToRemove) return;

    try {
      const response = await authService.apiCall(
        getApiEndpoint(
          `/collection/${selectedCollection.id}/members/${memberToRemove.id}`
        ),
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to remove member");
      }

      // Reload collection members and collections list
      await loadCollectionMembers(selectedCollection.id);
      await loadUserCollections();

      // Close the confirmation modal
      setShowRemoveMemberModal(false);
      setMemberToRemove(null);
    } catch (err) {
      setManageCollectionError(
        err instanceof Error ? err.message : "Failed to remove member"
      );
    }
  };

  const handleRemoveMemberClick = (member: CollectionMember) => {
    setMemberToRemove(member);
    setShowRemoveMemberModal(true);
  };

  const handleCloseRemoveMemberModal = () => {
    setShowRemoveMemberModal(false);
    setMemberToRemove(null);
  };

  const handleDeleteCollection = async () => {
    if (!selectedCollection) return;

    setDeleteCollectionLoading(true);
    setManageCollectionError("");

    try {
      const response = await authService.apiCall(
        getApiEndpoint(`/collection/${selectedCollection.id}`),
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to delete collection");
      }

      // Reload collections list and close modal
      await loadUserCollections();
      handleCloseManageCollectionModal();
    } catch (err) {
      setManageCollectionError(
        err instanceof Error ? err.message : "Failed to delete collection"
      );
    } finally {
      setDeleteCollectionLoading(false);
    }
  };

  const handleCloseManageCollectionModal = () => {
    setShowManageCollectionModal(false);
    setSelectedCollection(null);
    setCollectionMembers([]);
    setRelatedCollections([]);
    setManageCollectionError("");
    setRelatedCollectionError("");
    setAddMemberEmail("");
    setAddRelatedCollectionId("");

    // Clean up confirmation modals
    setShowRemoveMemberModal(false);
    setMemberToRemove(null);
    setShowRemoveRelatedCollectionModal(false);
    setRelatedCollectionToRemove(null);
  };

  // View Members Modal Handlers
  const handleViewMembers = async (collection: CollectionGroup) => {
    setViewMembersCollection(collection);
    setShowViewMembersModal(true);
    await loadViewCollectionMembers(collection.id);
  };

  const loadViewCollectionMembers = async (collectionId: string) => {
    try {
      setLoadingViewMembers(true);
      const response = await authService.apiCall(
        getApiEndpoint(`/collection/${collectionId}/members`)
      );
      if (response.ok) {
        const members = await response.json();
        // Sort members so owner is always first
        const sortedMembers = members.sort(
          (a: CollectionMember, b: CollectionMember) => {
            if (a.role === "owner") return -1;
            if (b.role === "owner") return 1;
            return 0;
          }
        );
        setViewMembersList(sortedMembers);
      } else {
        console.error("Failed to fetch collection members");
      }
    } catch (error) {
      console.error("Error fetching collection members:", error);
    } finally {
      setLoadingViewMembers(false);
    }
  };

  const handleCloseViewMembersModal = () => {
    setShowViewMembersModal(false);
    setViewMembersCollection(null);
    setViewMembersList([]);
  };

  // Leave Collection Handler
  const handleLeaveCollectionClick = (collection: CollectionGroup) => {
    setCollectionToLeave(collection);
    setShowLeaveCollectionModal(true);
  };

  const handleLeaveCollection = async () => {
    if (!collectionToLeave) return;

    try {
      setLeaveCollectionLoading(collectionToLeave.id);

      const response = await authService.apiCall(
        getApiEndpoint(`/collection/${collectionToLeave.id}/members/${user.id}`),
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        throw new Error("Failed to leave collection");
      }

      // Refresh the collection list
      await loadUserCollections();

      // Close the modal
      setShowLeaveCollectionModal(false);
      setCollectionToLeave(null);
    } catch (error) {
      console.error("Error leaving collection:", error);
      alert("Failed to leave collection. Please try again.");
    } finally {
      setLeaveCollectionLoading(null);
    }
  };

  const handleCloseLeaveCollectionModal = () => {
    setShowLeaveCollectionModal(false);
    setCollectionToLeave(null);
  };

  // Profile Picture and Edit Profile Handlers (merged)
  const handleProfilePictureClick = () => {
    setShowProfilePictureModal(true);
    setSelectedProfileFile(null);
    // Reset form to current user data
    setEditForm({
      first_name: user.first_name || "",
      middle_name: user.middle_name || "",
      last_name: user.last_name || "",
      birthday: user.birthday || "",
    });
    setError("");
    // If user already has a profile picture, show it as preview
    if (user.profile_picture_url) {
      setProfilePreviewUrl(user.profile_picture_url);
    } else {
      setProfilePreviewUrl(null);
    }
  };

  const handleProfileFileSelect = (file: File) => {
    const previewUrl = URL.createObjectURL(file);
    setProfilePreviewUrl(previewUrl);
    setSelectedProfileFile(file);
  };

  const handleProfileFileInputChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (file) {
      handleProfileFileSelect(file);
    }
  };

  const handleSelectDifferentProfilePhoto = () => {
    document.getElementById("profile-file-input")?.click();
  };

  const handleProfilePictureSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setProfileUploading(true);

    try {
      let profilePictureUrl = user.profile_picture_url;
      let thumbnailUrl = user.profile_picture_thumbnail_url;

      // First, upload profile picture if one was selected
      if (selectedProfileFile) {
        const formData = new FormData();
        formData.append("file", selectedProfileFile);

        const authHeader = await authService.getAuthHeader();
        if (!authHeader) {
          throw new Error("Not authenticated");
        }

        const response = await fetch(
          getApiEndpoint(`/user/${user.id}/profile-picture`),
          {
            method: "POST",
            headers: {
              Authorization: authHeader,
            },
            body: formData,
          }
        );

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || "Failed to upload profile picture");
        }

        const data = await response.json();
        profilePictureUrl = data.url;
        
        // Also store the thumbnail URL for immediate use
        thumbnailUrl = data.thumbnail_url;
      }

      if (env.isDevelopment()) {
        console.log("Birthday:", editForm.birthday);
      }
      // Then, update user profile data
      const userUpdateResponse = await authService.apiCall(
        getApiEndpoint(`/user/${user.id}`),
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            first_name: editForm.first_name?.trim() || null,
            middle_name: editForm.middle_name?.trim() || null,
            last_name: editForm.last_name?.trim() || null,
            birthday: editForm.birthday || null,
          }),
        }
      );

      const userData = await userUpdateResponse.json();

      if (!userUpdateResponse.ok) {
        throw new Error(userData.error || "Failed to update profile");
      }

      // Merge the profile picture URLs with the updated user data
      const finalUserData = { ...userData };
      if (selectedProfileFile && profilePictureUrl && thumbnailUrl) {
        finalUserData.profile_picture_url = profilePictureUrl;
        finalUserData.profile_picture_thumbnail_url = thumbnailUrl;
      }

      // Update user data in auth service
      authService.setUser(finalUserData);
      onUserUpdate(finalUserData);

      // Close modal and reset state
      setShowProfilePictureModal(false);
      setSelectedProfileFile(null);
      setProfilePreviewUrl(null);
    } catch (error) {
      console.error("Error updating profile:", error);
      setError(
        error instanceof Error ? error.message : "Failed to update profile"
      );
    } finally {
      setProfileUploading(false);
    }
  };

  const handleCloseProfilePictureModal = () => {
    setShowProfilePictureModal(false);
    setSelectedProfileFile(null);
    // Clean up blob preview URL only, not existing profile picture URLs
    if (profilePreviewUrl && profilePreviewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(profilePreviewUrl);
    }
    setProfilePreviewUrl(null);
  };

  // Security Settings Handlers
  const handleSecuritySettings = () => {
    setShowSecurityModal(true);
    setSecurityForm({
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

      const response = await authService.apiCall(
        getApiEndpoint(`/user/${user.id}/security`),
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestBody),
        }
      );

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
            {user.profile_picture_thumbnail_url ? (
              <img
                src={user.profile_picture_thumbnail_url}
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
                🎂 {formatBirthday(user.birthday)}
              </p>
            )}
          </div>
        </div>

        {/* Collections Section */}
        <div className="account-section">
          <button
            className="section-header"
            onClick={() => toggleSection("collections")}
            aria-expanded={!collapsedSections.collections}
          >
            <span
              className={`section-caret ${
                collapsedSections.collections ? "collapsed" : ""
              }`}
            >
              ▼
            </span>
            <span className="section-title">Collections</span>
            <span className="section-count">({collections.length})</span>
          </button>

          {!collapsedSections.collections && (
            <div className="section-content">
              {loadingCollections ? (
                <div className="loading-state">
                  <p>Loading collections...</p>
                </div>
              ) : collections.length === 0 ? (
                <div className="empty-state">
                  <p>You're not a member of any collections yet.</p>
                </div>
              ) : (
                <div className="collections-list">
                  {collections.map((collection) => (
                    <div key={collection.id} className="collection-card">
                      <div className="collection-header">
                        <h3 className="collection-name">{collection.name}</h3>
                        {getRoleBadge(collection.user_role)}
                      </div>
                      <div className="collection-details">
                        <div className="collection-info">
                          <span className="collection-id-container">
                            <button
                              className="copy-id-btn"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleCopyCollectionId(collection.id);
                              }}
                              onTouchStart={(e) => {
                                // Add visual feedback on touch start
                                e.currentTarget.style.transform = "scale(0.95)";
                              }}
                              onTouchEnd={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                // Reset visual feedback
                                e.currentTarget.style.transform = "";
                                // Only trigger copy if this was a tap, not a swipe
                                const touch = e.changedTouches[0];
                                if (
                                  touch &&
                                  e.currentTarget.contains(
                                    document.elementFromPoint(
                                      touch.clientX,
                                      touch.clientY
                                    ) as Node
                                  )
                                ) {
                                  handleCopyCollectionId(collection.id);
                                }
                              }}
                              onTouchCancel={(e) => {
                                // Reset visual feedback if touch is cancelled
                                e.currentTarget.style.transform = "";
                              }}
                              title="Click to copy collection ID"
                              type="button"
                            >
                              {collection.id}
                            </button>
                            {copiedCollectionId === collection.id && (
                              <span className="copy-feedback">
                                Collection ID copied to clipboard
                              </span>
                            )}
                          </span>
                          <span className="member-count">
                            👥 {collection.member_count}
                          </span>
                        </div>
                        <div className="collection-actions">
                          <button
                            className="action-btn view-btn"
                            onClick={() => handleViewMembers(collection)}
                          >
                            View
                          </button>
                          {collection.user_role === "owner" && (
                            <button
                              className="action-btn manage-btn"
                              onClick={() => handleManageCollection(collection)}
                            >
                              Manage
                            </button>
                          )}
                          {collection.user_role === "member" && (
                            <button
                              className="action-btn leave-btn"
                              onClick={() => handleLeaveCollectionClick(collection)}
                              disabled={leaveCollectionLoading === collection.id}
                            >
                              {leaveCollectionLoading === collection.id
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
                <button className="join-collection-btn" onClick={handleJoinCollection}>
                  Join Collection
                </button>
                <button
                  className="create-collection-btn-footer"
                  onClick={handleCreateCollection}
                >
                  Create Collection
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="account-section">
          <h2 className="section-title-static">Account Settings</h2>
          <div className="section-content">
            <div className="settings-grid">
              <button
                className="setting-item"
                onClick={handleProfilePictureClick}
              >
                <span className="setting-icon">👤</span>
                <span className="setting-label">Edit Profile</span>
                <span className="setting-arrow">→</span>
              </button>
              <button className="setting-item" onClick={handleSecuritySettings}>
                <span className="setting-icon">🔒</span>
                <span className="setting-label">Security</span>
                <span className="setting-arrow">→</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Create Collection Modal */}
      <Modal
        isOpen={showCreateCollectionModal}
        mode="form"
        title="Create Collection"
        onClose={handleCloseCreateCollectionModal}
        onRightAction={handleCreateCollectionSubmit}
        rightButtonText={createCollectionLoading ? "Creating..." : "Create"}
        rightButtonDisabled={createCollectionLoading}
      >
        <div className="form-group">
          <label htmlFor="collectionName">Collection Name *</label>
          <input
            type="text"
            id="collectionName"
            name="collectionName"
            value={createCollectionForm.name}
            onChange={(e) =>
              setCreateCollectionForm({
                ...createCollectionForm,
                name: e.target.value,
              })
            }
            required
            placeholder="Enter your collection group name"
          />
        </div>

        {createCollectionError && (
          <div className="auth-error">{createCollectionError}</div>
        )}
      </Modal>

      {/* Join Collection Modal */}
      <Modal
        isOpen={showJoinCollectionModal}
        mode="form"
        title="Join Collection"
        onClose={handleCloseJoinCollectionModal}
        onRightAction={handleJoinCollectionSubmit}
        rightButtonText={joinCollectionLoading ? "Joining..." : "Join"}
        rightButtonDisabled={joinCollectionLoading}
      >
        <div className="form-group">
          <label htmlFor="collectionId">Collection ID *</label>
          <input
            type="text"
            id="collectionId"
            name="collectionId"
            autoComplete="off"
            value={joinCollectionId}
            onChange={handleJoinCollectionIdChange}
            placeholder="Enter the collection ID to join"
          />
        </div>

        {joinCollectionError && <div className="auth-error">{joinCollectionError}</div>}

        {loadingJoinCollectionInfo && (
          <div className="loading-state">Loading collection information...</div>
        )}

        {joinCollectionInfo && (
          <div className="collection-card">
            <div className="collection-header">
              <h3 className="collection-name">{joinCollectionInfo.name}</h3>
            </div>
            <div className="collection-details">
              <div className="collection-info">
                <span className="collection-id-container">
                  <span className="collection-id-display">{joinCollectionInfo.id}</span>
                </span>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Manage Collection Modal */}
      <Modal
        isOpen={showManageCollectionModal && selectedCollection !== null}
        mode="view"
        title={`Manage ${selectedCollection?.name || "Collection"}`}
        onClose={handleCloseManageCollectionModal}
        showLeftButton={false}
        showRightButton={false}
        showDeleteButton={selectedCollection?.owner_id === user.id}
        onDeleteAction={handleDeleteCollection}
        deleteButtonText={
          deleteCollectionLoading ? "Deleting..." : "🗑️ Delete Collection"
        }
        deleteButtonDisabled={deleteCollectionLoading}
        deleteButtonClass="delete-collection-btn"
        maxWidth="700px"
      >
        <div className="collection-manage-content">
          {/* Related Collections Section */}
          <div className="add-member-section">
            <h3>Related Collections</h3>

            {relatedCollectionError && (
              <div className="auth-error">{relatedCollectionError}</div>
            )}

            {/* Add Related Collection Form */}
            <form onSubmit={handleAddRelatedCollection} className="add-member-form">
              <div className="form-group">
                <input
                  type="text"
                  name="relatedCollectionId"
                  autoComplete="off"
                  value={addRelatedCollectionId}
                  onChange={(e) => setAddRelatedCollectionId(e.target.value)}
                  placeholder="Enter collection ID to add relation"
                  required
                  disabled={addRelatedCollectionLoading}
                />
                <button
                  type="submit"
                  disabled={
                    addRelatedCollectionLoading || !addRelatedCollectionId.trim()
                  }
                >
                  {addRelatedCollectionLoading ? "Adding..." : "Add Relation"}
                </button>
              </div>
            </form>

            {/* Related Collections List */}
            {loadingRelatedCollections ? (
              <div className="loading-state">
                <p>Loading related collections...</p>
              </div>
            ) : relatedCollections.length > 0 ? (
              <div className="members-list" style={{ marginTop: "1rem" }}>
                {relatedCollections.map((relatedCollection) => (
                  <div key={relatedCollection.id} className="member-row">
                    <div className="member-avatar">
                      <span className="avatar-placeholder">👨‍👩‍👧‍👦</span>
                    </div>
                    <div className="member-info">
                      <div className="member-name">{relatedCollection.name}</div>
                      <div className="member-email">
                        👥 {relatedCollection.member_count} members
                      </div>
                      <div className="member-birthday">
                        📅 Created {formatDate(relatedCollection.created_at)}
                      </div>
                    </div>
                    <div className="member-actions">
                      <button
                        className="remove-btn"
                        onClick={() =>
                          handleRemoveRelatedCollectionClick(relatedCollection)
                        }
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ margin: "1rem 0", color: "var(--text-secondary)" }}>
                No related collections yet.
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
                  name="memberEmail"
                  autoComplete="email"
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
            <h3>Collection Members ({collectionMembers.length})</h3>

            {manageCollectionError && (
              <div className="auth-error">{manageCollectionError}</div>
            )}

            {loadingMembers ? (
              <div className="loading-state">
                <p>Loading collection members...</p>
              </div>
            ) : (
              <div className="members-list">
                {collectionMembers.map((member) => (
                  <div key={member.id} className="member-row">
                    <div className="member-avatar">
                      {member.profile_picture_thumbnail_url ? (
                        <img
                          src={member.profile_picture_thumbnail_url}
                          alt={`${member.first_name || "Member"}'s profile`}
                          className="member-avatar-image"
                        />
                      ) : (
                        <span className="avatar-placeholder">
                          {member.first_name?.[0] || "?"}
                          {member.last_name?.[0] || "?"}
                        </span>
                      )}
                    </div>

                    <div className="member-info">
                      <div className="member-name">
                        {member.first_name || "No"} {member.last_name || "Name"}
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
                          onClick={() => handleRemoveMemberClick(member)}
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
      </Modal>

      {/* View Members Modal */}
      <Modal
        isOpen={showViewMembersModal && viewMembersCollection !== null}
        mode="view"
        title={`${viewMembersCollection?.name || "Collection"} Members`}
        onClose={handleCloseViewMembersModal}
        showLeftButton={false}
        showRightButton={false}
        maxWidth="600px"
      >
        <div className="collection-manage-content">
          {/* Members List Section */}
          <div className="members-section">
            <h3>Collection Members ({viewMembersList.length})</h3>

            {loadingViewMembers ? (
              <div className="loading-state">
                <p>Loading collection members...</p>
              </div>
            ) : (
              <div className="members-list">
                {viewMembersList.map((member) => (
                  <div key={member.id} className="member-row">
                    <div className="member-avatar">
                      {member.profile_picture_thumbnail_url ? (
                        <img
                          src={member.profile_picture_thumbnail_url}
                          alt={`${member.first_name || "Member"}'s profile`}
                          className="member-avatar-image"
                        />
                      ) : (
                        <span className="avatar-placeholder">
                          {member.first_name?.[0] || "?"}
                          {member.last_name?.[0] || "?"}
                        </span>
                      )}
                    </div>

                    <div className="member-info">
                      <div className="member-name">
                        {member.first_name || "No"} {member.last_name || "Name"}
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
      </Modal>

      {/* Security Settings Modal */}
      <Modal
        isOpen={showSecurityModal}
        mode="form"
        title="Security & Privacy Settings"
        onClose={handleCloseSecurityModal}
        onRightAction={handleSecurityFormSubmit}
        rightButtonText={
          securityLoading
            ? "Updating..."
            : securitySuccess
            ? "Success!"
            : "Update Security Settings"
        }
        rightButtonDisabled={securityLoading || securitySuccess}
        leftButtonClass="cancel-btn"
        rightButtonClass="submit-btn"
        showLeftButton={false}
      >
        <div className="security-modal-user-email">
          <span>{user.email}</span>
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
              name="currentPassword"
              autoComplete="current-password"
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
              name="newPassword"
              autoComplete="new-password"
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
              name="confirmPassword"
              autoComplete="new-password"
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

        {securityError && <div className="auth-error">{securityError}</div>}

        {securitySuccess && (
          <div className="auth-success">
            Security settings updated successfully! 🎉
          </div>
        )}
      </Modal>

      {/* Profile Picture Modal */}
      <Modal
        isOpen={showProfilePictureModal}
        mode="form"
        title="Edit Profile"
        onClose={handleCloseProfilePictureModal}
        onLeftAction={handleCloseProfilePictureModal}
        onRightAction={handleProfilePictureSubmit}
        leftButtonText="Cancel"
        rightButtonText={profileUploading ? "Saving..." : "Save Changes"}
        leftButtonClass="cancel-btn"
        rightButtonClass="submit-btn"
        rightButtonDisabled={profileUploading}
        showAdditionalButton={!!selectedProfileFile || !!profilePreviewUrl}
        onAdditionalAction={handleSelectDifferentProfilePhoto}
        additionalButtonText="Select Different Photo"
        additionalButtonClass="additional-btn"
        maxWidth="600px"
        headerSection={
          <>
            <div
              className={`file-drop-zone ${
                (selectedProfileFile && profilePreviewUrl) ||
                (!selectedProfileFile && profilePreviewUrl)
                  ? "has-preview"
                  : ""
              }`}
            >
              {selectedProfileFile && profilePreviewUrl ? (
                <div className="file-preview-display">
                  <img
                    src={profilePreviewUrl}
                    alt={selectedProfileFile.name}
                    className="upload-image-preview"
                    onError={(e) => {
                      // Fallback if preview fails to load
                      e.currentTarget.style.display = "none";
                      e.currentTarget.parentElement!.innerHTML =
                        '<div class="image-preview-placeholder"><span>📸</span><p>Preview not available</p></div>';
                    }}
                  />
                </div>
              ) : selectedProfileFile ? (
                <div className="file-selected">
                  <span className="file-icon">📁</span>
                  <span className="file-name">{selectedProfileFile.name}</span>
                  <span className="file-size">
                    ({(selectedProfileFile.size / 1024 / 1024).toFixed(2)} MB)
                  </span>
                  <button
                    type="button"
                    className="remove-file-btn"
                    onClick={() => {
                      // Clean up preview URL only if it's a blob URL
                      if (
                        profilePreviewUrl &&
                        profilePreviewUrl.startsWith("blob:")
                      ) {
                        URL.revokeObjectURL(profilePreviewUrl);
                      }
                      setSelectedProfileFile(null);
                      // Reset to existing profile picture if available
                      setProfilePreviewUrl(user.profile_picture_url || null);
                    }}
                  >
                    ×
                  </button>
                </div>
              ) : profilePreviewUrl ? (
                <div className="file-preview-display">
                  <img
                    src={profilePreviewUrl}
                    alt="Current profile picture"
                    className="upload-image-preview"
                    onError={(e) => {
                      // Fallback if preview fails to load
                      e.currentTarget.style.display = "none";
                      e.currentTarget.parentElement!.innerHTML =
                        '<div class="image-preview-placeholder"><span>📸</span><p>Preview not available</p></div>';
                    }}
                  />
                </div>
              ) : (
                <div className="file-drop-content">
                  <span className="drop-icon">�</span>
                  <p>Drag and drop an image here, or</p>
                  <button
                    type="button"
                    className="browse-btn"
                    onClick={() =>
                      document.getElementById("profile-file-input")?.click()
                    }
                  >
                    Browse Files
                  </button>
                  <p className="file-info">
                    Supported: JPEG, PNG, GIF, WebP (Max 10MB)
                  </p>
                </div>
              )}
            </div>
            <input
              id="profile-file-input"
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
              onChange={handleProfileFileInputChange}
              style={{ display: "none" }}
            />
          </>
        }
      >
        {/* Profile Information Form */}
        <div className="profile-edit-form">
          <div className="form-group">
            <label htmlFor="editFirstName">First Name</label>
            <input
              type="text"
              id="editFirstName"
              name="firstName"
              autoComplete="given-name"
              value={editForm.first_name || ""}
              onChange={(e) =>
                setEditForm({ ...editForm, first_name: e.target.value || null })
              }
              placeholder="Enter your first name (optional)"
            />
          </div>

          <div className="form-group">
            <label htmlFor="editMiddleName">Middle Name</label>
            <input
              type="text"
              id="editMiddleName"
              name="middleName"
              autoComplete="additional-name"
              value={editForm.middle_name || ""}
              onChange={(e) =>
                setEditForm({
                  ...editForm,
                  middle_name: e.target.value || null,
                })
              }
              placeholder="Enter your middle name (optional)"
            />
          </div>

          <div className="form-group">
            <label htmlFor="editLastName">Last Name</label>
            <input
              type="text"
              id="editLastName"
              name="lastName"
              autoComplete="collection-name"
              value={editForm.last_name || ""}
              onChange={(e) =>
                setEditForm({ ...editForm, last_name: e.target.value || null })
              }
              placeholder="Enter your last name (optional)"
            />
          </div>

          <div className="form-group">
            <label htmlFor="editBirthday">Birthday</label>
            <input
              type="date"
              id="editBirthday"
              name="birthday"
              autoComplete="bday"
              value={editForm.birthday || ""}
              onChange={(e) =>
                setEditForm({ ...editForm, birthday: e.target.value || null })
              }
              placeholder="Select your birthday (optional)"
            />
          </div>

          {error && <div className="auth-error">{error}</div>}
        </div>
      </Modal>

      {/* Leave Collection Confirmation Modal */}
      <Modal
        isOpen={showLeaveCollectionModal && collectionToLeave !== null}
        mode="view"
        title="Leave Collection"
        onClose={handleCloseLeaveCollectionModal}
        showLeftButton={false}
        showRightButton={false}
        showDeleteButton={true}
        onDeleteAction={handleLeaveCollection}
        confirmBeforeDelete={false}
        deleteButtonText={leaveCollectionLoading ? "Leaving..." : "Leave Collection"}
        deleteButtonDisabled={!!leaveCollectionLoading}
        deleteButtonClass="delete-btn"
        maxWidth="500px"
      >
        <div className="leave-collection-content">
          <p>
            Are you sure you want to leave{" "}
            <strong>{collectionToLeave?.name}</strong>?
          </p>
          <p>
            You will no longer have access to photos and content shared in this
            collection group. You can rejoin later if invited again.
          </p>
        </div>
      </Modal>

      {/* Remove Member Confirmation Modal */}
      <Modal
        isOpen={showRemoveMemberModal && memberToRemove !== null}
        mode="view"
        title="Remove Collection Member"
        onClose={handleCloseRemoveMemberModal}
        showLeftButton={false}
        showRightButton={false}
        showDeleteButton={true}
        confirmBeforeDelete={false}
        onDeleteAction={handleRemoveMember}
        deleteButtonText="Remove Member"
        deleteButtonDisabled={false}
        deleteButtonClass="delete-btn"
        maxWidth="500px"
      >
        <div className="remove-member-content">
          <p>
            Are you sure you want to remove{" "}
            <strong>
              {memberToRemove?.first_name || "No"}{" "}
              {memberToRemove?.last_name || "Name"}
            </strong>{" "}
            from <strong>{selectedCollection?.name}</strong>?
          </p>
          <p>
            They will no longer have access to photos and content shared in this
            collection group. They can rejoin if invited again.
          </p>
        </div>
      </Modal>

      {/* Remove Related Collection Confirmation Modal */}
      <Modal
        isOpen={showRemoveRelatedCollectionModal && relatedCollectionToRemove !== null}
        mode="view"
        title="Remove Collection Relation"
        onClose={handleCloseRemoveRelatedCollectionModal}
        showLeftButton={false}
        showRightButton={false}
        showDeleteButton={true}
        confirmBeforeDelete={false}
        onDeleteAction={handleRemoveRelatedCollection}
        deleteButtonText="Remove Relation"
        deleteButtonDisabled={false}
        deleteButtonClass="delete-btn"
        maxWidth="500px"
      >
        <div className="remove-related-collection-content">
          <p>
            Are you sure you want to remove the relation with{" "}
            <strong>{relatedCollectionToRemove?.name}</strong>?
          </p>
          <p>
            This will remove the connection between your collections. The
            relation can be re-established later if needed.
          </p>
        </div>
      </Modal>
    </div>
  );
}

export default Account;

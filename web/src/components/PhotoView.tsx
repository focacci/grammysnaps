import { useState, useEffect } from "react";
import "./PhotoView.css";

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

interface Image {
  id: string;
  title?: string;
  filename: string;
  tags?: string[];
  family_ids?: string[];
  s3_url?: string;
  created_at?: string;
  updated_at?: string;
}

interface Tag {
  id: string;
  name: string;
  type: "Person" | "Location" | "Event" | "Time";
  family_id: string;
  created_at?: string;
  updated_at?: string;
}

interface PhotoViewProps {
  user: User;
}

function PhotoView({ user }: PhotoViewProps) {
  const [images, setImages] = useState<Image[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadTitle, setUploadTitle] = useState("");
  const [selectedUploadTags, setSelectedUploadTags] = useState<string[]>([]);
  const [selectedUploadFamilies, setSelectedUploadFamilies] = useState<
    string[]
  >([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [showCreateTagModal, setShowCreateTagModal] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [newTagType, setNewTagType] = useState<
    "Person" | "Location" | "Event" | "Time"
  >("Person");
  const [newTagFamilyId, setNewTagFamilyId] = useState<string>("");
  const [creatingTag, setCreatingTag] = useState(false);
  const [showEditTagModal, setShowEditTagModal] = useState(false);
  const [editingTag, setEditingTag] = useState<Tag | null>(null);
  const [editTagName, setEditTagName] = useState("");
  const [editTagType, setEditTagType] = useState<
    "Person" | "Location" | "Event" | "Time"
  >("Person");
  const [editTagFamilyId, setEditTagFamilyId] = useState<string>("");
  const [savingTag, setSavingTag] = useState(false);
  const [deletingTag, setDeletingTag] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [selectedImage, setSelectedImage] = useState<Image | null>(null);
  const [isEditingImage, setIsEditingImage] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editImageTags, setEditImageTags] = useState<string[]>([]);
  const [editImageFamilies, setEditImageFamilies] = useState<string[]>([]);
  const [savingImage, setSavingImage] = useState(false);
  const [deletingImage, setDeletingImage] = useState(false);

  // Family-related state
  const [familyGroups, setFamilyGroups] = useState<FamilyGroup[]>([]);
  const [selectedFamily, setSelectedFamily] = useState<string>("all");

  const [collapsedSections, setCollapsedSections] = useState<{
    [key: string]: boolean;
  }>({
    People: false,
    Places: false,
    Events: false,
    Time: false,
  });
  const [modalCollapsedSections, setModalCollapsedSections] = useState<{
    [key: string]: boolean;
  }>({
    People: false,
    Places: false,
    Events: false,
    Time: false,
  });

  // Function to load user's family groups
  // This function has been replaced by inline fetching in useEffect

  // Fetch data from API
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        // First fetch user's families
        const familiesResponse = await fetch(`/api/family/user/${user.id}`);
        if (!familiesResponse.ok) {
          throw new Error(
            `Failed to fetch families: ${familiesResponse.status}`
          );
        }
        const familiesData = await familiesResponse.json();
        setFamilyGroups(familiesData);

        // Set default family for new tags
        if (familiesData.length > 0 && !newTagFamilyId) {
          setNewTagFamilyId(familiesData[0].id);
        }

        // Fetch images and tags for all user's families in parallel
        const imagePromise = fetch("/api/image");
        const tagPromises = familiesData.map((family: FamilyGroup) =>
          fetch(`/api/tag/family/${family.id}`)
        );

        const [imagesResponse, ...tagResponses] = await Promise.all([
          imagePromise,
          ...tagPromises,
        ]);

        if (!imagesResponse.ok) {
          throw new Error(`Failed to fetch images: ${imagesResponse.status}`);
        }

        const imagesData = await imagesResponse.json();
        setImages(imagesData.images || []);

        // Combine tags from all families
        const allTags: Tag[] = [];
        for (const tagResponse of tagResponses) {
          if (tagResponse.ok) {
            const tagData = await tagResponse.json();
            allTags.push(...(tagData.tags || []));
          }
        }
        setTags(allTags);
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
        console.error("Error fetching data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user.id]);

  const handleTagToggle = (tagName: string) => {
    setSelectedTags((prev) =>
      prev.includes(tagName)
        ? prev.filter((t) => t !== tagName)
        : [...prev, tagName]
    );
  };

  const handleUploadTagToggle = (tagId: string) => {
    setSelectedUploadTags((prev) =>
      prev.includes(tagId) ? prev.filter((t) => t !== tagId) : [...prev, tagId]
    );
  };

  const handleUploadFamilyToggle = (familyId: string) => {
    setSelectedUploadFamilies((prev) =>
      prev.includes(familyId)
        ? prev.filter((f) => f !== familyId)
        : [...prev, familyId]
    );
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploadError(null); // Clear any previous errors

    if (!uploadFile) {
      setUploadError("Please select a file to upload");
      return;
    }

    // Validate family selection
    if (selectedUploadFamilies.length === 0) {
      setUploadError("Please select at least one family for this image");
      return;
    }

    // Validate file type
    const allowedTypes = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/gif",
      "image/webp",
    ];
    if (!allowedTypes.includes(uploadFile.type)) {
      setUploadError(
        "Please select a valid image file (JPEG, PNG, GIF, or WebP)"
      );
      return;
    }

    // Validate file size (10MB max)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (uploadFile.size > maxSize) {
      setUploadError("File is too large. Maximum size is 10MB.");
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", uploadFile);
      if (uploadTitle.trim()) {
        formData.append("title", uploadTitle.trim());
      }
      formData.append("tags", JSON.stringify(selectedUploadTags));
      formData.append("family_ids", JSON.stringify(selectedUploadFamilies));

      const response = await fetch("/api/image", {
        method: "POST",
        body: formData, // Don't set Content-Type header, let browser handle it
      });

      if (!response.ok) {
        throw new Error(`Failed to upload image: ${response.status}`);
      }

      const result = await response.json();

      // Add the new image to the list
      setImages((prev) => [result.image, ...prev]);

      // Reset form and close modal
      setUploadTitle("");
      setSelectedUploadTags([]);
      setSelectedUploadFamilies([]);
      setUploadFile(null);
      setShowUploadModal(false);
    } catch (err) {
      console.error("Error uploading image:", err);
      setUploadError(
        err instanceof Error ? err.message : "Failed to upload image"
      );
    } finally {
      setUploading(false);
    }
  };

  const closeModal = () => {
    setShowUploadModal(false);
    setUploadTitle("");
    setSelectedUploadTags([]);
    setSelectedUploadFamilies([]);
    setUploadFile(null);
    setUploadError(null);
    setDragOver(false);
  };

  const handleFileSelect = (file: File) => {
    setUploadFile(file);
    // Don't auto-populate title with filename
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      // Validate file type
      const allowedTypes = [
        "image/jpeg",
        "image/jpg",
        "image/png",
        "image/gif",
        "image/webp",
      ];
      if (allowedTypes.includes(file.type)) {
        handleFileSelect(file);
      } else {
        alert("Please select a valid image file (JPEG, PNG, GIF, or WebP)");
      }
    }
  };

  const handleCreateTagSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTagName.trim()) {
      alert("Please enter a tag name");
      return;
    }
    if (!newTagFamilyId) {
      alert("Must select a family group");
      return;
    }

    setCreatingTag(true);
    try {
      const response = await fetch("/api/tag", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: newTagName.trim(),
          type: newTagType,
          family_id: newTagFamilyId,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to create tag: ${response.status}`);
      }

      const result = await response.json();

      // Add the new tag to the list
      setTags((prev) => [...prev, result.tag]);

      // Reset form and close modal
      setNewTagName("");
      setNewTagType("Person");
      // Don't reset family selection to keep the same family selected
      setShowCreateTagModal(false);
    } catch (err) {
      console.error("Error creating tag:", err);
      alert(err instanceof Error ? err.message : "Failed to create tag");
    } finally {
      setCreatingTag(false);
    }
  };

  const closeCreateTagModal = () => {
    setShowCreateTagModal(false);
    setNewTagName("");
    setNewTagType("Person");
    // Keep the family selection for next time
  };

  const handleEditTag = (tag: Tag) => {
    setEditingTag(tag);
    setEditTagName(tag.name);
    setEditTagType(tag.type);
    setEditTagFamilyId(tag.family_id);
    setShowEditTagModal(true);
  };

  const closeEditTagModal = () => {
    setShowEditTagModal(false);
    setEditingTag(null);
    setEditTagName("");
    setEditTagType("Person");
    setEditTagFamilyId("");
  };

  const handleEditTagSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTag || !editTagName.trim()) {
      alert("Please enter a tag name");
      return;
    }
    if (!editTagFamilyId) {
      alert("Must select a family group");
      return;
    }

    setSavingTag(true);
    try {
      const response = await fetch(`/api/tag/${editingTag.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: editTagName.trim(),
          type: editTagType,
          family_id: editTagFamilyId,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to update tag: ${response.status}`);
      }

      const result = await response.json();

      // Update the tag in the list
      setTags((prev) =>
        prev.map((tag) => (tag.id === editingTag.id ? result.tag : tag))
      );

      closeEditTagModal();
    } catch (err) {
      console.error("Error updating tag:", err);
      alert(err instanceof Error ? err.message : "Failed to update tag");
    } finally {
      setSavingTag(false);
    }
  };

  const handleDeleteTag = async () => {
    if (!editingTag) return;

    setDeletingTag(true);
    try {
      const response = await fetch(`/api/tag/${editingTag.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error(`Failed to delete tag: ${response.status}`);
      }

      // Remove the tag from the list
      setTags((prev) => prev.filter((tag) => tag.id !== editingTag.id));

      // Remove the tag from selected tags if it was selected
      setSelectedTags((prev) =>
        prev.filter((tagName) => tagName !== editingTag.name)
      );

      // Remove the tag from any images that have it
      setImages((prev) =>
        prev.map((image) => ({
          ...image,
          tags: image.tags?.filter((tagId) => tagId !== editingTag.id) || [],
        }))
      );

      closeEditTagModal();
    } catch (err) {
      console.error("Error deleting tag:", err);
      alert(err instanceof Error ? err.message : "Failed to delete tag");
    } finally {
      setDeletingTag(false);
    }
  };

  const handleImageClick = (image: Image) => {
    setSelectedImage(image);
    setEditTitle(image.title || "");
    setEditImageTags(image.tags || []);
    setEditImageFamilies(image.family_ids || []);
    setIsEditingImage(false);
    setShowImageModal(true);
  };

  const closeImageModal = () => {
    setShowImageModal(false);
    setSelectedImage(null);
    setIsEditingImage(false);
    setEditTitle("");
    setEditImageTags([]);
    setEditImageFamilies([]);
  };

  const handleEditToggle = () => {
    setIsEditingImage(!isEditingImage);
    if (selectedImage && !isEditingImage) {
      setEditTitle(selectedImage.title || "");
      setEditImageTags(selectedImage.tags || []);
      setEditImageFamilies(selectedImage.family_ids || []);
    }
  };

  const handleEditImageTagToggle = (tagId: string) => {
    setEditImageTags((prev) =>
      prev.includes(tagId) ? prev.filter((t) => t !== tagId) : [...prev, tagId]
    );
  };

  const handleEditImageFamilyToggle = (familyId: string) => {
    setEditImageFamilies((prev) => {
      const newFamilies = prev.includes(familyId)
        ? prev.filter((f) => f !== familyId)
        : [...prev, familyId];

      // Ensure at least one family is always selected
      return newFamilies.length === 0 ? prev : newFamilies;
    });
  };

  const handleSaveImage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedImage) {
      alert("No image selected");
      return;
    }

    // Validate that at least one family is selected
    if (editImageFamilies.length === 0) {
      alert("Please select at least one family for this image");
      return;
    }

    setSavingImage(true);
    try {
      const response = await fetch(`/api/image/${selectedImage.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: editTitle.trim() || null,
          tags: editImageTags,
          family_ids: editImageFamilies,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to update image: ${response.status}`);
      }

      const result = await response.json();

      // Update the image in the list
      setImages((prev) =>
        prev.map((img) => (img.id === selectedImage.id ? result.image : img))
      );

      // Update selected image
      setSelectedImage(result.image);
      setIsEditingImage(false);
    } catch (err) {
      console.error("Error updating image:", err);
      alert(err instanceof Error ? err.message : "Failed to update image");
    } finally {
      setSavingImage(false);
    }
  };

  const handleDeleteImage = async () => {
    if (!selectedImage) return;

    setDeletingImage(true);
    try {
      const response = await fetch(`/api/image/${selectedImage.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error(`Failed to delete image: ${response.status}`);
      }

      // Remove the image from the list
      setImages((prev) => prev.filter((img) => img.id !== selectedImage.id));

      // Close the modal
      closeImageModal();
    } catch (err) {
      console.error("Error deleting image:", err);
      alert(err instanceof Error ? err.message : "Failed to delete image");
    } finally {
      setDeletingImage(false);
    }
  };

  const handleDownloadImage = async () => {
    if (!selectedImage) return;

    try {
      const response = await fetch(`/api/image/${selectedImage.id}/download`);

      if (!response.ok) {
        throw new Error(`Failed to download image: ${response.status}`);
      }

      // Create a blob from the response
      const blob = await response.blob();

      // Create a download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = selectedImage.filename;

      // Trigger the download
      document.body.appendChild(link);
      link.click();

      // Clean up
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Error downloading image:", err);
      alert(err instanceof Error ? err.message : "Failed to download image");
    }
  };

  const toggleSection = (sectionName: string) => {
    setCollapsedSections((prev) => ({
      ...prev,
      [sectionName]: !prev[sectionName],
    }));
  };

  const toggleModalSection = (sectionName: string) => {
    setModalCollapsedSections((prev) => ({
      ...prev,
      [sectionName]: !prev[sectionName],
    }));
  };

  // Group tags by family and then by type
  const tagsByFamilyAndType = familyGroups
    .filter(
      (family) => selectedFamily === "all" || family.id === selectedFamily
    )
    .reduce(
      (acc, family) => {
        const familyTags = tags.filter((tag) => tag.family_id === family.id);
        acc[family.id] = {
          familyName: family.name,
          familyId: family.id,
          tagsByType: {
            People: familyTags.filter((tag) => tag.type === "Person"),
            Places: familyTags.filter((tag) => tag.type === "Location"),
            Events: familyTags.filter((tag) => tag.type === "Event"),
            Time: familyTags.filter((tag) => tag.type === "Time"),
          },
        };
        return acc;
      },
      {} as Record<
        string,
        {
          familyName: string;
          familyId: string;
          tagsByType: {
            People: Tag[];
            Places: Tag[];
            Events: Tag[];
            Time: Tag[];
          };
        }
      >
    );

  const filteredImages = images.filter((image) => {
    // Filter by tags first
    if (selectedTags.length > 0) {
      // Convert selected tag names to tag IDs
      const selectedTagIds = selectedTags
        .map((tagName) => tags.find((tag) => tag.name === tagName)?.id)
        .filter((tagId): tagId is string => tagId !== undefined);

      // Check if image has ALL of the selected tag IDs (AND logic)
      const hasAllSelectedTags = selectedTagIds.every((tagId) =>
        image.tags?.includes(tagId)
      );
      if (!hasAllSelectedTags) return false;
    }

    // Filter by family if not "all"
    if (selectedFamily !== "all") {
      // For now, we'll show all images when a family is selected
      // TODO: Implement family-specific image filtering when family_id is added to images
      // This would require adding family_id to the Image interface and backend
    }

    return true;
  });

  if (loading) {
    return (
      <div className="photo-view">
        <div className="loading-container">
          <div className="loading-spinner">Loading photos...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="photo-view">
        <div className="error-container">
          <div className="error-message">
            <h3>Error loading photos</h3>
            <p>{error}</p>
            <button onClick={() => window.location.reload()}>Retry</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="photo-view">
      <div className="content-layout">
        {/* Filter Sidebar */}
        <aside className="filter-sidebar">
          <div className="sidebar-header">
            <h3>Filter by Tags</h3>
          </div>
          <div className="create-tag-section">
            <button
              className="create-tag-btn"
              onClick={() => setShowCreateTagModal(true)}
            >
              + Create Tag
            </button>
          </div>
          <div className="filter-sections">
            {Object.entries(tagsByFamilyAndType).map(
              ([familyId, familyData]) => (
                <div key={familyId} className="filter-section">
                  <button
                    className="section-header"
                    onClick={() => toggleSection(`family-${familyId}`)}
                    aria-expanded={!collapsedSections[`family-${familyId}`]}
                  >
                    <span
                      className={`section-caret ${
                        collapsedSections[`family-${familyId}`]
                          ? "collapsed"
                          : ""
                      }`}
                    >
                      ▼
                    </span>
                    <span className="section-title">
                      {familyData.familyName}
                    </span>
                  </button>
                  {!collapsedSections[`family-${familyId}`] && (
                    <div className="filter-list">
                      {Object.entries(familyData.tagsByType).map(
                        ([tagType, typeTags]) =>
                          typeTags.length > 0 && (
                            <div
                              key={`${familyId}-${tagType}`}
                              className="filter-section"
                            >
                              <button
                                className="section-header"
                                onClick={() =>
                                  toggleSection(`${familyId}-${tagType}`)
                                }
                                aria-expanded={
                                  !collapsedSections[`${familyId}-${tagType}`]
                                }
                                style={{ paddingLeft: "1rem" }}
                              >
                                <span
                                  className={`section-caret ${
                                    collapsedSections[`${familyId}-${tagType}`]
                                      ? "collapsed"
                                      : ""
                                  }`}
                                >
                                  ▼
                                </span>
                                <span className="section-title">{tagType}</span>
                              </button>
                              {!collapsedSections[`${familyId}-${tagType}`] && (
                                <div
                                  className="filter-list"
                                  style={{ paddingLeft: "1rem" }}
                                >
                                  {typeTags.map((tag) => (
                                    <div
                                      key={tag.id}
                                      className={`filter-item ${
                                        selectedTags.includes(tag.name)
                                          ? "selected"
                                          : ""
                                      }`}
                                    >
                                      <span
                                        className="filter-label"
                                        onClick={() =>
                                          handleTagToggle(tag.name)
                                        }
                                      >
                                        {tag.name}
                                      </span>
                                      <div className="filter-item-actions">
                                        <button
                                          className="edit-tag-btn"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleEditTag(tag);
                                          }}
                                          title="Edit tag"
                                        >
                                          ✏️
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )
                      )}
                    </div>
                  )}
                </div>
              )
            )}
          </div>
        </aside>

        {/* Image Grid */}
        <section className="image-grid-container">
          <div className="upload-section">
            <div className="upload-controls">
              <button
                className="upload-btn-main"
                onClick={() => setShowUploadModal(true)}
              >
                + Upload Image
              </button>

              <div className="family-filter">
                <label htmlFor="family-select">Family:</label>
                <select
                  id="family-select"
                  value={selectedFamily}
                  onChange={(e) => setSelectedFamily(e.target.value)}
                  className="family-dropdown"
                >
                  <option value="all">All Families</option>
                  {familyGroups.map((family) => (
                    <option key={family.id} value={family.id}>
                      {family.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          {filteredImages.length === 0 ? (
            <div className="empty-state">
              <p>
                No images found{" "}
                {selectedTags.length > 0 ? "with selected tags" : ""}
              </p>
            </div>
          ) : (
            <div className="image-grid">
              {filteredImages.map((image) => (
                <div
                  key={image.id}
                  className="image-card"
                  onClick={() => handleImageClick(image)}
                >
                  {image.s3_url ? (
                    <div className="image-container">
                      <img
                        src={image.s3_url}
                        alt={image.filename}
                        className="image-display"
                        onError={(e) => {
                          // Fallback to placeholder if image fails to load
                          e.currentTarget.style.display = "none";
                          e.currentTarget.parentElement!.innerHTML =
                            '<div class="image-placeholder"><span>📸</span></div>';
                        }}
                      />
                    </div>
                  ) : (
                    <div className="image-placeholder">
                      <span>📸</span>
                    </div>
                  )}
                  <div className="image-info">
                    <h4>{image.title || image.filename}</h4>
                    <div className="image-tags">
                      {image.tags?.map((tagId, index) => (
                        <span key={index} className="tag-chip">
                          {tags.find((tag) => tag.id === tagId)?.name ||
                            "*Unnamed Tag*"}
                        </span>
                      )) || <span className="no-tags">No tags</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Upload New Image</h2>
              <button className="close-btn" onClick={closeModal}>
                ×
              </button>
            </div>
            <form onSubmit={handleUploadSubmit} className="upload-form">
              <div className="form-group">
                <label>Select Image File:</label>
                <div
                  className={`file-drop-zone ${dragOver ? "drag-over" : ""}`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  {uploadFile ? (
                    <div className="file-selected">
                      <span className="file-icon">📁</span>
                      <span className="file-name">{uploadFile.name}</span>
                      <span className="file-size">
                        ({(uploadFile.size / 1024 / 1024).toFixed(2)} MB)
                      </span>
                      <button
                        type="button"
                        className="remove-file-btn"
                        onClick={() => {
                          setUploadFile(null);
                          setUploadTitle("");
                        }}
                      >
                        ×
                      </button>
                    </div>
                  ) : (
                    <div className="file-drop-content">
                      <span className="drop-icon">📤</span>
                      <p>Drag and drop an image here, or</p>
                      <button
                        type="button"
                        className="browse-btn"
                        onClick={() =>
                          document.getElementById("file-input")?.click()
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
                  id="file-input"
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                  onChange={handleFileInputChange}
                  style={{ display: "none" }}
                />
              </div>

              <div className="form-group">
                <label htmlFor="title">Title (optional):</label>
                <input
                  id="title"
                  type="text"
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  placeholder="Enter image title"
                />
              </div>

              <div className="form-group">
                <label>Select Families (required):</label>
                <div className="family-selection">
                  {familyGroups.length > 0 ? (
                    familyGroups.map((family) => (
                      <div
                        key={family.id}
                        className={`family-checkbox ${
                          selectedUploadFamilies.includes(family.id)
                            ? "selected"
                            : ""
                        }`}
                        onClick={() => handleUploadFamilyToggle(family.id)}
                      >
                        <span>{family.name}</span>
                      </div>
                    ))
                  ) : (
                    <div className="empty-families-message">
                      <span>
                        You are not a member of any families. Please join or
                        create a family to upload photos.
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {uploadError && (
                <div className="upload-error-message">{uploadError}</div>
              )}

              <div className="form-group">
                <label>Select Tags:</label>
                <div className="tag-selection">
                  {Object.entries(tagsByFamilyAndType).map(
                    ([familyId, familyData]) => (
                      <div key={familyId} className="filter-section">
                        <button
                          type="button"
                          className="section-header"
                          onClick={() =>
                            toggleModalSection(`family-${familyId}`)
                          }
                          aria-expanded={
                            !modalCollapsedSections[`family-${familyId}`]
                          }
                        >
                          <span
                            className={`section-caret ${
                              modalCollapsedSections[`family-${familyId}`]
                                ? "collapsed"
                                : ""
                            }`}
                          >
                            ▼
                          </span>
                          <span className="section-title">
                            {familyData.familyName}
                          </span>
                        </button>
                        {!modalCollapsedSections[`family-${familyId}`] && (
                          <div className="filter-list">
                            {Object.entries(familyData.tagsByType).map(
                              ([tagType, typeTags]) =>
                                typeTags.length > 0 && (
                                  <div
                                    key={`${familyId}-${tagType}`}
                                    className="filter-section"
                                  >
                                    <button
                                      type="button"
                                      className="section-header"
                                      onClick={() =>
                                        toggleModalSection(
                                          `${familyId}-${tagType}`
                                        )
                                      }
                                      aria-expanded={
                                        !modalCollapsedSections[
                                          `${familyId}-${tagType}`
                                        ]
                                      }
                                      style={{ paddingLeft: "1rem" }}
                                    >
                                      <span
                                        className={`section-caret ${
                                          modalCollapsedSections[
                                            `${familyId}-${tagType}`
                                          ]
                                            ? "collapsed"
                                            : ""
                                        }`}
                                      >
                                        ▼
                                      </span>
                                      <span className="section-title">
                                        {tagType}
                                      </span>
                                    </button>
                                    {!modalCollapsedSections[
                                      `${familyId}-${tagType}`
                                    ] && (
                                      <div
                                        className="filter-list"
                                        style={{ paddingLeft: "1rem" }}
                                      >
                                        <div className="tag-checkboxes">
                                          {typeTags.map((tag) => (
                                            <div
                                              key={tag.id}
                                              className={`tag-checkbox ${
                                                selectedUploadTags.includes(
                                                  tag.id
                                                )
                                                  ? "selected"
                                                  : ""
                                              }`}
                                              onClick={() =>
                                                handleUploadTagToggle(tag.id)
                                              }
                                            >
                                              <span>{tag.name}</span>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )
                            )}
                          </div>
                        )}
                      </div>
                    )
                  )}
                </div>
              </div>

              <div className="form-actions">
                <button
                  type="button"
                  onClick={closeModal}
                  className="cancel-btn"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={
                    uploading || !uploadFile || familyGroups.length === 0
                  }
                  className="submit-btn"
                >
                  {uploading ? "Uploading..." : "Upload Image"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Tag Modal */}
      {showCreateTagModal && (
        <div className="modal-overlay" onClick={closeCreateTagModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Create New Tag</h2>
              <button className="close-btn" onClick={closeCreateTagModal}>
                ×
              </button>
            </div>
            <form onSubmit={handleCreateTagSubmit} className="upload-form">
              <div className="form-group">
                <label htmlFor="tagName">Tag Name:</label>
                <input
                  id="tagName"
                  type="text"
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  placeholder="Enter tag name"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="tagType">Tag Type:</label>
                <select
                  id="tagType"
                  value={newTagType}
                  onChange={(e) =>
                    setNewTagType(
                      e.target.value as "Person" | "Location" | "Event" | "Time"
                    )
                  }
                  className="tag-type-select"
                >
                  <option value="Person">Person</option>
                  <option value="Location">Location</option>
                  <option value="Event">Event</option>
                  <option value="Time">Time</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="tagFamily">Family:</label>
                <select
                  id="tagFamily"
                  value={newTagFamilyId}
                  onChange={(e) => setNewTagFamilyId(e.target.value)}
                  className="tag-type-select"
                  required
                >
                  <option value="">Select a family</option>
                  {familyGroups.map((family) => (
                    <option key={family.id} value={family.id}>
                      {family.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-actions">
                <button
                  type="button"
                  onClick={closeCreateTagModal}
                  className="cancel-btn"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingTag}
                  className="submit-btn"
                >
                  {creatingTag ? "Creating..." : "Create Tag"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Image Preview Modal */}
      {showImageModal && selectedImage && (
        <div className="modal-overlay" onClick={closeImageModal}>
          <div
            className="modal-content image-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h2>{isEditingImage ? "Edit Image" : "Image Preview"}</h2>
              <div className="modal-header-actions">
                {!isEditingImage && (
                  <>
                    <button
                      className="download-btn"
                      onClick={handleDownloadImage}
                      type="button"
                      title="Download image"
                    >
                      Download
                    </button>
                    <button
                      className="edit-btn"
                      onClick={handleEditToggle}
                      type="button"
                    >
                      Edit
                    </button>
                  </>
                )}
                <button className="close-btn" onClick={closeImageModal}>
                  ×
                </button>
              </div>
            </div>

            <div className="image-preview-content">
              {/* Always show image preview */}
              {selectedImage.s3_url ? (
                <div className="image-preview-container">
                  <img
                    src={selectedImage.s3_url}
                    alt={selectedImage.filename}
                    className="image-preview-display"
                    onError={(e) => {
                      // Fallback to placeholder if image fails to load
                      e.currentTarget.style.display = "none";
                      e.currentTarget.parentElement!.innerHTML =
                        '<div class="image-preview-placeholder"><span>📸</span></div>';
                    }}
                  />
                </div>
              ) : (
                <div className="image-preview-placeholder">
                  <span>📸</span>
                </div>
              )}

              {!isEditingImage ? (
                <>
                  <div className="image-preview-info">
                    <h3>{selectedImage.title || selectedImage.filename}</h3>
                    {selectedImage.title && (
                      <p className="image-filename">
                        File: {selectedImage.filename}
                      </p>
                    )}
                    <div className="image-tags">
                      {selectedImage.tags?.map((tagId, index) => (
                        <span key={index} className="tag-chip">
                          {tags.find((tag) => tag.id === tagId)?.name ||
                            "*Unnamed Tag*"}
                        </span>
                      )) || <span className="no-tags">No tags</span>}
                    </div>
                    {selectedImage.created_at && (
                      <p className="image-date">
                        Created:{" "}
                        {new Date(
                          selectedImage.created_at
                        ).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </>
              ) : (
                <form onSubmit={handleSaveImage} className="upload-form">
                  <div className="form-group">
                    <label htmlFor="editTitle">Title (optional):</label>
                    <input
                      id="editTitle"
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      placeholder="Enter image title"
                    />
                  </div>

                  <div className="form-group">
                    <label>Select Families:</label>
                    <div className="family-selection">
                      {familyGroups.length > 0 ? (
                        familyGroups.map((family) => (
                          <div
                            key={family.id}
                            className={`family-checkbox ${
                              editImageFamilies.includes(family.id)
                                ? "selected"
                                : ""
                            }`}
                            onClick={() =>
                              handleEditImageFamilyToggle(family.id)
                            }
                          >
                            <span>{family.name}</span>
                          </div>
                        ))
                      ) : (
                        <div className="empty-families-message">
                          <span>
                            You must be a member of at least one family to edit
                            images.
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Select Tags:</label>
                    <div className="tag-selection">
                      {Object.entries(tagsByFamilyAndType).map(
                        ([familyId, familyData]) => (
                          <div key={familyId} className="filter-section">
                            <button
                              type="button"
                              className="section-header"
                              onClick={() =>
                                toggleModalSection(`family-${familyId}`)
                              }
                              aria-expanded={
                                !modalCollapsedSections[`family-${familyId}`]
                              }
                            >
                              <span
                                className={`section-caret ${
                                  modalCollapsedSections[`family-${familyId}`]
                                    ? "collapsed"
                                    : ""
                                }`}
                              >
                                ▼
                              </span>
                              <span className="section-title">
                                {familyData.familyName}
                              </span>
                            </button>
                            {!modalCollapsedSections[`family-${familyId}`] && (
                              <div className="filter-list">
                                {Object.entries(familyData.tagsByType).map(
                                  ([tagType, typeTags]) =>
                                    typeTags.length > 0 && (
                                      <div
                                        key={`${familyId}-${tagType}`}
                                        className="filter-section"
                                      >
                                        <button
                                          type="button"
                                          className="section-header"
                                          onClick={() =>
                                            toggleModalSection(
                                              `${familyId}-${tagType}`
                                            )
                                          }
                                          aria-expanded={
                                            !modalCollapsedSections[
                                              `${familyId}-${tagType}`
                                            ]
                                          }
                                          style={{ paddingLeft: "1rem" }}
                                        >
                                          <span
                                            className={`section-caret ${
                                              modalCollapsedSections[
                                                `${familyId}-${tagType}`
                                              ]
                                                ? "collapsed"
                                                : ""
                                            }`}
                                          >
                                            ▼
                                          </span>
                                          <span className="section-title">
                                            {tagType}
                                          </span>
                                        </button>
                                        {!modalCollapsedSections[
                                          `${familyId}-${tagType}`
                                        ] && (
                                          <div
                                            className="filter-list"
                                            style={{ paddingLeft: "1rem" }}
                                          >
                                            <div className="tag-checkboxes">
                                              {typeTags.map((tag) => (
                                                <div
                                                  key={tag.id}
                                                  className={`tag-checkbox ${
                                                    editImageTags.includes(
                                                      tag.id
                                                    )
                                                      ? "selected"
                                                      : ""
                                                  }`}
                                                  onClick={() =>
                                                    handleEditImageTagToggle(
                                                      tag.id
                                                    )
                                                  }
                                                >
                                                  <span>{tag.name}</span>
                                                </div>
                                              ))}
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    )
                                )}
                              </div>
                            )}
                          </div>
                        )
                      )}
                    </div>
                  </div>

                  <div className="form-actions">
                    <button
                      type="button"
                      onClick={handleDeleteImage}
                      disabled={deletingImage}
                      className="delete-btn"
                    >
                      {deletingImage ? "Deleting..." : "Delete Image"}
                    </button>
                    <div className="form-actions-right">
                      <button
                        type="button"
                        onClick={handleEditToggle}
                        className="cancel-btn"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={savingImage}
                        className="submit-btn"
                      >
                        {savingImage ? "Saving..." : "Save Changes"}
                      </button>
                    </div>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Edit Tag Modal */}
      {showEditTagModal && editingTag && (
        <div className="modal-overlay" onClick={closeEditTagModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Edit Tag</h2>
              <button className="close-btn" onClick={closeEditTagModal}>
                ×
              </button>
            </div>
            <form onSubmit={handleEditTagSubmit} className="upload-form">
              <div className="form-group">
                <label htmlFor="editTagName">Tag Name:</label>
                <input
                  id="editTagName"
                  type="text"
                  value={editTagName}
                  onChange={(e) => setEditTagName(e.target.value)}
                  placeholder="Enter tag name"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="editTagType">Tag Type:</label>
                <select
                  id="editTagType"
                  value={editTagType}
                  onChange={(e) =>
                    setEditTagType(
                      e.target.value as "Person" | "Location" | "Event" | "Time"
                    )
                  }
                  className="tag-type-select"
                >
                  <option value="Person">Person</option>
                  <option value="Location">Location</option>
                  <option value="Event">Event</option>
                  <option value="Time">Time</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="editTagFamily">Family:</label>
                <select
                  id="editTagFamily"
                  value={editTagFamilyId}
                  onChange={(e) => setEditTagFamilyId(e.target.value)}
                  className="tag-type-select"
                  required
                >
                  <option value="">Select a family</option>
                  {familyGroups.map((family) => (
                    <option key={family.id} value={family.id}>
                      {family.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-actions">
                <button
                  type="button"
                  onClick={handleDeleteTag}
                  disabled={deletingTag}
                  className="delete-btn"
                >
                  {deletingTag ? "Deleting..." : "Delete Tag"}
                </button>
                <div className="form-actions-right">
                  <button
                    type="button"
                    onClick={closeEditTagModal}
                    className="cancel-btn"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingTag}
                    className="submit-btn"
                  >
                    {savingTag ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default PhotoView;

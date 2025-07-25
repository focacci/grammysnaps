import { useState, useEffect } from "react";
import "./PhotoView.css";

// Type definitions
interface Image {
  id: string;
  title?: string;
  filename: string;
  tags?: string[];
  s3_url?: string;
  created_at?: string;
  updated_at?: string;
}

interface Tag {
  id: string;
  name: string;
  type: "Person" | "Location" | "Event" | "Time";
  created_at?: string;
  updated_at?: string;
}

function PhotoView() {
  const [images, setImages] = useState<Image[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadTitle, setUploadTitle] = useState("");
  const [selectedUploadTags, setSelectedUploadTags] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [showCreateTagModal, setShowCreateTagModal] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [newTagType, setNewTagType] = useState<
    "Person" | "Location" | "Event" | "Time"
  >("Person");
  const [creatingTag, setCreatingTag] = useState(false);
  const [showEditTagModal, setShowEditTagModal] = useState(false);
  const [editingTag, setEditingTag] = useState<Tag | null>(null);
  const [editTagName, setEditTagName] = useState("");
  const [editTagType, setEditTagType] = useState<
    "Person" | "Location" | "Event" | "Time"
  >("Person");
  const [savingTag, setSavingTag] = useState(false);
  const [deletingTag, setDeletingTag] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [selectedImage, setSelectedImage] = useState<Image | null>(null);
  const [isEditingImage, setIsEditingImage] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editImageTags, setEditImageTags] = useState<string[]>([]);
  const [savingImage, setSavingImage] = useState(false);
  const [deletingImage, setDeletingImage] = useState(false);
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

  // Fetch data from API
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch images and tags in parallel
        const [imagesResponse, tagsResponse] = await Promise.all([
          fetch("/api/image"),
          fetch("/api/tag"),
        ]);

        if (!imagesResponse.ok) {
          throw new Error(`Failed to fetch images: ${imagesResponse.status}`);
        }
        if (!tagsResponse.ok) {
          throw new Error(`Failed to fetch tags: ${tagsResponse.status}`);
        }

        const imagesData = await imagesResponse.json();
        const tagsData = await tagsResponse.json();

        setImages(imagesData.images || []);
        setTags(tagsData.tags || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
        console.error("Error fetching data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

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

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) {
      alert("Please select a file to upload");
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
      alert("Please select a valid image file (JPEG, PNG, GIF, or WebP)");
      return;
    }

    // Validate file size (10MB max)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (uploadFile.size > maxSize) {
      alert("File is too large. Maximum size is 10MB.");
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
      setUploadFile(null);
      setShowUploadModal(false);
    } catch (err) {
      console.error("Error uploading image:", err);
      alert(err instanceof Error ? err.message : "Failed to upload image");
    } finally {
      setUploading(false);
    }
  };

  const closeModal = () => {
    setShowUploadModal(false);
    setUploadTitle("");
    setSelectedUploadTags([]);
    setUploadFile(null);
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
  };

  const handleEditTag = (tag: Tag) => {
    setEditingTag(tag);
    setEditTagName(tag.name);
    setEditTagType(tag.type);
    setShowEditTagModal(true);
  };

  const closeEditTagModal = () => {
    setShowEditTagModal(false);
    setEditingTag(null);
    setEditTagName("");
    setEditTagType("Person");
  };

  const handleEditTagSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTag || !editTagName.trim()) {
      alert("Please enter a tag name");
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
    setIsEditingImage(false);
    setShowImageModal(true);
  };

  const closeImageModal = () => {
    setShowImageModal(false);
    setSelectedImage(null);
    setIsEditingImage(false);
    setEditTitle("");
    setEditImageTags([]);
  };

  const handleEditToggle = () => {
    setIsEditingImage(!isEditingImage);
    if (selectedImage && !isEditingImage) {
      setEditTitle(selectedImage.title || "");
      setEditImageTags(selectedImage.tags || []);
    }
  };

  const handleEditImageTagToggle = (tagId: string) => {
    setEditImageTags((prev) =>
      prev.includes(tagId) ? prev.filter((t) => t !== tagId) : [...prev, tagId]
    );
  };

  const handleSaveImage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedImage) {
      alert("No image selected");
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

  // Group tags by type
  const groupedTags = {
    People: tags.filter((tag) => tag.type === "Person"),
    Places: tags.filter((tag) => tag.type === "Location"),
    Events: tags.filter((tag) => tag.type === "Event"),
    Time: tags.filter((tag) => tag.type === "Time"),
  };

  const filteredImages =
    selectedTags.length === 0
      ? images
      : images.filter((image) => {
          // Convert selected tag names to tag IDs
          const selectedTagIds = selectedTags
            .map((tagName) => tags.find((tag) => tag.name === tagName)?.id)
            .filter((tagId): tagId is string => tagId !== undefined);

          // Check if image has ALL of the selected tag IDs (AND logic)
          return selectedTagIds.every((tagId) => image.tags?.includes(tagId));
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
            {Object.entries(groupedTags).map(
              ([sectionName, sectionTags]) =>
                sectionTags.length > 0 && (
                  <div key={sectionName} className="filter-section">
                    <button
                      className="section-header"
                      onClick={() => toggleSection(sectionName)}
                      aria-expanded={!collapsedSections[sectionName]}
                    >
                      <span
                        className={`section-caret ${
                          collapsedSections[sectionName] ? "collapsed" : ""
                        }`}
                      >
                        ▼
                      </span>
                      <span className="section-title">{sectionName}</span>
                    </button>
                    {!collapsedSections[sectionName] && (
                      <div className="filter-list">
                        {sectionTags.map((tag) => (
                          <div
                            key={tag.id}
                            className={`filter-item ${
                              selectedTags.includes(tag.name) ? "selected" : ""
                            }`}
                          >
                            <span
                              className="filter-label"
                              onClick={() => handleTagToggle(tag.name)}
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
        </aside>

        {/* Image Grid */}
        <section className="image-grid-container">
          <div className="upload-section">
            <button
              className="upload-btn-main"
              onClick={() => setShowUploadModal(true)}
            >
              + Upload Image
            </button>
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
                <label>Select Tags:</label>
                <div className="tag-selection">
                  {Object.entries(groupedTags).map(
                    ([sectionName, sectionTags]) =>
                      sectionTags.length > 0 && (
                        <div key={sectionName} className="filter-section">
                          <button
                            type="button"
                            className="section-header"
                            onClick={() => toggleModalSection(sectionName)}
                            aria-expanded={!modalCollapsedSections[sectionName]}
                          >
                            <span
                              className={`section-caret ${
                                modalCollapsedSections[sectionName]
                                  ? "collapsed"
                                  : ""
                              }`}
                            >
                              ▼
                            </span>
                            <span className="section-title">{sectionName}</span>
                          </button>
                          {!modalCollapsedSections[sectionName] && (
                            <div className="filter-list">
                              <div className="tag-checkboxes">
                                {sectionTags.map((tag) => (
                                  <div
                                    key={tag.id}
                                    className={`tag-checkbox ${
                                      selectedUploadTags.includes(tag.id)
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
                  disabled={uploading || !uploadFile}
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
                    <label>Select Tags:</label>
                    <div className="tag-selection">
                      {Object.entries(groupedTags).map(
                        ([sectionName, sectionTags]) =>
                          sectionTags.length > 0 && (
                            <div key={sectionName} className="filter-section">
                              <button
                                type="button"
                                className="section-header"
                                onClick={() => toggleModalSection(sectionName)}
                                aria-expanded={
                                  !modalCollapsedSections[sectionName]
                                }
                              >
                                <span
                                  className={`section-caret ${
                                    modalCollapsedSections[sectionName]
                                      ? "collapsed"
                                      : ""
                                  }`}
                                >
                                  ▼
                                </span>
                                <span className="section-title">
                                  {sectionName}
                                </span>
                              </button>
                              {!modalCollapsedSections[sectionName] && (
                                <div className="filter-list">
                                  <div className="tag-checkboxes">
                                    {sectionTags.map((tag) => (
                                      <div
                                        key={tag.id}
                                        className={`tag-checkbox ${
                                          editImageTags.includes(tag.id)
                                            ? "selected"
                                            : ""
                                        }`}
                                        onClick={() =>
                                          handleEditImageTagToggle(tag.id)
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

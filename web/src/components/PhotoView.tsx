import { useState, useEffect } from "react";

// Type definitions
interface Image {
  id: string;
  filename: string;
  tags?: string[];
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
  const [uploadFilename, setUploadFilename] = useState("");
  const [selectedUploadTags, setSelectedUploadTags] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [showCreateTagModal, setShowCreateTagModal] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [newTagType, setNewTagType] = useState<
    "Person" | "Location" | "Event" | "Time"
  >("Person");
  const [creatingTag, setCreatingTag] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<{
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
    if (!uploadFilename.trim()) {
      alert("Please enter a filename");
      return;
    }

    setUploading(true);
    try {
      const response = await fetch("/api/image", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          filename: uploadFilename.trim(),
          tags: selectedUploadTags,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to upload image: ${response.status}`);
      }

      const result = await response.json();

      // Add the new image to the list
      setImages((prev) => [result.image, ...prev]);

      // Reset form and close modal
      setUploadFilename("");
      setSelectedUploadTags([]);
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
    setUploadFilename("");
    setSelectedUploadTags([]);
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

  const toggleSection = (sectionName: string) => {
    setCollapsedSections((prev) => ({
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

          // Check if image has any of the selected tag IDs
          return selectedTagIds.some((tagId) => image.tags?.includes(tagId));
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
                          <label key={tag.id} className="filter-item">
                            <input
                              type="checkbox"
                              checked={selectedTags.includes(tag.name)}
                              onChange={() => handleTagToggle(tag.name)}
                            />
                            <span className="filter-label">{tag.name}</span>
                          </label>
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
                <div key={image.id} className="image-card">
                  <div className="image-placeholder">
                    <span>📸</span>
                  </div>
                  <div className="image-info">
                    <h4>{image.filename}</h4>
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
                <label htmlFor="filename">Filename:</label>
                <input
                  id="filename"
                  type="text"
                  value={uploadFilename}
                  onChange={(e) => setUploadFilename(e.target.value)}
                  placeholder="Enter image filename"
                  required
                />
              </div>

              <div className="form-group">
                <label>Select Tags:</label>
                <div className="tag-selection">
                  {Object.entries(groupedTags).map(
                    ([sectionName, sectionTags]) =>
                      sectionTags.length > 0 && (
                        <div key={sectionName} className="tag-group">
                          <h4>{sectionName}</h4>
                          <div className="tag-checkboxes">
                            {sectionTags.map((tag) => (
                              <label key={tag.id} className="tag-checkbox">
                                <input
                                  type="checkbox"
                                  checked={selectedUploadTags.includes(tag.id)}
                                  onChange={() => handleUploadTagToggle(tag.id)}
                                />
                                <span>{tag.name}</span>
                              </label>
                            ))}
                          </div>
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
                  disabled={uploading}
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
    </div>
  );
}

export default PhotoView;

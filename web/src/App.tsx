import { useState, useEffect } from "react";
import "./App.css";

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

function App() {
  const [images, setImages] = useState<Image[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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
            .map(tagName => tags.find(tag => tag.name === tagName)?.id)
            .filter((tagId): tagId is string => tagId !== undefined); // Type guard to remove undefined
          
          // Check if image has any of the selected tag IDs
          return selectedTagIds.some((tagId) => image.tags?.includes(tagId));
        });

  if (loading) {
    return (
      <div className="app">
        <nav className="navbar">
          <div className="navbar-left">
            <div className="logo">Grammysnaps</div>
          </div>
          <div className="navbar-right">
            <div className="profile-icon">
              <span>Family</span>
            </div>
          </div>
        </nav>
        <main className="main-content">
          <div className="loading-container">
            <div className="loading-spinner">Loading...</div>
          </div>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="app">
        <nav className="navbar">
          <div className="navbar-left">
            <div className="logo">Grammy Snaps</div>
          </div>
          <div className="navbar-right">
            <div className="profile-icon">
              <span>👨‍💼</span>
            </div>
          </div>
        </nav>
        <main className="main-content">
          <div className="error-container">
            <div className="error-message">
              <h3>Error loading data</h3>
              <p>{error}</p>
              <button onClick={() => window.location.reload()}>Retry</button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="app">
      <nav className="navbar">
        <div className="navbar-left">
          <div className="logo">Grammy Snaps</div>
        </div>
        <div className="navbar-right">
          <div className="profile-icon">
            <span>👨‍💼</span>
          </div>
        </div>
      </nav>
      <main className="main-content">
        <div className="content-layout">
          {/* Filter Sidebar */}
          <aside className="filter-sidebar">
            <h3>Filter by Tags</h3>
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
      </main>
    </div>
  );
}

export default App;

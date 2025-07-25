import { useState, useEffect } from "react";
import "./App.css";

// Mock data - we'll replace this with API calls
const mockImages = [
  { id: "1", filename: "sunset.jpg", tags: ["Nature", "Landscape"] },
  { id: "2", filename: "birthday.jpg", tags: ["Event", "Family"] },
  { id: "3", filename: "vacation.jpg", tags: ["Travel", "Summer"] },
  { id: "4", filename: "portrait.jpg", tags: ["Person", "Studio"] },
  { id: "5", filename: "city.jpg", tags: ["Urban", "Architecture"] },
  { id: "6", filename: "beach.jpg", tags: ["Nature", "Summer"] },
];

const mockTags = [
  { id: "1", name: "Nature", type: "Location" },
  { id: "2", name: "Event", type: "Event" },
  { id: "3", name: "Family", type: "Person" },
  { id: "4", name: "Travel", type: "Location" },
  { id: "5", name: "Summer", type: "Time" },
  { id: "6", name: "Urban", type: "Location" },
];

function App() {
  const [images, setImages] = useState(mockImages);
  const [tags, setTags] = useState(mockTags);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  const handleTagToggle = (tagName: string) => {
    setSelectedTags((prev) =>
      prev.includes(tagName)
        ? prev.filter((t) => t !== tagName)
        : [...prev, tagName]
    );
  };

  const filteredImages =
    selectedTags.length === 0
      ? images
      : images.filter((image) =>
          selectedTags.some((tag) => image.tags.includes(tag))
        );

  return (
    <div className="app">
      <nav className="navbar">
        <div className="navbar-left">
          <div className="logo">Grammy Snaps</div>
        </div>
        <div className="navbar-right">
          <div className="profile-icon">
            <span>Family</span>
          </div>
        </div>
      </nav>
      <main className="main-content">
        <div className="content-layout">
          {/* Filter Sidebar */}
          <aside className="filter-sidebar">
            <h3>Filter by Tags</h3>
            <div className="filter-list">
              {tags.map((tag) => (
                <label key={tag.id} className="filter-item">
                  <input
                    type="checkbox"
                    checked={selectedTags.includes(tag.name)}
                    onChange={() => handleTagToggle(tag.name)}
                  />
                  <span className="filter-label">{tag.name}</span>
                  <span className="filter-type">({tag.type})</span>
                </label>
              ))}
            </div>
          </aside>

          {/* Image Grid */}
          <section className="image-grid-container">
            <div className="image-grid">
              {filteredImages.map((image) => (
                <div key={image.id} className="image-card">
                  <div className="image-placeholder">
                    <span>📸</span>
                  </div>
                  <div className="image-info">
                    <h4>{image.filename}</h4>
                    <div className="image-tags">
                      {image.tags.map((tag, index) => (
                        <span key={index} className="tag-chip">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

export default App;

import { useState, useEffect } from "react";
import "./PhotoView.css";
import Modal from "./Modal";
import authService from "../services/auth.service";
import { API_BASE_URL } from "../services/api.service";

// Type definitions
interface User {
  id: string;
  email: string;
  first_name: string | null;
  middle_name: string | null;
  last_name: string | null;
  birthday: string | null;
  families: string[];
  created_at: string;
  updated_at: string;
  profilePicture: string;
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
  created_by: string;
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
  const [uploadFilePreviewUrl, setUploadFilePreviewUrl] = useState<
    string | null
  >(null);
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

  // Pagination state
  const [currentPage, setCurrentPage] = useState(0);
  const [pageSize] = useState(50);
  const [hasMoreImages, setHasMoreImages] = useState(true);
  const [loadingMoreImages, setLoadingMoreImages] = useState(false);

  // Mobile sidebar collapse state
  const [isSidebarCollapsedMobile, setIsSidebarCollapsedMobile] =
    useState(false);

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
    People: true,
    Places: true,
    Events: true,
    Time: true,
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
        const familiesResponse = await authService.apiCall(
          `${API_BASE_URL}/family/user/${user.id}`
        );
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
        // Use the new paginated user endpoint
        const familyIds = familiesData.map((family: FamilyGroup) => family.id);

        let imagesResponse;
        if (familyIds.length > 0) {
          // Build query parameters for pagination
          const queryParams = new URLSearchParams({
            limit: pageSize.toString(),
            offset: (currentPage * pageSize).toString(),
            order: "desc",
          });

          // Add selected tags to query if any
          if (selectedTags.length > 0) {
            selectedTags.forEach((tagId) => {
              queryParams.append("tags", tagId);
            });
          }

          imagesResponse = await authService.apiCall(
            `${API_BASE_URL}/image/user/${user.id}?${queryParams.toString()}`
          );
        } else {
          // If user has no families, set empty images
          setImages([]);
          setTags([]);
          setLoading(false);
          return;
        }

        const tagPromises = familiesData.map((family: FamilyGroup) =>
          authService.apiCall(`${API_BASE_URL}/tag/family/${family.id}`)
        );

        const [, ...tagResponses] = await Promise.all([
          Promise.resolve(), // Placeholder since we already awaited imagesResponse
          ...tagPromises,
        ]);

        if (!imagesResponse.ok) {
          throw new Error(`Failed to fetch images: ${imagesResponse.status}`);
        }

        const imagesData = await imagesResponse.json();

        // For initial load, replace images; for pagination, append images
        if (currentPage === 0) {
          setImages(imagesData.images || []);
        } else {
          setImages((prev) => [...prev, ...(imagesData.images || [])]);
        }

        // Check if there are more images to load
        const receivedImages = imagesData.images || [];
        setHasMoreImages(receivedImages.length === pageSize);

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
  }, [user.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Function to load more images (pagination)
  const loadMoreImages = async () => {
    if (loadingMoreImages || !hasMoreImages) return;

    try {
      setLoadingMoreImages(true);
      const nextPage = currentPage + 1;

      // Build query parameters for pagination
      const queryParams = new URLSearchParams({
        limit: pageSize.toString(),
        offset: (nextPage * pageSize).toString(),
        order: "desc",
      });

      // Add selected tags to query if any
      if (selectedTags.length > 0) {
        selectedTags.forEach((tagId) => {
          queryParams.append("tags", tagId);
        });
      }

      const imagesResponse = await authService.apiCall(
        `${API_BASE_URL}/image/user/${user.id}?${queryParams.toString()}`
      );

      if (!imagesResponse.ok) {
        throw new Error(
          `Failed to fetch more images: ${imagesResponse.status}`
        );
      }

      const imagesData = await imagesResponse.json();
      const newImages = imagesData.images || [];

      // Append new images to existing ones
      setImages((prev) => [...prev, ...newImages]);
      setCurrentPage(nextPage);
      setHasMoreImages(newImages.length === pageSize);
    } catch (err) {
      console.error("Error loading more images:", err);
    } finally {
      setLoadingMoreImages(false);
    }
  };

  // Handle tag filtering - reset to first page when tags change
  useEffect(() => {
    const refetchWithTags = async () => {
      if (loading) return; // Don't refetch while initial load is happening

      try {
        setLoading(true);
        setCurrentPage(0);

        // Build query parameters for pagination
        const queryParams = new URLSearchParams({
          limit: pageSize.toString(),
          offset: "0",
          order: "desc",
        });

        // Add selected tags to query if any
        if (selectedTags.length > 0) {
          selectedTags.forEach((tagId) => {
            queryParams.append("tags", tagId);
          });
        }

        const imagesResponse = await authService.apiCall(
          `${API_BASE_URL}/image/user/${user.id}?${queryParams.toString()}`
        );

        if (!imagesResponse.ok) {
          throw new Error(
            `Failed to fetch filtered images: ${imagesResponse.status}`
          );
        }

        const imagesData = await imagesResponse.json();
        setImages(imagesData.images || []);
        setHasMoreImages((imagesData.images || []).length === pageSize);
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
        console.error("Error fetching filtered images:", err);
      } finally {
        setLoading(false);
      }
    };

    refetchWithTags();
  }, [selectedTags]); // eslint-disable-line react-hooks/exhaustive-deps

  // Initialize mobile sidebar state based on screen size
  useEffect(() => {
    const checkMobile = () => {
      const isMobile = window.innerWidth <= 768;
      setIsSidebarCollapsedMobile(isMobile);
    };

    // Check on mount
    checkMobile();

    // Add listener for window resize
    window.addEventListener("resize", checkMobile);

    // Cleanup
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Handle mobile viewport height changes for browser UI
  useEffect(() => {
    const setVH = () => {
      // Set CSS custom property for actual viewport height
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty("--vh", `${vh}px`);

      // On mobile, add extra bottom padding to prevent browser UI overlap
      if (window.innerWidth <= 768) {
        const gridContainer = document.querySelector(".image-grid-container");
        if (gridContainer) {
          // Calculate extra padding needed based on viewport changes
          const viewportHeight = window.innerHeight;
          const documentHeight = document.documentElement.clientHeight;
          const extraPadding = Math.max(
            0,
            documentHeight - viewportHeight + 80
          ); // 80px buffer

          (
            gridContainer as HTMLElement
          ).style.paddingBottom = `${extraPadding}px`;
        }
      }
    };

    // Set initial values
    setVH();

    // Listen for viewport changes (handles mobile browser UI show/hide)
    window.addEventListener("resize", setVH);
    window.addEventListener("orientationchange", setVH);

    // Also listen for scroll to detect browser UI changes
    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          setVH();
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      window.removeEventListener("resize", setVH);
      window.removeEventListener("orientationchange", setVH);
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  // Manage body class for modal scroll prevention
  useEffect(() => {
    const isAnyModalOpen =
      showUploadModal ||
      showCreateTagModal ||
      showEditTagModal ||
      showImageModal;

    if (isAnyModalOpen) {
      document.body.classList.add("modal-open");
    } else {
      document.body.classList.remove("modal-open");
    }

    // Cleanup on unmount
    return () => {
      document.body.classList.remove("modal-open");
    };
  }, [showUploadModal, showCreateTagModal, showEditTagModal, showImageModal]);

  // Cleanup preview URL on unmount
  useEffect(() => {
    return () => {
      if (uploadFilePreviewUrl) {
        URL.revokeObjectURL(uploadFilePreviewUrl);
      }
    };
  }, [uploadFilePreviewUrl]);

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

      const authHeader = await authService.getAuthHeader();
      if (!authHeader) {
        throw new Error("Not authenticated");
      }

      const response = await fetch(`${API_BASE_URL}/image`, {
        method: "POST",
        headers: {
          Authorization: authHeader,
        },
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
      // Clean up preview URL
      if (uploadFilePreviewUrl) {
        URL.revokeObjectURL(uploadFilePreviewUrl);
        setUploadFilePreviewUrl(null);
      }
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
    // Clean up the object URL to prevent memory leaks
    if (uploadFilePreviewUrl) {
      URL.revokeObjectURL(uploadFilePreviewUrl);
      setUploadFilePreviewUrl(null);
    }
    setShowUploadModal(false);
    setUploadTitle("");
    setSelectedUploadTags([]);
    setSelectedUploadFamilies([]);
    setUploadFile(null);
    setUploadError(null);
    setDragOver(false);
  };

  const handleFileSelect = (file: File) => {
    // Clean up previous preview URL
    if (uploadFilePreviewUrl) {
      URL.revokeObjectURL(uploadFilePreviewUrl);
    }
    // Create new preview URL
    const previewUrl = URL.createObjectURL(file);
    setUploadFilePreviewUrl(previewUrl);
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
      const response = await authService.apiCall(`${API_BASE_URL}/tag`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: newTagName.trim(),
          type: newTagType,
          family_id: newTagFamilyId,
          created_by: user.id,
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
      const response = await authService.apiCall(
        `${API_BASE_URL}/tag/${editingTag.id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: editTagName.trim(),
            type: editTagType,
            family_id: editTagFamilyId,
          }),
        }
      );

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
      const response = await authService.apiCall(
        `${API_BASE_URL}/tag/${editingTag.id}`,
        {
          method: "DELETE",
        }
      );

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
      const response = await authService.apiCall(
        `${API_BASE_URL}/image/${selectedImage.id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            title: editTitle.trim() || null,
            tags: editImageTags,
            family_ids: editImageFamilies,
          }),
        }
      );

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
      const response = await authService.apiCall(
        `${API_BASE_URL}/image/${selectedImage.id}`,
        {
          method: "DELETE",
        }
      );

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
      const authHeader = await authService.getAuthHeader();
      if (!authHeader) {
        throw new Error("Not authenticated");
      }

      const response = await fetch(
        `${API_BASE_URL}/image/${selectedImage.id}/download`,
        {
          headers: {
            Authorization: authHeader,
          },
        }
      );

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
      // Check if image belongs to the selected family
      if (!image.family_ids || !image.family_ids.includes(selectedFamily)) {
        return false;
      }
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
        {/* Mobile backdrop for sidebar overlay */}
        <div
          className={`sidebar-backdrop ${
            !isSidebarCollapsedMobile ? "visible" : ""
          }`}
          onClick={() => setIsSidebarCollapsedMobile(true)}
        />

        {/* Filter Sidebar */}
        <aside
          className={`filter-sidebar ${
            isSidebarCollapsedMobile ? "collapsed-mobile" : ""
          }`}
        >
          <div className="sidebar-header">
            <h3>Filter by Tags</h3>
            <button
              className="mobile-sidebar-toggle"
              onClick={() =>
                setIsSidebarCollapsedMobile(!isSidebarCollapsedMobile)
              }
              aria-label={
                isSidebarCollapsedMobile ? "Show filters" : "Hide filters"
              }
              title={isSidebarCollapsedMobile ? "Show filters" : "Hide filters"}
            >
              {isSidebarCollapsedMobile ? "🏷️" : "✕"}
            </button>
          </div>
          <div className="sidebar-content">
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
                                      collapsedSections[
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
                                {!collapsedSections[
                                  `${familyId}-${tagType}`
                                ] && (
                                  <div className="filter-list">
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
                                        {tag.created_by === user.id && (
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
                                        )}
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
          </div>
        </aside>

        {/* Image Grid */}
        <section className="image-grid-container">
          <div className="upload-section">
            <div className="upload-controls">
              {/* Mobile filter toggle button */}
              <button
                className="mobile-sidebar-toggle"
                onClick={() => setIsSidebarCollapsedMobile(false)}
                aria-label="Show filters"
                title="Show filters"
                style={{
                  display: isSidebarCollapsedMobile ? "block" : "none",
                }}
              >
                🏷️
              </button>

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
                {selectedTags.length > 0 && selectedFamily !== "all"
                  ? "with selected tags and family"
                  : selectedTags.length > 0
                  ? "with selected tags"
                  : selectedFamily !== "all"
                  ? `in ${
                      familyGroups.find((f) => f.id === selectedFamily)?.name ||
                      "selected family"
                    }`
                  : ""}
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
                    {image.title && <h4>{image.title}</h4>}
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

          {/* Pagination Controls */}
          {!loading && hasMoreImages && (
            <div className="pagination-controls">
              <button
                className="load-more-btn"
                onClick={loadMoreImages}
                disabled={loadingMoreImages}
              >
                {loadingMoreImages ? "Loading..." : "Load More Images"}
              </button>
            </div>
          )}
        </section>
      </div>

      {/* Upload Modal */}
      <Modal
        isOpen={showUploadModal}
        mode="form"
        title="Upload New Image"
        onClose={closeModal}
        onLeftAction={closeModal}
        onRightAction={handleUploadSubmit}
        leftButtonText="Cancel"
        rightButtonText={uploading ? "Uploading..." : "Upload"}
        leftButtonClass="cancel-btn"
        rightButtonClass="submit-btn"
        rightButtonDisabled={
          uploading || !uploadFile || familyGroups.length === 0
        }
        showAdditionalButton={uploadFile && uploadFilePreviewUrl ? true : false}
        onAdditionalAction={() =>
          document.getElementById("file-input")?.click()
        }
        additionalButtonText="Select Different Photo"
        additionalButtonClass="additional-btn"
        headerSection={
          <>
            <div
              className={`file-drop-zone ${dragOver ? "drag-over" : ""} ${
                uploadFile && uploadFilePreviewUrl ? "has-preview" : ""
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              {uploadFile && uploadFilePreviewUrl ? (
                <div className="file-preview-display">
                  <img
                    src={uploadFilePreviewUrl}
                    alt={uploadFile.name}
                    className="upload-image-preview"
                    onError={(e) => {
                      // Fallback if preview fails to load
                      e.currentTarget.style.display = "none";
                      e.currentTarget.parentElement!.innerHTML =
                        '<div class="image-preview-placeholder"><span>📸</span><p>Preview not available</p></div>';
                    }}
                  />
                </div>
              ) : uploadFile ? (
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
                      // Clean up preview URL
                      if (uploadFilePreviewUrl) {
                        URL.revokeObjectURL(uploadFilePreviewUrl);
                        setUploadFilePreviewUrl(null);
                      }
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
          </>
        }
      >
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
                    selectedUploadFamilies.includes(family.id) ? "selected" : ""
                  }`}
                  onClick={() => handleUploadFamilyToggle(family.id)}
                >
                  <span>{family.name}</span>
                </div>
              ))
            ) : (
              <div className="empty-families-message">
                <span>
                  You are not a member of any families. Please join or create a
                  family to upload photos.
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
            {Object.entries(tagsByFamilyAndType)
              .filter(([familyId]) => selectedUploadFamilies.includes(familyId))
              .map(([familyId, familyData]) => (
                <div key={familyId} className="filter-section">
                  <button
                    type="button"
                    className="section-header"
                    onClick={() => toggleModalSection(`family-${familyId}`)}
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
                                  toggleModalSection(`${familyId}-${tagType}`)
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
                                <span className="section-title">{tagType}</span>
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
                  )}
                </div>
              ))}
          </div>
        </div>
      </Modal>

      {/* Create Tag Modal */}
      <Modal
        isOpen={showCreateTagModal}
        mode="form"
        title="Create New Tag"
        onClose={closeCreateTagModal}
        onLeftAction={closeCreateTagModal}
        onRightAction={handleCreateTagSubmit}
        leftButtonText="Cancel"
        rightButtonText={creatingTag ? "Creating..." : "Create"}
        rightButtonDisabled={creatingTag}
        leftButtonClass="cancel-btn"
        rightButtonClass="submit-btn"
      >
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
      </Modal>

      {/* Image Preview Modal */}
      <Modal
        isOpen={showImageModal && selectedImage !== null && !isEditingImage}
        mode="preview"
        title="Preview"
        onClose={closeImageModal}
        onLeftAction={handleDownloadImage}
        onRightAction={handleEditToggle}
        leftButtonText="Download"
        rightButtonText="Edit"
        leftButtonClass="download-btn"
        rightButtonClass="edit-btn"
        maxWidth="600px"
        headerSection={
          selectedImage && selectedImage.s3_url ? (
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
          )
        }
      >
        {selectedImage && (
          <div className="image-preview-info">
            <h3>{selectedImage.title || ""}</h3>
            <div className="image-tags">
              {selectedImage.tags?.map((tagId, index) => (
                <span key={index} className="tag-chip">
                  {tags.find((tag) => tag.id === tagId)?.name ||
                    "*Unnamed Tag*"}
                </span>
              )) || <span className="no-tags">No tags</span>}
            </div>
            {selectedImage.filename && (
              <p className="image-filename">
                Filename: {selectedImage.filename}
              </p>
            )}
            {selectedImage.created_at && (
              <p className="image-date">
                Uploaded: {new Date(selectedImage.created_at).toLocaleString()}
              </p>
            )}
            {selectedImage.updated_at && (
              <p className="image-updated">
                Last Edited:{" "}
                {new Date(selectedImage.updated_at).toLocaleString()}
              </p>
            )}
          </div>
        )}
      </Modal>

      {/* Image Edit Modal */}
      <Modal
        isOpen={showImageModal && selectedImage !== null && isEditingImage}
        mode="form"
        title="Edit"
        onClose={closeImageModal}
        onLeftAction={handleEditToggle}
        onRightAction={handleSaveImage}
        leftButtonText="Cancel"
        rightButtonText={savingImage ? "Saving..." : "Save"}
        leftButtonDisabled={false}
        rightButtonDisabled={savingImage}
        leftButtonClass="cancel-btn"
        rightButtonClass="submit-btn"
        showDeleteButton={true}
        onDeleteAction={handleDeleteImage}
        deleteButtonText={deletingImage ? "Deleting..." : "Delete"}
        deleteButtonDisabled={deletingImage}
        deleteButtonClass="delete-btn"
        maxWidth="600px"
        headerSection={
          selectedImage && selectedImage.s3_url ? (
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
          )
        }
      >
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
                    editImageFamilies.includes(family.id) ? "selected" : ""
                  }`}
                  onClick={() => handleEditImageFamilyToggle(family.id)}
                >
                  <span>{family.name}</span>
                </div>
              ))
            ) : (
              <div className="empty-families-message">
                <span>
                  You must be a member of at least one family to edit images.
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="form-group">
          <label>Select Tags:</label>
          <div className="tag-selection">
            {Object.entries(tagsByFamilyAndType)
              .filter(([familyId]) => editImageFamilies.includes(familyId))
              .map(([familyId, familyData]) => (
                <div key={familyId} className="filter-section">
                  <button
                    type="button"
                    className="section-header"
                    onClick={() => toggleModalSection(`family-${familyId}`)}
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
                                  toggleModalSection(`${familyId}-${tagType}`)
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
                                <span className="section-title">{tagType}</span>
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
                  )}
                </div>
              ))}
          </div>
        </div>
      </Modal>

      {/* Edit Tag Modal */}
      <Modal
        isOpen={showEditTagModal && editingTag !== null}
        mode="form"
        title="Edit Tag"
        onClose={closeEditTagModal}
        onLeftAction={closeEditTagModal}
        onRightAction={handleEditTagSubmit}
        leftButtonText="Cancel"
        rightButtonText={savingTag ? "Saving..." : "Save"}
        rightButtonDisabled={savingTag}
        leftButtonClass="cancel-btn"
        rightButtonClass="submit-btn"
        showDeleteButton={true}
        onDeleteAction={handleDeleteTag}
        deleteButtonText={deletingTag ? "Deleting..." : "Delete"}
        deleteButtonDisabled={deletingTag}
        deleteButtonClass="delete-btn"
      >
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
      </Modal>
    </div>
  );
}

export default PhotoView;

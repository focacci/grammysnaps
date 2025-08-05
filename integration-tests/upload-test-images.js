#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { createCanvas } = require("canvas");
const FormData = require("form-data");
const fetch = require("node-fetch");

// Configuration
const API_BASE_URL = "http://localhost:3000";
const NUM_IMAGES = 100;
const IMAGE_WIDTH = 200;
const IMAGE_HEIGHT = 200;

// Test user data
const TEST_USER = {
  email: "testuser@example.com",
  password: "TestPassword123!",
  first_name: "Test",
  last_name: "User",
  invite_key: "dev123", // For dev environment
};

const TEST_FAMILY = {
  name: "Test Family for Images",
};

// Colors for generating different test images
const COLORS = [
  "#FF6B6B",
  "#4ECDC4",
  "#45B7D1",
  "#96CEB4",
  "#FECA57",
  "#FF9FF3",
  "#54A0FF",
  "#5F27CD",
  "#00D2D3",
  "#FF9F43",
  "#10AC84",
  "#EE5A24",
  "#0092CC",
  "#8395A7",
  "#6C5CE7",
];

// Generate a small test image
function generateTestImage(index, width = IMAGE_WIDTH, height = IMAGE_HEIGHT) {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  // Background color
  const bgColor = COLORS[index % COLORS.length];
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, width, height);

  // Add some text
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "bold 24px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(`Test ${index + 1}`, width / 2, height / 2);

  // Add a border
  ctx.strokeStyle = "#333333";
  ctx.lineWidth = 4;
  ctx.strokeRect(0, 0, width, height);

  return canvas.toBuffer("image/png");
}

// Create test user
async function createUser() {
  console.log("Creating test user...");
  const response = await fetch(`${API_BASE_URL}/user`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(TEST_USER),
  });

  if (response.status === 409) {
    console.log("✓ Test user already exists");
    return null; // User already exists
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`User creation failed: ${response.status} ${errorText}`);
  }

  const user = await response.json();
  console.log("✓ Test user created successfully");
  return user;
}

// Login to get auth token
async function login() {
  console.log("Logging in...");
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: TEST_USER.email,
      password: TEST_USER.password,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Login failed: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  console.log("✓ Logged in successfully");
  return {
    token: data.accessToken,
    user: data.user,
  };
}

// Create a test family
async function createFamily(token, userId) {
  console.log("Creating test family...");
  const response = await fetch(`${API_BASE_URL}/family`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      ...TEST_FAMILY,
      owner_id: userId,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Family creation failed: ${response.status} ${errorText}`);
  }

  const family = await response.json();
  console.log("✓ Test family created successfully");
  return family;
}

// Get user's family IDs
async function getUserFamilies(token) {
  console.log("Getting user families...");
  const response = await fetch(`${API_BASE_URL}/family`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to get families: ${response.status}`);
  }

  const data = await response.json();
  return data.families || data;
}

// Upload a single image
async function uploadImage(
  token,
  imageBuffer,
  filename,
  title,
  familyIds,
  index
) {
  const form = new FormData();

  // Add the image file
  form.append("image", imageBuffer, {
    filename: filename,
    contentType: "image/png",
  });

  // Add metadata
  form.append("title", title);
  form.append("family_ids", JSON.stringify(familyIds));
  form.append("tags", JSON.stringify([])); // Empty tags for now

  const response = await fetch(`${API_BASE_URL}/image`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      ...form.getHeaders(),
    },
    body: form,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Upload failed for image ${index}: ${response.status} ${errorText}`
    );
  }

  return await response.json();
}

// Main upload function
async function uploadTestImages() {
  try {
    console.log(`Starting upload of ${NUM_IMAGES} test images...`);

    // Create user (will succeed or skip if already exists)
    await createUser();

    // Login and get auth token
    const { token, user } = await login();

    // Get or create a family
    let families = await getUserFamilies(token);
    if (!families || families.length === 0) {
      console.log("No families found, creating one...");
      const newFamily = await createFamily(token, user.id);
      families = [newFamily];
    }

    const familyIds = families.map((f) => f.id);
    console.log(
      `✓ Using ${families.length} families:`,
      families.map((f) => f.name)
    );

    // Upload images in batches to avoid overwhelming the server
    const BATCH_SIZE = 5; // Smaller batches for stability
    const batches = Math.ceil(NUM_IMAGES / BATCH_SIZE);
    let successCount = 0;
    let errorCount = 0;

    for (let batch = 0; batch < batches; batch++) {
      const batchStart = batch * BATCH_SIZE;
      const batchEnd = Math.min(batchStart + BATCH_SIZE, NUM_IMAGES);

      console.log(
        `\nProcessing batch ${batch + 1}/${batches} (images ${
          batchStart + 1
        }-${batchEnd})...`
      );

      const uploadPromises = [];

      for (let i = batchStart; i < batchEnd; i++) {
        const imageBuffer = generateTestImage(i);
        const filename = `test-image-${i + 1}.png`;
        const title = `Test Image ${i + 1}`;

        uploadPromises.push(
          uploadImage(token, imageBuffer, filename, title, familyIds, i + 1)
            .then((result) => {
              console.log(`  ✓ Uploaded: ${filename}`);
              successCount++;
              return result;
            })
            .catch((error) => {
              console.error(`  ✗ Failed: ${filename} - ${error.message}`);
              errorCount++;
              return null;
            })
        );
      }

      // Wait for batch to complete
      await Promise.all(uploadPromises);

      // Small delay between batches to be nice to the server
      if (batch < batches - 1) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }

    console.log(`\n🎉 Upload complete!`);
    console.log(`✓ Successfully uploaded: ${successCount} images`);
    console.log(`✗ Failed uploads: ${errorCount} images`);
    console.log(
      `📊 Success rate: ${((successCount / NUM_IMAGES) * 100).toFixed(1)}%`
    );
  } catch (error) {
    console.error("❌ Upload failed:", error.message);
    process.exit(1);
  }
}

// Check if canvas module is available
try {
  require("canvas");
} catch (error) {
  console.error("❌ Canvas module not found. Please install it:");
  console.error("npm install canvas form-data node-fetch");
  process.exit(1);
}

// Run the upload
uploadTestImages();

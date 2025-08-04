#!/usr/bin/env node

const fetch = require("node-fetch");

// Configuration
const API_BASE_URL = "http://localhost:3000";
const TEST_USER = {
  email: "testuser@example.com",
  password: "TestPassword123!",
};

async function login() {
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
    throw new Error(`Login failed: ${response.status}`);
  }

  const data = await response.json();
  return {
    token: data.accessToken,
    user: data.user,
  };
}

async function testPagination(token, userId) {
  console.log("🧪 Testing Pagination API\n");

  // Test different pagination scenarios
  const tests = [
    { limit: 10, offset: 0, description: "First page (10 images)" },
    { limit: 10, offset: 10, description: "Second page (10 images)" },
    { limit: 25, offset: 0, description: "Large page (25 images)" },
    {
      limit: 5,
      offset: 50,
      description: "Mid-range page (5 images from offset 50)",
    },
    { limit: 1, offset: 99, description: "Last image (limit 1, offset 99)" },
    { limit: 10, offset: 100, description: "Beyond range (should be empty)" },
  ];

  for (const test of tests) {
    try {
      const queryParams = new URLSearchParams({
        limit: test.limit.toString(),
        offset: test.offset.toString(),
        order: "desc",
      });

      const response = await fetch(
        `${API_BASE_URL}/image/user/${userId}?${queryParams.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      const imageCount = data.images ? data.images.length : 0;

      console.log(`✅ ${test.description}: ${imageCount} images returned`);

      // Show first and last image titles if available
      if (data.images && data.images.length > 0) {
        const first = data.images[0];
        const last = data.images[data.images.length - 1];
        console.log(`   📸 First: ${first.title || first.filename}`);
        if (data.images.length > 1) {
          console.log(`   📸 Last:  ${last.title || last.filename}`);
        }
      }
    } catch (error) {
      console.log(`❌ ${test.description}: ${error.message}`);
    }
    console.log("");
  }
}

async function testOrdering(token, userId) {
  console.log("🔄 Testing Sort Order\n");

  const orders = ["desc", "asc"];

  for (const order of orders) {
    try {
      const queryParams = new URLSearchParams({
        limit: "5",
        offset: "0",
        order: order,
      });

      const response = await fetch(
        `${API_BASE_URL}/image/user/${userId}?${queryParams.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      console.log(
        `✅ Order ${order.toUpperCase()}: ${data.images.length} images`
      );
      if (data.images && data.images.length > 0) {
        data.images.forEach((img, i) => {
          console.log(
            `   ${i + 1}. ${img.title || img.filename} (${img.created_at})`
          );
        });
      }
    } catch (error) {
      console.log(`❌ Order ${order}: ${error.message}`);
    }
    console.log("");
  }
}

async function runTests() {
  try {
    console.log("🚀 Starting Pagination Tests...\n");

    // Login and get user info
    const { token, user } = await login();
    console.log(`✅ Logged in as: ${user.email} (ID: ${user.id})\n`);

    // Run pagination tests
    await testPagination(token, user.id);

    // Run ordering tests
    await testOrdering(token, user.id);

    console.log("🎉 All tests completed!");
  } catch (error) {
    console.error("❌ Test failed:", error.message);
    process.exit(1);
  }
}

runTests();

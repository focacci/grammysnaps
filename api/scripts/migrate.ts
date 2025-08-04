#!/usr/bin/env tsx

/**
 * Database migration script
 * This script sets up the initial database schema
 */

import { Client } from "pg";
import * as process from "process";

// Load environment variables from .env file if present
try {
  const dotenv = await import("dotenv");
  dotenv.config();
} catch {
  // dotenv not available or not needed
}

const DB_CONFIG = {
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || "5432"),
  database: process.env.DB_NAME || process.env.dbname,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  connectionTimeoutMillis: 30000, // 30 seconds
  idleTimeoutMillis: 30000,
  ssl:
    process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: false }
      : false,
};

const SCHEMA_SQL = `
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    middle_name VARCHAR(100),
    last_name VARCHAR(100),
    birthday DATE,
    profile_picture_url TEXT,
    profile_picture_thumbnail_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Family groups table
CREATE TABLE IF NOT EXISTS family_groups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Family members junction table
CREATE TABLE IF NOT EXISTS family_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    family_id UUID NOT NULL REFERENCES family_groups(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member')),
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(family_id, user_id)
);

-- Related families junction table (for family connections)
CREATE TABLE IF NOT EXISTS related_families (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    family_id UUID NOT NULL REFERENCES family_groups(id) ON DELETE CASCADE,
    related_family_id UUID NOT NULL REFERENCES family_groups(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(family_id, related_family_id),
    CHECK (family_id != related_family_id)
);

-- Images table
CREATE TABLE IF NOT EXISTS images (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    family_id UUID NOT NULL REFERENCES family_groups(id) ON DELETE CASCADE,
    uploaded_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    filename VARCHAR(255) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    file_size INTEGER NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    url TEXT NOT NULL,
    thumbnail_url TEXT,
    width INTEGER,
    height INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tags table
CREATE TABLE IF NOT EXISTS tags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    family_id UUID NOT NULL REFERENCES family_groups(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(name, family_id)
);

-- Image tags junction table
CREATE TABLE IF NOT EXISTS image_tags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    image_id UUID NOT NULL REFERENCES images(id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(image_id, tag_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_family_members_family_id ON family_members(family_id);
CREATE INDEX IF NOT EXISTS idx_family_members_user_id ON family_members(user_id);
CREATE INDEX IF NOT EXISTS idx_images_family_id ON images(family_id);
CREATE INDEX IF NOT EXISTS idx_images_uploaded_by ON images(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_images_created_at ON images(created_at);
CREATE INDEX IF NOT EXISTS idx_tags_family_id ON tags(family_id);
CREATE INDEX IF NOT EXISTS idx_image_tags_image_id ON image_tags(image_id);
CREATE INDEX IF NOT EXISTS idx_image_tags_tag_id ON image_tags(tag_id);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at columns
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_family_groups_updated_at ON family_groups;
CREATE TRIGGER update_family_groups_updated_at
    BEFORE UPDATE ON family_groups
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_images_updated_at ON images;
CREATE TRIGGER update_images_updated_at
    BEFORE UPDATE ON images
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Insert default data (optional)
-- This could include default tags, sample data, etc.
`;

async function runMigration() {
  const client = new Client(DB_CONFIG);

  try {
    console.log("🔗 Connecting to database...");
    console.log(`   Host: ${DB_CONFIG.host}`);
    console.log(`   Port: ${DB_CONFIG.port}`);
    console.log(`   Database: ${DB_CONFIG.database}`);
    console.log(`   User: ${DB_CONFIG.user}`);

    await client.connect();
    console.log("✅ Connected to database successfully!");

    // Check if tables already exist
    console.log("🔍 Checking for existing tables...");
    const existingTablesResult = await client.query(`
      SELECT tablename FROM pg_tables WHERE schemaname='public';
    `);

    const existingTables = existingTablesResult.rows.map(
      (row) => row.tablename
    );
    console.log("📋 Existing tables:", existingTables);

    if (existingTables.length > 0) {
      console.log(
        "⚠️  Database already contains tables. Skipping migration to avoid conflicts."
      );
      console.log("🔍 To see the current schema, run:");
      console.log(
        '   docker exec grammysnaps-db-1 psql -U user -d grammysnaps -c "\\dt"'
      );
      return;
    }

    console.log("🗄️ Running database migrations...");
    await client.query(SCHEMA_SQL);

    console.log("✅ Database migrations completed successfully!");
  } catch (error) {
    console.error("❌ Migration failed:", error);
    if (error instanceof Error) {
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);
    }
    process.exit(1);
  } finally {
    try {
      await client.end();
      console.log("🔌 Database connection closed");
    } catch (error) {
      console.error("Error closing connection:", error);
    }
  }
}

// Check if required environment variables are present
const requiredEnvVars = [
  "DB_HOST",
  "DB_PORT",
  "DB_NAME",
  "DB_USER",
  "DB_PASSWORD",
];

console.log("🔍 Checking environment variables...");
const missingEnvVars = requiredEnvVars.filter((envVar) => !process.env[envVar]);

if (missingEnvVars.length > 0) {
  console.error(
    "❌ Missing required environment variables:",
    missingEnvVars.join(", ")
  );
  console.log("\n💡 Available environment variables:");
  requiredEnvVars.forEach((envVar) => {
    const value = process.env[envVar];
    console.log(`   ${envVar}: ${value ? "✅ Set" : "❌ Missing"}`);
  });
  console.log(
    "\n📝 Please set these environment variables or create a .env file in the api directory"
  );
  process.exit(1);
}

console.log("✅ All required environment variables are set");

runMigration();

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
  ssl: { rejectUnauthorized: false }, // Always use SSL for RDS
};

const SCHEMA_SQL = `
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    middle_name VARCHAR(100),
    last_name VARCHAR(100),
    birthday DATE,
    families UUID[] NOT NULL,
    profile_picture_url VARCHAR(2047),
    profile_picture_thumbnail_url VARCHAR(2047),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Families table
CREATE TABLE IF NOT EXISTS families (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    members TEXT[] NOT NULL,
    owner_id UUID NOT NULL,
    related_families UUID[] NOT NULL,
    FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Family members junction table
CREATE TABLE IF NOT EXISTS family_members (
    family_id UUID NOT NULL,
    user_id UUID NOT NULL,
    PRIMARY KEY (family_id, user_id),
    FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Family relations junction table
CREATE TABLE IF NOT EXISTS family_relations (
    family_id_1 UUID NOT NULL,
    family_id_2 UUID NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (family_id_1, family_id_2),
    FOREIGN KEY (family_id_1) REFERENCES families(id) ON DELETE CASCADE,
    FOREIGN KEY (family_id_2) REFERENCES families(id) ON DELETE CASCADE,
    CHECK (family_id_1 != family_id_2)
);

-- Images table
CREATE TABLE IF NOT EXISTS images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255),
    filename VARCHAR(255) NOT NULL,
    original_url VARCHAR(1000),
    thumbnail_url VARCHAR(1000),
    tags TEXT[] NOT NULL,
    family_ids UUID[] NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CHECK (array_length(family_ids, 1) >= 1)
);

-- Tags table
CREATE TABLE IF NOT EXISTS tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type VARCHAR(63) NOT NULL,
    name VARCHAR(255) NOT NULL,
    family_id UUID NOT NULL,
    UNIQUE (type, name, family_id),
    created_by UUID NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE
);

-- Image tags junction table
CREATE TABLE IF NOT EXISTS image_tags (
    image_id UUID NOT NULL,
    tag_id UUID NOT NULL,
    PRIMARY KEY (image_id, tag_id),
    FOREIGN KEY (image_id) REFERENCES images(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);

-- Image families junction table
CREATE TABLE IF NOT EXISTS image_families (
    image_id UUID NOT NULL,
    family_id UUID NOT NULL,
    PRIMARY KEY (image_id, family_id),
    FOREIGN KEY (image_id) REFERENCES images(id) ON DELETE CASCADE,
    FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_family_members_family_id ON family_members(family_id);
CREATE INDEX IF NOT EXISTS idx_family_members_user_id ON family_members(user_id);
CREATE INDEX IF NOT EXISTS idx_families_owner_id ON families(owner_id);
CREATE INDEX IF NOT EXISTS idx_tags_family_id ON tags(family_id);
CREATE INDEX IF NOT EXISTS idx_image_tags_image_id ON image_tags(image_id);
CREATE INDEX IF NOT EXISTS idx_image_tags_tag_id ON image_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_image_families_image_id ON image_families(image_id);
CREATE INDEX IF NOT EXISTS idx_image_families_family_id ON image_families(family_id);

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

DROP TRIGGER IF EXISTS update_families_updated_at ON families;
CREATE TRIGGER update_families_updated_at
    BEFORE UPDATE ON families
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_images_updated_at ON images;
CREATE TRIGGER update_images_updated_at
    BEFORE UPDATE ON images
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_tags_updated_at ON tags;
CREATE TRIGGER update_tags_updated_at
    BEFORE UPDATE ON tags
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

if (
  process.env.NODE_ENV === "staging" ||
  process.env.NODE_ENV === "production"
) {
  runMigration();
} else if (
  process.env.NODE_ENV === "development" ||
  process.env.NODE_ENV === "local"
) {
  console.log("Not running migrations in development mode");
}

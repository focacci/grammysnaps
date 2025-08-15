CREATE TABLE IF NOT EXISTS images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255),
  filename VARCHAR(255) NOT NULL,
  original_key VARCHAR(1000),
  thumbnail_key VARCHAR(1000),
  tags TEXT[] NOT NULL,
  collection_ids UUID[] NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CHECK (array_length(collection_ids, 1) >= 1)
);

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  first_name VARCHAR(100),
  middle_name VARCHAR(100),
  last_name VARCHAR(100),
  birthday DATE,
  collections UUID[] NOT NULL,
  profile_picture_key VARCHAR(1000),
  profile_picture_thumbnail_key VARCHAR(1000),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  members TEXT[] NOT NULL,
  owner_id UUID NOT NULL,
  related_collections UUID[] NOT NULL,
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS collection_members (
  collection_id UUID NOT NULL,
  user_id UUID NOT NULL,
  PRIMARY KEY (collection_id, user_id),
  FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS collection_relations (
  collection_id_1 UUID NOT NULL,
  collection_id_2 UUID NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (collection_id_1, collection_id_2),
  FOREIGN KEY (collection_id_1) REFERENCES collections(id) ON DELETE CASCADE,
  FOREIGN KEY (collection_id_2) REFERENCES collections(id) ON DELETE CASCADE,
  CHECK (collection_id_1 != collection_id_2)
);

CREATE TABLE IF NOT EXISTS tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type VARCHAR(63) NOT NULL,
  name VARCHAR(255) NOT NULL,
  collection_id UUID NOT NULL,
  UNIQUE (type, name, collection_id),
  created_by UUID NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS image_tags (
  image_id UUID NOT NULL,
  tag_id UUID NOT NULL,
  PRIMARY KEY (image_id, tag_id),
  FOREIGN KEY (image_id) REFERENCES images(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS image_collections (
  image_id UUID NOT NULL,
  collection_id UUID NOT NULL,
  PRIMARY KEY (image_id, collection_id),
  FOREIGN KEY (image_id) REFERENCES images(id) ON DELETE CASCADE,
  FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE
);
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
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

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

CREATE TABLE IF NOT EXISTS family_members (
  family_id UUID NOT NULL,
  user_id UUID NOT NULL,
  PRIMARY KEY (family_id, user_id),
  FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS family_relations (
  family_id_1 UUID NOT NULL,
  family_id_2 UUID NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (family_id_1, family_id_2),
  FOREIGN KEY (family_id_1) REFERENCES families(id) ON DELETE CASCADE,
  FOREIGN KEY (family_id_2) REFERENCES families(id) ON DELETE CASCADE,
  CHECK (family_id_1 != family_id_2)
);

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

CREATE TABLE IF NOT EXISTS image_tags (
  image_id UUID NOT NULL,
  tag_id UUID NOT NULL,
  PRIMARY KEY (image_id, tag_id),
  FOREIGN KEY (image_id) REFERENCES images(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS image_families (
  image_id UUID NOT NULL,
  family_id UUID NOT NULL,
  PRIMARY KEY (image_id, family_id),
  FOREIGN KEY (image_id) REFERENCES images(id) ON DELETE CASCADE,
  FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE
);
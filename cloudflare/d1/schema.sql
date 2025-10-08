-- D1 Database Schema for kinetiCORE Cloud Assets
-- Owner: George
-- Version: 1.0.0

-- Assets table (main catalog)
CREATE TABLE IF NOT EXISTS assets (
  id TEXT PRIMARY KEY,                    -- "mujoco-menagerie/franka_emika_panda"
  name TEXT NOT NULL,                     -- "Franka Emika Panda"
  domain TEXT NOT NULL,                   -- "manufacturing"
  asset_class TEXT NOT NULL,              -- "robots"
  asset_type TEXT,                        -- "collaborative_arm"
  manufacturer TEXT,                      -- "Franka Robotics"
  latest_version TEXT NOT NULL,           -- "1.1.0"
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_assets_domain ON assets(domain);
CREATE INDEX IF NOT EXISTS idx_assets_class ON assets(asset_class);
CREATE INDEX IF NOT EXISTS idx_assets_manufacturer ON assets(manufacturer);
CREATE INDEX IF NOT EXISTS idx_assets_updated ON assets(updated_at);

-- Asset versions table
CREATE TABLE IF NOT EXISTS asset_versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  asset_id TEXT NOT NULL,                 -- Foreign key to assets.id
  version TEXT NOT NULL,                  -- "1.1.0"
  r2_path TEXT NOT NULL,                  -- "packages/mujoco-menagerie/franka_emika_panda/v1.1.0/"
  metadata_json TEXT NOT NULL,            -- Full JSON metadata
  package_size INTEGER,                   -- bytes
  checksum TEXT,                          -- SHA-256
  uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  uploaded_by TEXT,                       -- user ID or "system"
  status TEXT DEFAULT 'active',           -- active | deprecated | archived
  FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE,
  UNIQUE(asset_id, version)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_versions_asset ON asset_versions(asset_id);
CREATE INDEX IF NOT EXISTS idx_versions_status ON asset_versions(status);
CREATE INDEX IF NOT EXISTS idx_versions_uploaded ON asset_versions(uploaded_at);

-- Usage tracking table
CREATE TABLE IF NOT EXISTS asset_usage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  asset_id TEXT NOT NULL,                 -- Foreign key to assets.id
  version TEXT,                           -- Version accessed
  event_type TEXT NOT NULL,               -- download | view | instantiate
  user_id TEXT,                           -- Optional user identifier
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  metadata TEXT,                          -- Optional JSON metadata
  FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_usage_asset ON asset_usage(asset_id);
CREATE INDEX IF NOT EXISTS idx_usage_event ON asset_usage(event_type);
CREATE INDEX IF NOT EXISTS idx_usage_timestamp ON asset_usage(timestamp);

-- User favorites table (optional)
CREATE TABLE IF NOT EXISTS user_favorites (
  user_id TEXT NOT NULL,
  asset_id TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, asset_id),
  FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE
);

-- Full-text search index (FTS5)
CREATE VIRTUAL TABLE IF NOT EXISTS assets_search USING fts5(
  asset_id UNINDEXED,
  name,
  manufacturer,
  tags,
  keywords,
  description,
  content='assets',
  content_rowid='rowid'
);

-- Trigger to keep FTS index in sync
CREATE TRIGGER IF NOT EXISTS assets_search_insert AFTER INSERT ON assets BEGIN
  INSERT INTO assets_search(asset_id, name, manufacturer)
  VALUES (new.id, new.name, new.manufacturer);
END;

CREATE TRIGGER IF NOT EXISTS assets_search_delete AFTER DELETE ON assets BEGIN
  DELETE FROM assets_search WHERE asset_id = old.id;
END;

CREATE TRIGGER IF NOT EXISTS assets_search_update AFTER UPDATE ON assets BEGIN
  UPDATE assets_search
  SET name = new.name,
      manufacturer = new.manufacturer
  WHERE asset_id = old.id;
END;

-- Upload sessions table (for tracking multi-part uploads)
CREATE TABLE IF NOT EXISTS upload_sessions (
  id TEXT PRIMARY KEY,                    -- upload_abc123
  asset_id TEXT NOT NULL,
  version TEXT NOT NULL,
  metadata_json TEXT NOT NULL,
  status TEXT DEFAULT 'uploading',        -- uploading | validating | completed | failed
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME,
  error_message TEXT
);

-- Create index
CREATE INDEX IF NOT EXISTS idx_uploads_status ON upload_sessions(status);
CREATE INDEX IF NOT EXISTS idx_uploads_created ON upload_sessions(created_at);

-- Analytics aggregations table (for faster queries)
CREATE TABLE IF NOT EXISTS analytics_daily (
  date DATE NOT NULL,
  asset_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  count INTEGER DEFAULT 0,
  PRIMARY KEY (date, asset_id, event_type),
  FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE
);

-- Create index
CREATE INDEX IF NOT EXISTS idx_analytics_date ON analytics_daily(date);
CREATE INDEX IF NOT EXISTS idx_analytics_asset ON analytics_daily(asset_id);

-- Schema version tracking
CREATE TABLE IF NOT EXISTS schema_version (
  version TEXT PRIMARY KEY,
  applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Insert initial version
INSERT OR IGNORE INTO schema_version (version) VALUES ('1.0.0');

-- Sample data for testing (optional - remove for production)
-- INSERT INTO assets (id, name, domain, asset_class, asset_type, manufacturer, latest_version)
-- VALUES (
--   'mujoco-menagerie/franka_emika_panda',
--   'Franka Emika Panda',
--   'manufacturing',
--   'robots',
--   'collaborative_arm',
--   'Franka Robotics',
--   '1.0.0'
-- );

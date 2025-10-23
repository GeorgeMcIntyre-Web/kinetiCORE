-- ============================================================================
-- kinetiCORE World Save System - Database Schema
-- ============================================================================
-- Agent 3 (Cursor) - Edwin
-- Database: PostgreSQL (Supabase)
-- Purpose: Store compressed world saves, projects, and collaboration data
-- ============================================================================

-- ============================================================================
-- 1. Projects Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  
  -- Project settings
  visibility TEXT NOT NULL CHECK (visibility IN ('private', 'team', 'public')),
  status TEXT NOT NULL CHECK (status IN ('draft', 'active', 'completed', 'archived')),
  category TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}',
  
  -- Versioning
  current_version INTEGER NOT NULL DEFAULT 0,
  last_saved_at TIMESTAMPTZ,
  
  -- Custom properties
  custom_properties JSONB DEFAULT '{}'::jsonb,
  
  -- Indexes
  CONSTRAINT projects_name_created_by_key UNIQUE (name, created_by)
);

CREATE INDEX idx_projects_created_by ON projects(created_by);
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_projects_visibility ON projects(visibility);
CREATE INDEX idx_projects_category ON projects(category);
CREATE INDEX idx_projects_tags ON projects USING GIN(tags);

-- ============================================================================
-- 2. Project Saves Table (Compressed World Data)
-- ============================================================================

CREATE TABLE IF NOT EXISTS project_saves (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  
  -- Compressed world data
  world_data BYTEA NOT NULL, -- gzip-compressed JSON
  world_data_hash TEXT NOT NULL, -- SHA-256 checksum
  
  -- Metadata (searchable, not compressed)
  asset_instance_count INTEGER NOT NULL DEFAULT 0,
  file_size INTEGER NOT NULL, -- Size of compressed data in bytes
  is_auto_save BOOLEAN NOT NULL DEFAULT FALSE,
  
  -- External assets (references to blob storage)
  external_assets JSONB DEFAULT '{}'::jsonb,
  
  -- Indexes
  CONSTRAINT project_saves_unique_version UNIQUE (project_id, version)
);

CREATE INDEX idx_project_saves_project_id ON project_saves(project_id);
CREATE INDEX idx_project_saves_created_at ON project_saves(created_at DESC);
CREATE INDEX idx_project_saves_is_auto_save ON project_saves(is_auto_save);

-- ============================================================================
-- 3. Project Asset Instances Table (For Querying Without Decompression)
-- ============================================================================

CREATE TABLE IF NOT EXISTS project_asset_instances (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_save_id UUID NOT NULL REFERENCES project_saves(id) ON DELETE CASCADE,
  asset_id UUID NOT NULL, -- FK to library_assets
  instance_id TEXT NOT NULL, -- Instance ID within the world
  name TEXT NOT NULL,
  
  -- Transform data (for spatial queries)
  position JSONB NOT NULL,
  rotation JSONB NOT NULL,
  
  -- Joint states (for robot queries)
  joint_states JSONB DEFAULT '{}'::jsonb,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Indexes
  CONSTRAINT project_asset_instances_unique UNIQUE (project_save_id, instance_id)
);

CREATE INDEX idx_project_asset_instances_save_id ON project_asset_instances(project_save_id);
CREATE INDEX idx_project_asset_instances_asset_id ON project_asset_instances(asset_id);
CREATE INDEX idx_project_asset_instances_name ON project_asset_instances(name);

-- ============================================================================
-- 4. Library Assets Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS library_assets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  manufacturer TEXT,
  model_number TEXT,
  version TEXT,
  
  -- Classification
  domain TEXT NOT NULL,
  asset_class TEXT NOT NULL,
  asset_type TEXT NOT NULL,
  
  -- Technical
  loader_type TEXT NOT NULL CHECK (loader_type IN ('urdf', 'glb', 'jt', 'mjcf', 'usd', 'step', 'stl', 'obj')),
  file_path TEXT NOT NULL,
  file_size INTEGER,
  checksum TEXT,
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  tags TEXT[] DEFAULT '{}',
  
  -- Discovery
  thumbnail_url TEXT,
  documentation_url TEXT,
  
  -- Tracking
  usage_count INTEGER DEFAULT 0,
  is_favorite BOOLEAN DEFAULT FALSE,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Indexes
  CONSTRAINT library_assets_unique_path UNIQUE (file_path)
);

CREATE INDEX idx_library_assets_domain ON library_assets(domain);
CREATE INDEX idx_library_assets_asset_class ON library_assets(asset_class);
CREATE INDEX idx_library_assets_loader_type ON library_assets(loader_type);
CREATE INDEX idx_library_assets_tags ON library_assets USING GIN(tags);
CREATE INDEX idx_library_assets_metadata ON library_assets USING GIN(metadata);

-- ============================================================================
-- 5. External Asset Blobs Table (Mesh Files, Textures)
-- ============================================================================

CREATE TABLE IF NOT EXISTS external_asset_blobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  asset_id UUID NOT NULL REFERENCES library_assets(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  content_type TEXT NOT NULL, -- 'model/stl', 'image/png', etc.
  
  -- Storage
  storage_type TEXT NOT NULL CHECK (storage_type IN ('database', 'r2', 's3')),
  data BYTEA, -- For database storage
  storage_url TEXT, -- For R2/S3 storage
  
  -- Metadata
  size INTEGER NOT NULL,
  checksum TEXT NOT NULL,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Indexes
  CONSTRAINT external_asset_blobs_unique UNIQUE (asset_id, file_name)
);

CREATE INDEX idx_external_asset_blobs_asset_id ON external_asset_blobs(asset_id);
CREATE INDEX idx_external_asset_blobs_checksum ON external_asset_blobs(checksum);

-- ============================================================================
-- 6. Project Team Members Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS project_team_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'editor', 'viewer')),
  permissions TEXT NOT NULL CHECK (permissions IN ('read', 'write', 'admin')),
  
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_active_at TIMESTAMPTZ,
  
  -- Indexes
  CONSTRAINT project_team_members_unique UNIQUE (project_id, user_id)
);

CREATE INDEX idx_project_team_members_project_id ON project_team_members(project_id);
CREATE INDEX idx_project_team_members_user_id ON project_team_members(user_id);

-- ============================================================================
-- 7. Project Comments Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS project_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  asset_instance_id TEXT, -- Optional - comment on specific asset
  
  -- 3D position in scene (optional)
  position_x FLOAT,
  position_y FLOAT,
  position_z FLOAT,
  
  -- Author
  author_id UUID NOT NULL REFERENCES auth.users(id),
  author_name TEXT NOT NULL,
  
  -- Content
  content TEXT NOT NULL,
  
  -- Threading
  parent_comment_id UUID REFERENCES project_comments(id) ON DELETE CASCADE,
  
  -- Status
  is_resolved BOOLEAN DEFAULT FALSE,
  resolved_by UUID REFERENCES auth.users(id),
  resolved_at TIMESTAMPTZ,
  
  -- Mentions
  mentions UUID[] DEFAULT '{}',
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_project_comments_project_id ON project_comments(project_id);
CREATE INDEX idx_project_comments_author_id ON project_comments(author_id);
CREATE INDEX idx_project_comments_parent_id ON project_comments(parent_comment_id);
CREATE INDEX idx_project_comments_is_resolved ON project_comments(is_resolved);

-- ============================================================================
-- 8. Project Annotations Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS project_annotations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  asset_instance_id TEXT, -- Optional
  
  -- 3D position
  position_x FLOAT NOT NULL,
  position_y FLOAT NOT NULL,
  position_z FLOAT NOT NULL,
  
  -- Annotation type
  type TEXT NOT NULL CHECK (type IN ('note', 'warning', 'question', 'highlight', 'measurement', 'custom')),
  content TEXT NOT NULL,
  
  -- Author
  author_id UUID NOT NULL REFERENCES auth.users(id),
  
  -- Visual properties
  color TEXT DEFAULT '#FFFF00',
  size FLOAT DEFAULT 1.0,
  opacity FLOAT DEFAULT 0.8,
  
  -- State
  is_visible BOOLEAN DEFAULT TRUE,
  is_locked BOOLEAN DEFAULT FALSE,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_project_annotations_project_id ON project_annotations(project_id);
CREATE INDEX idx_project_annotations_author_id ON project_annotations(author_id);
CREATE INDEX idx_project_annotations_type ON project_annotations(type);

-- ============================================================================
-- 9. Asset Locks Table (For Collaboration)
-- ============================================================================

CREATE TABLE IF NOT EXISTS asset_locks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  asset_instance_id TEXT NOT NULL,
  
  -- Lock info
  locked_by UUID NOT NULL REFERENCES auth.users(id),
  lock_type TEXT NOT NULL CHECK (lock_type IN ('soft', 'hard')),
  reason TEXT,
  
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Indexes
  CONSTRAINT asset_locks_unique UNIQUE (project_id, asset_instance_id)
);

CREATE INDEX idx_asset_locks_project_id ON asset_locks(project_id);
CREATE INDEX idx_asset_locks_locked_by ON asset_locks(locked_by);
CREATE INDEX idx_asset_locks_expires_at ON asset_locks(expires_at);

-- ============================================================================
-- Row Level Security (RLS) Policies
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_saves ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_asset_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE library_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE external_asset_blobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_annotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_locks ENABLE ROW LEVEL SECURITY;

-- Projects: Users can see their own projects and projects they're members of
CREATE POLICY "Users can view their own projects"
  ON projects FOR SELECT
  USING (
    auth.uid() = created_by 
    OR id IN (
      SELECT project_id FROM project_team_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create projects"
  ON projects FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update their own projects"
  ON projects FOR UPDATE
  USING (auth.uid() = created_by);

-- Project Saves: Same as projects
CREATE POLICY "Users can view saves for their projects"
  ON project_saves FOR SELECT
  USING (
    project_id IN (
      SELECT id FROM projects WHERE created_by = auth.uid()
      OR id IN (SELECT project_id FROM project_team_members WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "Users can create saves for their projects"
  ON project_saves FOR INSERT
  WITH CHECK (
    project_id IN (
      SELECT id FROM projects WHERE created_by = auth.uid()
      OR id IN (SELECT project_id FROM project_team_members WHERE user_id = auth.uid() AND permissions IN ('write', 'admin'))
    )
  );

-- Library Assets: Public read, authenticated write
CREATE POLICY "Anyone can view library assets"
  ON library_assets FOR SELECT
  TO PUBLIC
  USING (true);

CREATE POLICY "Authenticated users can create library assets"
  ON library_assets FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ============================================================================
-- Helper Functions
-- ============================================================================

-- Function to clean up expired auto-saves
CREATE OR REPLACE FUNCTION cleanup_old_autosaves()
RETURNS void AS $$
BEGIN
  DELETE FROM project_saves
  WHERE is_auto_save = TRUE
    AND created_at < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql;

-- Function to update project updated_at timestamp
CREATE OR REPLACE FUNCTION update_project_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE projects
  SET updated_at = NOW()
  WHERE id = NEW.project_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_project_on_save
  AFTER INSERT ON project_saves
  FOR EACH ROW
  EXECUTE FUNCTION update_project_timestamp();

-- ============================================================================
-- Example Queries
-- ============================================================================

-- Get all saves for a project
-- SELECT * FROM project_saves WHERE project_id = 'uuid-here' ORDER BY created_at DESC;

-- Get latest save for a project
-- SELECT * FROM project_saves WHERE project_id = 'uuid-here' ORDER BY created_at DESC LIMIT 1;

-- Get all instances in a save without decompressing
-- SELECT * FROM project_asset_instances WHERE project_save_id = 'uuid-here';

-- Find projects using a specific asset
-- SELECT DISTINCT p.* 
-- FROM projects p
-- JOIN project_saves ps ON p.id = ps.project_id
-- JOIN project_asset_instances pai ON ps.id = pai.project_save_id
-- WHERE pai.asset_id = 'asset-uuid-here';

-- Get storage usage for a user
-- SELECT 
--   COUNT(DISTINCT p.id) as project_count,
--   COUNT(ps.id) as save_count,
--   SUM(ps.file_size) as total_storage_bytes,
--   SUM(ps.file_size) / 1024 / 1024 as total_storage_mb
-- FROM projects p
-- LEFT JOIN project_saves ps ON p.id = ps.project_id
-- WHERE p.created_by = 'user-uuid-here';

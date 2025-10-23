-- Migration: Add Projects Table for World Save System
-- Date: 2025-10-23
-- Description: Stores compressed world saves with metadata

-- Create projects table
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  data BYTEA NOT NULL,  -- Compressed world data (gzip)
  checksum TEXT NOT NULL,  -- SHA-256 checksum for integrity
  asset_count INTEGER DEFAULT 0,
  file_size INTEGER DEFAULT 0,  -- Size of compressed data in bytes
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_created_at ON projects(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_projects_updated_at ON projects(updated_at DESC);

-- Add comments
COMMENT ON TABLE projects IS 'Stores compressed world save data';
COMMENT ON COLUMN projects.data IS 'Gzip-compressed JSON world data';
COMMENT ON COLUMN projects.checksum IS 'SHA-256 checksum for data integrity verification';
COMMENT ON COLUMN projects.asset_count IS 'Number of asset instances in this project';
COMMENT ON COLUMN projects.file_size IS 'Size of compressed data in bytes';

-- Enable Row Level Security
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Users can view their own projects
CREATE POLICY "Users can view own projects"
  ON projects FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own projects
CREATE POLICY "Users can create own projects"
  ON projects FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own projects
CREATE POLICY "Users can update own projects"
  ON projects FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own projects
CREATE POLICY "Users can delete own projects"
  ON projects FOR DELETE
  USING (auth.uid() = user_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
DROP TRIGGER IF EXISTS update_projects_updated_at ON projects;
CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to validate checksum
CREATE OR REPLACE FUNCTION validate_project_checksum()
RETURNS TRIGGER AS $$
BEGIN
  -- Ensure checksum is a valid SHA-256 hash (64 hex characters)
  IF NEW.checksum !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'Invalid checksum format. Must be a 64-character hex string (SHA-256)';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to validate checksum on insert/update
DROP TRIGGER IF EXISTS validate_project_checksum_trigger ON projects;
CREATE TRIGGER validate_project_checksum_trigger
  BEFORE INSERT OR UPDATE ON projects
  FOR EACH ROW
  EXECUTE FUNCTION validate_project_checksum();

-- View for project statistics
CREATE OR REPLACE VIEW project_stats AS
SELECT 
  user_id,
  COUNT(*) as total_projects,
  SUM(asset_count) as total_assets,
  SUM(file_size) as total_storage_bytes,
  SUM(file_size) / 1024 / 1024 as total_storage_mb,
  MIN(created_at) as first_project_created,
  MAX(updated_at) as last_project_updated
FROM projects
GROUP BY user_id;

-- Grant access to authenticated users
GRANT SELECT ON project_stats TO authenticated;

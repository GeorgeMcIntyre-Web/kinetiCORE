-- Migration: Add R2 Support to Asset Library
-- Date: 2025-10-23
-- Description: Adds file URL columns for Cloudflare R2 integration

-- Add R2 URL columns to library_assets table
ALTER TABLE IF EXISTS library_assets ADD COLUMN IF NOT EXISTS file_url TEXT;
ALTER TABLE IF EXISTS library_assets ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;
ALTER TABLE IF EXISTS library_assets ADD COLUMN IF NOT EXISTS mesh_files JSONB DEFAULT '[]'::jsonb;

-- Add comment describing the columns
COMMENT ON COLUMN library_assets.file_url IS 'Cloudflare R2 URL for the main asset file';
COMMENT ON COLUMN library_assets.thumbnail_url IS 'Cloudflare R2 URL for the thumbnail image';
COMMENT ON COLUMN library_assets.mesh_files IS 'Array of Cloudflare R2 URLs for mesh files (URDF/MJCF)';

-- Add index for file_url lookups
CREATE INDEX IF NOT EXISTS idx_library_assets_file_url ON library_assets(file_url);

-- Add index for mesh_files JSONB searches
CREATE INDEX IF NOT EXISTS idx_library_assets_mesh_files ON library_assets USING GIN (mesh_files);

-- Update existing assets to have file URLs (if migrating from Supabase Storage)
-- Uncomment and customize this if you're migrating existing assets:
-- UPDATE library_assets 
-- SET file_url = 'https://api.kineticore.io/assets/' || file_path
-- WHERE file_url IS NULL AND file_path IS NOT NULL;

-- Add function to validate file URLs
CREATE OR REPLACE FUNCTION validate_file_url()
RETURNS TRIGGER AS $$
BEGIN
  -- Ensure file_url starts with https:// and contains /assets/
  IF NEW.file_url IS NOT NULL AND NOT (NEW.file_url ~ '^https?://.*(/assets/)') THEN
    RAISE EXCEPTION 'Invalid file_url format. Must be a valid HTTPS URL with /assets/ path';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add trigger to validate file URLs on insert/update
DROP TRIGGER IF EXISTS validate_file_url_trigger ON library_assets;
CREATE TRIGGER validate_file_url_trigger
  BEFORE INSERT OR UPDATE ON library_assets
  FOR EACH ROW
  EXECUTE FUNCTION validate_file_url();

-- Add function to count mesh files
CREATE OR REPLACE FUNCTION get_mesh_file_count(asset_id UUID)
RETURNS INTEGER AS $$
  SELECT jsonb_array_length(mesh_files) 
  FROM library_assets 
  WHERE id = asset_id;
$$ LANGUAGE SQL;

-- Add view for assets with R2 integration status
CREATE OR REPLACE VIEW library_assets_r2_status AS
SELECT 
  id,
  name,
  file_path,
  file_url,
  thumbnail_url,
  CASE 
    WHEN file_url IS NOT NULL THEN 'r2'
    WHEN file_path IS NOT NULL THEN 'legacy'
    ELSE 'none'
  END AS storage_type,
  jsonb_array_length(mesh_files) AS mesh_count,
  file_size
FROM library_assets;

-- Grant access to the view
GRANT SELECT ON library_assets_r2_status TO authenticated;
GRANT SELECT ON library_assets_r2_status TO anon;

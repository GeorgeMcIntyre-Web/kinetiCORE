-- kinetiCORE Asset Management Database Schema
-- Migration: 20240101000000_create_asset_tables.sql
-- Owner: George

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "btree_gin";

-- Create custom types
CREATE TYPE asset_visibility AS ENUM ('private', 'team', 'organization', 'public');
CREATE TYPE asset_status AS ENUM ('draft', 'published', 'archived');
CREATE TYPE permission_level AS ENUM ('view', 'edit', 'admin');
CREATE TYPE user_role AS ENUM ('individual', 'team_member', 'team_admin', 'enterprise_admin');

-- Users table (extends Supabase auth.users)
CREATE TABLE public.user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  avatar_url TEXT,
  role user_role DEFAULT 'individual',
  organization_id UUID,
  team_ids UUID[] DEFAULT '{}',
  preferences JSONB DEFAULT '{}',
  storage_used BIGINT DEFAULT 0,
  storage_limit BIGINT DEFAULT 1073741824, -- 1GB default
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Teams table
CREATE TABLE public.teams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  owner_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Team members table
CREATE TABLE public.team_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  role permission_level DEFAULT 'view',
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  invited_by UUID REFERENCES public.user_profiles(id),
  status TEXT DEFAULT 'active',
  UNIQUE(team_id, user_id)
);

-- Assets table
CREATE TABLE public.assets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  domain TEXT DEFAULT 'general',
  asset_class TEXT DEFAULT 'structures',
  asset_type TEXT DEFAULT 'generic',
  loader_type TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  mime_type TEXT NOT NULL,
  checksum TEXT NOT NULL,
  thumbnail_url TEXT,
  mesh_data_url TEXT,
  
  -- Ownership and permissions
  owner_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  visibility asset_visibility DEFAULT 'private',
  status asset_status DEFAULT 'draft',
  
  -- Metadata
  tags TEXT[] DEFAULT '{}',
  search_keywords TEXT[] DEFAULT '{}',
  capabilities TEXT[] DEFAULT '{}',
  custom_metadata JSONB DEFAULT '{}',
  
  -- Analytics
  view_count INTEGER DEFAULT 0,
  download_count INTEGER DEFAULT 0,
  usage_count INTEGER DEFAULT 0,
  rating DECIMAL(3,2) DEFAULT 0,
  rating_count INTEGER DEFAULT 0,
  popularity_score DECIMAL(5,2) DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_used TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Asset metadata table
CREATE TABLE public.asset_metadata (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  asset_id UUID NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  
  -- Classification
  domain TEXT NOT NULL,
  asset_class TEXT NOT NULL,
  asset_type TEXT NOT NULL,
  category TEXT,
  subcategory TEXT,
  
  -- Technical metadata
  complexity TEXT DEFAULT 'medium',
  polygon_count INTEGER,
  texture_count INTEGER,
  material_count INTEGER,
  animation_count INTEGER,
  physics_enabled BOOLEAN DEFAULT FALSE,
  collision_geometry BOOLEAN DEFAULT FALSE,
  bounding_box JSONB,
  center_of_mass JSONB,
  inertia_matrix JSONB,
  
  -- Searchable content
  keywords TEXT[] DEFAULT '{}',
  manufacturers TEXT[] DEFAULT '{}',
  models TEXT[] DEFAULT '{}',
  part_numbers TEXT[] DEFAULT '{}',
  standards TEXT[] DEFAULT '{}',
  certifications TEXT[] DEFAULT '{}',
  
  -- Quality metrics
  validation_status TEXT DEFAULT 'pending',
  validation_errors TEXT[] DEFAULT '{}',
  quality_score INTEGER DEFAULT 0,
  optimization_level TEXT DEFAULT 'none',
  compression_ratio DECIMAL(5,2),
  lod_levels INTEGER,
  
  -- AI-generated metadata
  ai_tags TEXT[] DEFAULT '{}',
  ai_description TEXT,
  ai_category TEXT,
  ai_complexity TEXT,
  ai_use_cases TEXT[] DEFAULT '{}',
  ai_technical_specs JSONB DEFAULT '{}',
  ai_confidence DECIMAL(3,2),
  ai_last_analyzed TIMESTAMP WITH TIME ZONE,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Asset versions table
CREATE TABLE public.asset_versions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  asset_id UUID NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  version_number TEXT NOT NULL,
  branch_name TEXT DEFAULT 'main',
  parent_version_id UUID REFERENCES public.asset_versions(id),
  merge_from_version_id UUID REFERENCES public.asset_versions(id),
  
  -- Version info
  name TEXT NOT NULL,
  description TEXT,
  changes JSONB DEFAULT '[]',
  tags TEXT[] DEFAULT '{}',
  
  -- File info
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  checksum TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  
  -- Creation info
  created_by UUID NOT NULL REFERENCES public.user_profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Status
  status TEXT DEFAULT 'draft',
  is_stable BOOLEAN DEFAULT FALSE,
  is_public BOOLEAN DEFAULT FALSE,
  
  -- Review process
  reviewers UUID[] DEFAULT '{}',
  approved_by UUID[] DEFAULT '{}',
  rejected_by UUID[] DEFAULT '{}',
  review_comments JSONB DEFAULT '[]',
  review_deadline TIMESTAMP WITH TIME ZONE,
  
  -- Analytics
  download_count INTEGER DEFAULT 0,
  view_count INTEGER DEFAULT 0,
  usage_count INTEGER DEFAULT 0,
  last_used TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Dependencies
  requires UUID[] DEFAULT '{}',
  conflicts UUID[] DEFAULT '{}',
  compatible_with UUID[] DEFAULT '{}',
  
  UNIQUE(asset_id, version_number)
);

-- Asset collaborators table
CREATE TABLE public.asset_collaborators (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  asset_id UUID NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  permission permission_level NOT NULL,
  added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  added_by UUID NOT NULL REFERENCES public.user_profiles(id),
  last_active_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status TEXT DEFAULT 'active',
  access_level TEXT DEFAULT 'full',
  custom_permissions JSONB DEFAULT '{}',
  UNIQUE(asset_id, user_id)
);

-- Asset comments table
CREATE TABLE public.asset_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  asset_id UUID NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  version_id UUID REFERENCES public.asset_versions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  type TEXT DEFAULT 'comment',
  status TEXT DEFAULT 'active',
  parent_comment_id UUID REFERENCES public.asset_comments(id) ON DELETE CASCADE,
  mentions UUID[] DEFAULT '{}',
  attachments JSONB DEFAULT '[]',
  reactions JSONB DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolved_by UUID REFERENCES public.user_profiles(id)
);

-- Asset share requests table
CREATE TABLE public.asset_share_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  asset_id UUID NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  requested_by UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  requested_from UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  permission permission_level NOT NULL,
  message TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE,
  approved_at TIMESTAMP WITH TIME ZONE,
  rejected_at TIMESTAMP WITH TIME ZONE,
  approved_by UUID REFERENCES public.user_profiles(id),
  rejected_by UUID REFERENCES public.user_profiles(id),
  rejection_reason TEXT
);

-- Asset analytics table
CREATE TABLE public.asset_analytics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  asset_id UUID NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  event_data JSONB DEFAULT '{}',
  session_id TEXT,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Storage buckets configuration
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('user-assets', 'user-assets', false, 104857600, ARRAY['application/xml', 'model/gltf-binary', 'model/gltf+json', 'application/octet-stream', 'image/png', 'image/jpeg']),
  ('shared-assets', 'shared-assets', false, 104857600, ARRAY['application/xml', 'model/gltf-binary', 'model/gltf+json', 'application/octet-stream', 'image/png', 'image/jpeg']),
  ('thumbnails', 'thumbnails', true, 5242880, ARRAY['image/png', 'image/jpeg', 'image/webp']),
  ('mesh-data', 'mesh-data', false, 52428800, ARRAY['application/octet-stream', 'model/gltf-binary']);

-- Enable Row Level Security
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_collaborators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_share_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_analytics ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_profiles
CREATE POLICY "Users can view own profile" ON public.user_profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.user_profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.user_profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- RLS Policies for teams
CREATE POLICY "Team members can view team" ON public.teams
  FOR SELECT USING (
    owner_id = auth.uid() OR 
    id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Team owners can manage team" ON public.teams
  FOR ALL USING (owner_id = auth.uid());

-- RLS Policies for team_members
CREATE POLICY "Team members can view team members" ON public.team_members
  FOR SELECT USING (
    team_id IN (SELECT id FROM public.teams WHERE owner_id = auth.uid()) OR
    user_id = auth.uid()
  );

CREATE POLICY "Team owners can manage team members" ON public.team_members
  FOR ALL USING (
    team_id IN (SELECT id FROM public.teams WHERE owner_id = auth.uid())
  );

-- RLS Policies for assets
CREATE POLICY "Users can view own assets" ON public.assets
  FOR SELECT USING (owner_id = auth.uid());

CREATE POLICY "Users can view shared assets" ON public.assets
  FOR SELECT USING (
    owner_id = auth.uid() OR
    id IN (SELECT asset_id FROM public.asset_collaborators WHERE user_id = auth.uid()) OR
    visibility = 'public' OR
    (visibility = 'team' AND owner_id IN (
      SELECT user_id FROM public.team_members 
      WHERE team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid())
    ))
  );

CREATE POLICY "Users can insert own assets" ON public.assets
  FOR INSERT WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can update own assets" ON public.assets
  FOR UPDATE USING (owner_id = auth.uid());

CREATE POLICY "Users can delete own assets" ON public.assets
  FOR DELETE USING (owner_id = auth.uid());

-- RLS Policies for asset_metadata
CREATE POLICY "Users can view asset metadata" ON public.asset_metadata
  FOR SELECT USING (
    asset_id IN (SELECT id FROM public.assets WHERE 
      owner_id = auth.uid() OR
      id IN (SELECT asset_id FROM public.asset_collaborators WHERE user_id = auth.uid()) OR
      visibility = 'public'
    )
  );

CREATE POLICY "Asset owners can manage metadata" ON public.asset_metadata
  FOR ALL USING (
    asset_id IN (SELECT id FROM public.assets WHERE owner_id = auth.uid())
  );

-- RLS Policies for asset_versions
CREATE POLICY "Users can view asset versions" ON public.asset_versions
  FOR SELECT USING (
    asset_id IN (SELECT id FROM public.assets WHERE 
      owner_id = auth.uid() OR
      id IN (SELECT asset_id FROM public.asset_collaborators WHERE user_id = auth.uid()) OR
      visibility = 'public'
    )
  );

CREATE POLICY "Asset owners can manage versions" ON public.asset_versions
  FOR ALL USING (
    asset_id IN (SELECT id FROM public.assets WHERE owner_id = auth.uid())
  );

-- RLS Policies for asset_collaborators
CREATE POLICY "Users can view collaborators" ON public.asset_collaborators
  FOR SELECT USING (
    asset_id IN (SELECT id FROM public.assets WHERE 
      owner_id = auth.uid() OR
      id IN (SELECT asset_id FROM public.asset_collaborators WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "Asset owners can manage collaborators" ON public.asset_collaborators
  FOR ALL USING (
    asset_id IN (SELECT id FROM public.assets WHERE owner_id = auth.uid())
  );

-- RLS Policies for asset_comments
CREATE POLICY "Users can view comments" ON public.asset_comments
  FOR SELECT USING (
    asset_id IN (SELECT id FROM public.assets WHERE 
      owner_id = auth.uid() OR
      id IN (SELECT asset_id FROM public.asset_collaborators WHERE user_id = auth.uid()) OR
      visibility = 'public'
    )
  );

CREATE POLICY "Users can insert comments" ON public.asset_comments
  FOR INSERT WITH CHECK (
    user_id = auth.uid() AND
    asset_id IN (SELECT id FROM public.assets WHERE 
      owner_id = auth.uid() OR
      id IN (SELECT asset_id FROM public.asset_collaborators WHERE user_id = auth.uid()) OR
      visibility = 'public'
    )
  );

CREATE POLICY "Users can update own comments" ON public.asset_comments
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete own comments" ON public.asset_comments
  FOR DELETE USING (user_id = auth.uid());

-- RLS Policies for asset_share_requests
CREATE POLICY "Users can view own share requests" ON public.asset_share_requests
  FOR SELECT USING (requested_by = auth.uid() OR requested_from = auth.uid());

CREATE POLICY "Users can create share requests" ON public.asset_share_requests
  FOR INSERT WITH CHECK (
    requested_by = auth.uid() AND
    asset_id IN (SELECT id FROM public.assets WHERE owner_id = auth.uid())
  );

CREATE POLICY "Users can update own share requests" ON public.asset_share_requests
  FOR UPDATE USING (requested_by = auth.uid() OR requested_from = auth.uid());

-- RLS Policies for asset_analytics
CREATE POLICY "Users can view own analytics" ON public.asset_analytics
  FOR SELECT USING (
    user_id = auth.uid() OR
    asset_id IN (SELECT id FROM public.assets WHERE owner_id = auth.uid())
  );

CREATE POLICY "System can insert analytics" ON public.asset_analytics
  FOR INSERT WITH CHECK (true);

-- Create indexes for performance
CREATE INDEX idx_assets_owner_id ON public.assets(owner_id);
CREATE INDEX idx_assets_visibility ON public.assets(visibility);
CREATE INDEX idx_assets_tags ON public.assets USING gin(tags);
CREATE INDEX idx_assets_search_keywords ON public.assets USING gin(search_keywords);
CREATE INDEX idx_assets_created_at ON public.assets(created_at);
CREATE INDEX idx_assets_popularity_score ON public.assets(popularity_score);

CREATE INDEX idx_asset_metadata_asset_id ON public.asset_metadata(asset_id);
CREATE INDEX idx_asset_metadata_domain ON public.asset_metadata(domain);
CREATE INDEX idx_asset_metadata_asset_class ON public.asset_metadata(asset_class);
CREATE INDEX idx_asset_metadata_keywords ON public.asset_metadata USING gin(keywords);
CREATE INDEX idx_asset_metadata_manufacturers ON public.asset_metadata USING gin(manufacturers);

CREATE INDEX idx_asset_versions_asset_id ON public.asset_versions(asset_id);
CREATE INDEX idx_asset_versions_version_number ON public.asset_versions(version_number);
CREATE INDEX idx_asset_versions_created_at ON public.asset_versions(created_at);

CREATE INDEX idx_asset_collaborators_asset_id ON public.asset_collaborators(asset_id);
CREATE INDEX idx_asset_collaborators_user_id ON public.asset_collaborators(user_id);

CREATE INDEX idx_asset_comments_asset_id ON public.asset_comments(asset_id);
CREATE INDEX idx_asset_comments_user_id ON public.asset_comments(user_id);
CREATE INDEX idx_asset_comments_created_at ON public.asset_comments(created_at);

CREATE INDEX idx_asset_share_requests_asset_id ON public.asset_share_requests(asset_id);
CREATE INDEX idx_asset_share_requests_requested_by ON public.asset_share_requests(requested_by);
CREATE INDEX idx_asset_share_requests_requested_from ON public.asset_share_requests(requested_from);

CREATE INDEX idx_asset_analytics_asset_id ON public.asset_analytics(asset_id);
CREATE INDEX idx_asset_analytics_user_id ON public.asset_analytics(user_id);
CREATE INDEX idx_asset_analytics_event_type ON public.asset_analytics(event_type);
CREATE INDEX idx_asset_analytics_created_at ON public.asset_analytics(created_at);

-- Create full-text search indexes
CREATE INDEX idx_assets_fulltext ON public.assets USING gin(
  to_tsvector('english', name || ' ' || COALESCE(description, '') || ' ' || array_to_string(tags, ' '))
);

CREATE INDEX idx_asset_metadata_fulltext ON public.asset_metadata USING gin(
  to_tsvector('english', array_to_string(keywords, ' ') || ' ' || array_to_string(manufacturers, ' '))
);

-- Create functions for common operations
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_teams_updated_at BEFORE UPDATE ON public.teams
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_assets_updated_at BEFORE UPDATE ON public.assets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_asset_metadata_updated_at BEFORE UPDATE ON public.asset_metadata
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_asset_comments_updated_at BEFORE UPDATE ON public.asset_comments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function to calculate popularity score
CREATE OR REPLACE FUNCTION public.calculate_popularity_score(
  view_count INTEGER,
  download_count INTEGER,
  usage_count INTEGER,
  rating DECIMAL,
  rating_count INTEGER
) RETURNS DECIMAL AS $$
BEGIN
  RETURN LEAST(100, GREATEST(0, 
    (view_count * 1.0 + 
     download_count * 3.0 + 
     usage_count * 5.0 + 
     rating * rating_count * 2.0) / 10.0
  ));
END;
$$ LANGUAGE plpgsql;

-- Function to update asset analytics
CREATE OR REPLACE FUNCTION public.update_asset_analytics(
  p_asset_id UUID,
  p_event_type TEXT,
  p_event_data JSONB DEFAULT '{}'
) RETURNS VOID AS $$
BEGIN
  -- Insert analytics record
  INSERT INTO public.asset_analytics (asset_id, user_id, event_type, event_data)
  VALUES (p_asset_id, auth.uid(), p_event_type, p_event_data);
  
  -- Update asset counters
  IF p_event_type = 'view' THEN
    UPDATE public.assets 
    SET view_count = view_count + 1, last_used = NOW()
    WHERE id = p_asset_id;
  ELSIF p_event_type = 'download' THEN
    UPDATE public.assets 
    SET download_count = download_count + 1, last_used = NOW()
    WHERE id = p_asset_id;
  ELSIF p_event_type = 'use' THEN
    UPDATE public.assets 
    SET usage_count = usage_count + 1, last_used = NOW()
    WHERE id = p_asset_id;
  END IF;
  
  -- Recalculate popularity score
  UPDATE public.assets 
  SET popularity_score = public.calculate_popularity_score(
    view_count, download_count, usage_count, rating, rating_count
  )
  WHERE id = p_asset_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

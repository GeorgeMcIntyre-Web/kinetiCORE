// Generated Supabase types
export interface Database {
  public: {
    Tables: {
      user_profiles: {
        Row: {
          id: string;
          email: string;
          name: string;
          avatar_url: string | null;
          role: 'individual' | 'team_member' | 'team_admin' | 'enterprise_admin';
          organization_id: string | null;
          team_ids: string[];
          preferences: Record<string, any>;
          storage_used: number;
          storage_limit: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          name: string;
          avatar_url?: string | null;
          role?: 'individual' | 'team_member' | 'team_admin' | 'enterprise_admin';
          organization_id?: string | null;
          team_ids?: string[];
          preferences?: Record<string, any>;
          storage_used?: number;
          storage_limit?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          name?: string;
          avatar_url?: string | null;
          role?: 'individual' | 'team_member' | 'team_admin' | 'enterprise_admin';
          organization_id?: string | null;
          team_ids?: string[];
          preferences?: Record<string, any>;
          storage_used?: number;
          storage_limit?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      assets: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          domain: string;
          asset_class: string;
          asset_type: string;
          loader_type: string;
          file_path: string;
          file_size: number;
          mime_type: string;
          checksum: string;
          thumbnail_url: string | null;
          mesh_data_url: string | null;
          owner_id: string;
          visibility: 'private' | 'team' | 'organization' | 'public';
          status: 'draft' | 'published' | 'archived';
          tags: string[];
          search_keywords: string[];
          capabilities: string[];
          custom_metadata: Record<string, any>;
          view_count: number;
          download_count: number;
          usage_count: number;
          rating: number;
          rating_count: number;
          popularity_score: number;
          created_at: string;
          updated_at: string;
          last_used: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          domain?: string;
          asset_class?: string;
          asset_type?: string;
          loader_type: string;
          file_path: string;
          file_size: number;
          mime_type: string;
          checksum: string;
          thumbnail_url?: string | null;
          mesh_data_url?: string | null;
          owner_id: string;
          visibility?: 'private' | 'team' | 'organization' | 'public';
          status?: 'draft' | 'published' | 'archived';
          tags?: string[];
          search_keywords?: string[];
          capabilities?: string[];
          custom_metadata?: Record<string, any>;
          view_count?: number;
          download_count?: number;
          usage_count?: number;
          rating?: number;
          rating_count?: number;
          popularity_score?: number;
          created_at?: string;
          updated_at?: string;
          last_used?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          domain?: string;
          asset_class?: string;
          asset_type?: string;
          loader_type?: string;
          file_path?: string;
          file_size?: number;
          mime_type?: string;
          checksum?: string;
          thumbnail_url?: string | null;
          mesh_data_url?: string | null;
          owner_id?: string;
          visibility?: 'private' | 'team' | 'organization' | 'public';
          status?: 'draft' | 'published' | 'archived';
          tags?: string[];
          search_keywords?: string[];
          capabilities?: string[];
          custom_metadata?: Record<string, any>;
          view_count?: number;
          download_count?: number;
          usage_count?: number;
          rating?: number;
          rating_count?: number;
          popularity_score?: number;
          created_at?: string;
          updated_at?: string;
          last_used?: string;
        };
      };
      projects: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          description: string | null;
          data: Uint8Array;
          checksum: string;
          asset_count: number;
          file_size: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          description?: string | null;
          data: Uint8Array;
          checksum: string;
          asset_count?: number;
          file_size?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          description?: string | null;
          data?: Uint8Array;
          checksum?: string;
          asset_count?: number;
          file_size?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
  };
}

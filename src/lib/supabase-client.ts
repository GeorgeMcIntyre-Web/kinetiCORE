/**
 * Supabase Client for kinetiCORE Asset Library
 * Uses Cloudflare Worker as proxy for enhanced performance and security
 * File: src/lib/supabase-client.ts
 * Owner: George
 */

import { createClient } from '@supabase/supabase-js';

// Cloudflare Worker URL - acts as proxy to Supabase
const CLOUDFLARE_WORKER_URL = 'https://kineticore-supabase-proxy.fractalnexustech.workers.dev';

// Supabase configuration
const supabaseUrl = CLOUDFLARE_WORKER_URL;
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5oa3VzanNvdW56d2ttZXZqc2dsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjExODE5ODQsImV4cCI6MjA3Njc1Nzk4NH0.NCmILj-aOpHTPtygngkiXgPNekEb0hyJ6bA7132Ywrg';

// Database types for type safety
export interface Database {
  public: {
    Tables: {
      user_profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      assets: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          description: string | null;
          file_path: string;
          file_size: number;
          mime_type: string;
          storage_tier: 'local' | 'user' | 'shared';
          is_public: boolean;
          tags: string[];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          description?: string | null;
          file_path: string;
          file_size: number;
          mime_type: string;
          storage_tier?: 'local' | 'user' | 'shared';
          is_public?: boolean;
          tags?: string[];
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          description?: string | null;
          file_path?: string;
          file_size?: number;
          mime_type?: string;
          storage_tier?: 'local' | 'user' | 'shared';
          is_public?: boolean;
          tags?: string[];
          created_at?: string;
          updated_at?: string;
        };
      };
      asset_metadata: {
        Row: {
          id: string;
          asset_id: string;
          metadata: Record<string, any>;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          asset_id: string;
          metadata: Record<string, any>;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          asset_id?: string;
          metadata?: Record<string, any>;
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

// Singleton Supabase client to prevent multiple instances
let supabaseInstance: ReturnType<typeof createClient<Database>> | null = null;

function getSupabaseClient() {
  if (!supabaseInstance) {
    supabaseInstance = createClient<Database>(supabaseUrl, supabaseAnonKey, {
      auth: {
        // Use Cloudflare Worker for auth operations
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
        flowType: 'pkce'
      },
      global: {
        headers: {
          'X-Client-Info': 'kineticore-asset-library'
        }
      }
    });
  }
  return supabaseInstance;
}

// Export the singleton client
export const supabase = getSupabaseClient();
export const typedSupabase = supabase; // Alias for backward compatibility

// Helper functions for common operations
export const supabaseHelpers = {
  // Authentication
  async signUp(email: string, password: string) {
    return await supabase.auth.signUp({ email, password });
  },

  async signIn(email: string, password: string) {
    return await supabase.auth.signInWithPassword({ email, password });
  },

  async signOut() {
    return await supabase.auth.signOut();
  },

  async getCurrentUser() {
    const { data: { user } } = await supabase.auth.getUser();
    return user;
  },

  // Asset operations
  async uploadAsset(file: File, metadata: any) {
    const filePath = `assets/${Date.now()}-${file.name}`;
    
    // Upload to Supabase Storage via Cloudflare Worker
    const { error } = await supabase.storage
      .from('assets')
      .upload(filePath, file);

    if (error) throw error;

    // Save asset metadata to database
    const { data: assetData, error: dbError } = await supabase
      .from('assets')
      .insert({
        user_id: (await this.getCurrentUser())?.id || '',
        name: file.name,
        file_path: filePath,
        file_size: file.size,
        mime_type: file.type,
        storage_tier: 'user' as const,
        tags: metadata.tags || []
      })
      .select()
      .single();

    if (dbError) throw dbError;

    return assetData;
  },

  async getAssets() {
    const { data, error } = await supabase
      .from('assets')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  },

  async deleteAsset(assetId: string) {
    // Get asset info first
    const { data: asset, error: fetchError } = await supabase
      .from('assets')
      .select('file_path')
      .eq('id', assetId)
      .single();

    if (fetchError) throw fetchError;

    // Delete from storage
    const { error: storageError } = await supabase.storage
      .from('assets')
      .remove([asset?.file_path || '']);

    if (storageError) throw storageError;

    // Delete from database
    const { error: dbError } = await supabase
      .from('assets')
      .delete()
      .eq('id', assetId);

    if (dbError) throw dbError;
  }
};

export default supabase;
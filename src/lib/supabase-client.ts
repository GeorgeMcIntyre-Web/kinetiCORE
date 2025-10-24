/**
 * Supabase Client for kinetiCORE Asset Library
 * Uses Cloudflare Worker as proxy for enhanced performance and security
 * File: src/lib/supabase-client.ts
 * Owner: George
 */

import { createClient } from '@supabase/supabase-js';

// Environment variable configuration
// In production (Cloudflare Pages), use worker proxy for better performance
// In development, can use direct Supabase URL
const supabaseUrl = import.meta.env.VITE_CLOUDFLARE_WORKER_URL ||
                    import.meta.env.VITE_SUPABASE_URL ||
                    'https://kineticore-supabase-proxy.fractalnexustech.workers.dev';

const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ||
                        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5oa3VzanNvdW56d2ttZXZqc2dsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjExODE5ODQsImV4cCI6MjA3Njc1Nzk4NH0.NCmILj-aOpHTPtygngkiXgPNekEb0hyJ6bA7132Ywrg';

// Singleton Supabase client to prevent multiple instances
let supabaseInstance: any = null;

function getSupabaseClient() {
  if (!supabaseInstance) {
    supabaseInstance = createClient(supabaseUrl, supabaseAnonKey, {
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
        owner_id: (await this.getCurrentUser())?.id || '',
        name: file.name,
        file_path: filePath,
        file_size: file.size,
        mime_type: file.type,
        checksum: '', // TODO: Calculate actual checksum
        loader_type: 'generic',
        visibility: 'private' as const,
        status: 'draft' as const,
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
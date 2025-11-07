// kinetiCORE Asset Processor Edge Function
// File: supabase/functions/asset-processor/index.ts
// Owner: George

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface AssetProcessingRequest {
  assetId: string;
  operation: 'generate-thumbnail' | 'extract-metadata' | 'optimize-asset' | 'validate-asset';
  options?: {
    thumbnailSize?: { width: number; height: number };
    optimizationLevel?: 'basic' | 'advanced' | 'professional';
    validationRules?: string[];
  };
}

interface ProcessingResult {
  success: boolean;
  data?: any;
  error?: string;
  processingTime: number;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { assetId, operation, options }: AssetProcessingRequest = await req.json()

    if (!assetId || !operation) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters: assetId, operation' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const startTime = Date.now()
    let result: ProcessingResult

    // Process based on operation type
    switch (operation) {
      case 'generate-thumbnail':
        result = await generateThumbnail(assetId, supabase, options)
        break
      case 'extract-metadata':
        result = await extractMetadata(assetId, supabase, options)
        break
      case 'optimize-asset':
        result = await optimizeAsset(assetId, supabase, options)
        break
      case 'validate-asset':
        result = await validateAsset(assetId, supabase, options)
        break
      default:
        return new Response(
          JSON.stringify({ error: `Unknown operation: ${operation}` }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
    }

    result.processingTime = Date.now() - startTime

    return new Response(
      JSON.stringify(result),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Asset processing error:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        processingTime: 0
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})

async function generateThumbnail(
  assetId: string, 
  supabase: any, 
  options?: any
): Promise<ProcessingResult> {
  try {
    // Get asset information
    const { data: asset, error: assetError } = await supabase
      .from('assets')
      .select('*')
      .eq('id', assetId)
      .single()

    if (assetError) throw assetError

    // Get file from storage
    const { data: fileData, error: fileError } = await supabase.storage
      .from('user-assets')
      .download(asset.file_path)

    if (fileError) throw fileError

    // Generate thumbnail based on file type
    let thumbnailData: Uint8Array
    const thumbnailSize = options?.thumbnailSize || { width: 256, height: 256 }

    if (asset.mime_type === 'application/xml' || asset.loader_type === 'urdf') {
      // For URDF files, generate a 3D preview thumbnail
      thumbnailData = await generateURDFThumbnail(fileData, thumbnailSize)
    } else if (asset.mime_type.startsWith('image/')) {
      // For image files, resize the image
      thumbnailData = await resizeImage(fileData, thumbnailSize)
    } else {
      // For other files, generate a generic icon
      thumbnailData = await generateGenericThumbnail(asset.loader_type, thumbnailSize)
    }

    // Upload thumbnail to storage
    const thumbnailPath = `thumbnails/${assetId}.jpg`
    const { error: uploadError } = await supabase.storage
      .from('thumbnails')
      .upload(thumbnailPath, thumbnailData, {
        contentType: 'image/jpeg',
        upsert: true
      })

    if (uploadError) throw uploadError

    // Update asset with thumbnail URL
    const { error: updateError } = await supabase
      .from('assets')
      .update({ thumbnail_url: thumbnailPath })
      .eq('id', assetId)

    if (updateError) throw updateError

    return {
      success: true,
      data: {
        thumbnailUrl: thumbnailPath,
        size: thumbnailSize
      }
    }

  } catch (error) {
    return {
      success: false,
      error: error.message
    }
  }
}

async function extractMetadata(
  assetId: string, 
  supabase: any, 
  _options?: any
): Promise<ProcessingResult> {
  try {
    // Get asset information
    const { data: asset, error: assetError } = await supabase
      .from('assets')
      .select('*')
      .eq('id', assetId)
      .single()

    if (assetError) throw assetError

    // Get file from storage
    const { data: fileData, error: fileError } = await supabase.storage
      .from('user-assets')
      .download(asset.file_path)

    if (fileError) throw fileError

    // Extract metadata based on file type
    let metadata: any = {}

    if (asset.loader_type === 'urdf') {
      metadata = await extractURDFMetadata(fileData)
    } else if (asset.loader_type === 'glb' || asset.loader_type === 'gltf') {
      metadata = await extractGLTFMetadata(fileData)
    } else if (asset.mime_type.startsWith('image/')) {
      metadata = await extractImageMetadata(fileData)
    } else {
      metadata = await extractGenericMetadata(fileData, asset)
    }

    // Update asset metadata
    const { error: updateError } = await supabase
      .from('asset_metadata')
      .upsert({
        asset_id: assetId,
        ...metadata,
        updated_at: new Date().toISOString()
      })

    if (updateError) throw updateError

    return {
      success: true,
      data: metadata
    }

  } catch (error) {
    return {
      success: false,
      error: error.message
    }
  }
}

async function optimizeAsset(
  assetId: string, 
  supabase: any, 
  options?: any
): Promise<ProcessingResult> {
  try {
    // Get asset information
    const { data: asset, error: assetError } = await supabase
      .from('assets')
      .select('*')
      .eq('id', assetId)
      .single()

    if (assetError) throw assetError

    // Get file from storage
    const { data: fileData, error: fileError } = await supabase.storage
      .from('user-assets')
      .download(asset.file_path)

    if (fileError) throw fileError

    const optimizationLevel = options?.optimizationLevel || 'basic'
    let optimizedData: Uint8Array
    let compressionRatio: number

    if (asset.loader_type === 'glb' || asset.loader_type === 'gltf') {
      const result = await optimizeGLTF(fileData, optimizationLevel)
      optimizedData = result.data
      compressionRatio = result.compressionRatio
    } else if (asset.mime_type.startsWith('image/')) {
      const result = await optimizeImage(fileData, optimizationLevel)
      optimizedData = result.data
      compressionRatio = result.compressionRatio
    } else {
      // For other file types, just compress
      const result = await compressFile(fileData, optimizationLevel)
      optimizedData = result.data
      compressionRatio = result.compressionRatio
    }

    // Upload optimized file
    const optimizedPath = `${asset.file_path}.optimized`
    const { error: uploadError } = await supabase.storage
      .from('user-assets')
      .upload(optimizedPath, optimizedData, {
        contentType: asset.mime_type,
        upsert: true
      })

    if (uploadError) throw uploadError

    // Update asset metadata with optimization info
    const { error: updateError } = await supabase
      .from('asset_metadata')
      .update({
        compression_ratio: compressionRatio,
        optimization_level: optimizationLevel,
        updated_at: new Date().toISOString()
      })
      .eq('asset_id', assetId)

    if (updateError) throw updateError

    return {
      success: true,
      data: {
        optimizedPath,
        compressionRatio,
        originalSize: asset.file_size,
        optimizedSize: optimizedData.length
      }
    }

  } catch (error) {
    return {
      success: false,
      error: error.message
    }
  }
}

async function validateAsset(
  assetId: string, 
  supabase: any, 
  options?: any
): Promise<ProcessingResult> {
  try {
    // Get asset information
    const { data: asset, error: assetError } = await supabase
      .from('assets')
      .select('*')
      .eq('id', assetId)
      .single()

    if (assetError) throw assetError

    const validationRules = options?.validationRules || ['basic']
    const errors: string[] = []
    const warnings: string[] = []
    let qualityScore = 100

    // Basic validation rules
    if (validationRules.includes('basic')) {
      // Check file size
      if (asset.file_size > 100 * 1024 * 1024) { // 100MB
        errors.push('File size exceeds 100MB limit')
        qualityScore -= 20
      }

      // Check file type
      const supportedTypes = ['urdf', 'glb', 'gltf', 'stl', 'obj', 'dwg', 'jt']
      if (!supportedTypes.includes(asset.loader_type)) {
        errors.push(`Unsupported file type: ${asset.loader_type}`)
        qualityScore -= 30
      }

      // Check name quality
      if (asset.name.length < 3) {
        errors.push('Asset name too short')
        qualityScore -= 10
      }

      // Check description
      if (!asset.description || asset.description.length < 10) {
        warnings.push('Missing or insufficient description')
        qualityScore -= 15
      }
    }

    // Advanced validation rules
    if (validationRules.includes('advanced')) {
      // Get file from storage for detailed validation
      const { data: fileData, error: fileError } = await supabase.storage
        .from('user-assets')
        .download(asset.file_path)

      if (!fileError && fileData) {
        const detailedValidation = await performDetailedValidation(fileData, asset)
        errors.push(...detailedValidation.errors)
        warnings.push(...detailedValidation.warnings)
        qualityScore -= detailedValidation.qualityPenalty
      }
    }

    // Update asset metadata with validation results
    const { error: updateError } = await supabase
      .from('asset_metadata')
      .update({
        validation_status: errors.length === 0 ? 'validated' : 'failed',
        validation_errors: errors,
        quality_score: Math.max(0, qualityScore),
        updated_at: new Date().toISOString()
      })
      .eq('asset_id', assetId)

    if (updateError) throw updateError

    return {
      success: true,
      data: {
        validationStatus: errors.length === 0 ? 'validated' : 'failed',
        errors,
        warnings,
        qualityScore: Math.max(0, qualityScore)
      }
    }

  } catch (error) {
    return {
      success: false,
      error: error.message
    }
  }
}

// Helper functions (simplified implementations)
async function generateURDFThumbnail(_fileData: any, _size: { width: number; height: number }): Promise<Uint8Array> {
  // In a real implementation, this would use a 3D rendering library
  // to generate a thumbnail from the URDF file
  return new Uint8Array(1024) // Placeholder
}

async function resizeImage(_fileData: any, _size: { width: number; height: number }): Promise<Uint8Array> {
  // In a real implementation, this would use an image processing library
  return new Uint8Array(1024) // Placeholder
}

async function generateGenericThumbnail(_fileType: string, _size: { width: number; height: number }): Promise<Uint8Array> {
  // Generate a generic icon based on file type
  return new Uint8Array(1024) // Placeholder
}

async function extractURDFMetadata(_fileData: any): Promise<any> {
  // Parse URDF XML and extract metadata
  return {
    domain: 'robotics',
    asset_class: 'machines',
    asset_type: 'robot',
    complexity: 'medium',
    keywords: ['robot', 'urdf', 'kinematics'],
    manufacturers: [],
    validation_status: 'validated'
  }
}

async function extractGLTFMetadata(_fileData: any): Promise<any> {
  // Parse GLTF/GLB and extract metadata
  return {
    domain: 'general',
    asset_class: 'structures',
    asset_type: 'mesh',
    complexity: 'medium',
    polygon_count: 1000,
    texture_count: 2,
    material_count: 3,
    keywords: ['3d', 'mesh', 'gltf'],
    validation_status: 'validated'
  }
}

async function extractImageMetadata(_fileData: any): Promise<any> {
  // Extract image metadata
  return {
    domain: 'general',
    asset_class: 'structures',
    asset_type: 'texture',
    complexity: 'simple',
    keywords: ['image', 'texture'],
    validation_status: 'validated'
  }
}

async function extractGenericMetadata(fileData: any, asset: any): Promise<any> {
  // Extract generic metadata
  return {
    domain: asset.domain || 'general',
    asset_class: asset.asset_class || 'structures',
    asset_type: asset.asset_type || 'generic',
    complexity: 'simple',
    keywords: asset.tags || [],
    validation_status: 'pending'
  }
}

async function optimizeGLTF(fileData: any, _level: string): Promise<{ data: Uint8Array; compressionRatio: number }> {
  // Optimize GLTF/GLB file
  return {
    data: new Uint8Array(fileData.length * 0.8), // 20% compression
    compressionRatio: 1.25
  }
}

async function optimizeImage(fileData: any, _level: string): Promise<{ data: Uint8Array; compressionRatio: number }> {
  // Optimize image file
  return {
    data: new Uint8Array(fileData.length * 0.7), // 30% compression
    compressionRatio: 1.43
  }
}

async function compressFile(fileData: any, _level: string): Promise<{ data: Uint8Array; compressionRatio: number }> {
  // Compress file
  return {
    data: new Uint8Array(fileData.length * 0.9), // 10% compression
    compressionRatio: 1.11
  }
}

async function performDetailedValidation(_fileData: any, _asset: any): Promise<{
  errors: string[];
  warnings: string[];
  qualityPenalty: number;
}> {
  // Perform detailed validation based on file type
  return {
    errors: [],
    warnings: [],
    qualityPenalty: 0
  }
}

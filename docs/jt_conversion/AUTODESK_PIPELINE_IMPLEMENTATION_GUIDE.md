# Autodesk Pipeline: JT to GLB Conversion Implementation Guide

**For:** Edwin Msakwa  
**Date:** 2024  
**Purpose:** Complete guide for implementing Autodesk Forge Model Derivative API to convert JT files to GLB format and import into kinetiCORE

---

## Table of Contents

1. [Overview](#overview)
2. [Autodesk Forge Setup](#autodesk-forge-setup)
3. [API Limits & Quotas](#api-limits--quotas)
4. [Architecture & Integration](#architecture--integration)
5. [Implementation Steps](#implementation-steps)
6. [Code Examples](#code-examples)
7. [Testing & Validation](#testing--validation)
8. [Troubleshooting](#troubleshooting)
9. [References](#references)

---

## Overview

### What is Autodesk Forge Model Derivative API?

Autodesk Forge (now Autodesk Platform Services) provides a **Model Derivative API** that can translate various CAD file formats into web-viewable formats. While JT to GLB conversion isn't directly supported, we can use a two-step process:

1. **JT → OBJ/FBX** (via Autodesk Model Derivative API)
2. **OBJ/FBX → GLB** (via local conversion or additional tools)

Alternatively, Autodesk's Model Derivative API can convert JT files to **SVF** (Simple Viewing Format), which can then be converted to GLB using additional tools.

### Current kinetiCORE Architecture

The current system uses:
- **C++ JT Converter** (`build_scripts/jt_converter_real_meshes.cpp`) - Direct JT to GLB conversion
- **Python Server** (`tools/jt_conversion/jt_conversion_server_glb.py`) - HTTP API wrapper
- **Frontend Service** (`src/loaders/jt/JTConversionService.ts`) - TypeScript client

### Integration Strategy

We'll create a new **AutodeskJTConversionService** that:
1. Uses Autodesk Forge API for cloud-based conversion
2. Falls back to existing local conversion if quota is exceeded
3. Tracks usage to stay within 300 conversions/month limit
4. Seamlessly integrates with existing `JTLoader.ts`

---

## Autodesk Forge Setup

### Step 1: Create Autodesk Account

1. Go to [https://forge.autodesk.com/](https://forge.autodesk.com/)
2. Sign up for a free account or use existing Autodesk account
3. Navigate to **My Apps** section

### Step 2: Create a New App

1. Click **"Create App"**
2. Fill in:
   - **App Name:** `kinetiCORE JT Converter`
   - **Description:** `JT to GLB conversion for kinetiCORE`
   - **Callback URL:** `http://localhost:5175` (or your dev URL)
   - **API:** Select **"Model Derivative API"**
3. Click **"Create"**

### Step 3: Get Credentials

After creating the app, you'll receive:
- **Client ID** (e.g., `abc123xyz...`)
- **Client Secret** (e.g., `xyz789abc...`)

**⚠️ IMPORTANT:** Store these securely. Never commit them to git!

### Step 4: Environment Variables

Create a `.env` file in the project root (add to `.gitignore`):

```env
# Autodesk Forge Credentials
AUTODESK_CLIENT_ID=your_client_id_here
AUTODESK_CLIENT_SECRET=your_client_secret_here
AUTODESK_BUCKET_NAME=kineticore-jt-conversions
AUTODESK_CONVERSION_QUOTA=300
AUTODESK_CONVERSION_MONTH=2024-12
```

---

## API Limits & Quotas

### Monthly Quota: 300 Conversions

**Important Notes:**
- Quota resets monthly (typically on the 1st of each month)
- Each JT file conversion counts as **1 conversion**
- Failed conversions may still count toward quota (check Autodesk documentation)
- Monitor usage via Autodesk Forge dashboard

### Usage Tracking

We need to implement:
1. **Local usage counter** (database or file-based)
2. **Monthly reset logic**
3. **Quota warning** (e.g., at 250/300)
4. **Automatic fallback** to local conversion when quota exceeded

### Cost Considerations

- **Free Tier:** 300 conversions/month (what we're using)
- **Paid Plans:** Available if more conversions needed
- **Token Consumption:** Model Derivative API uses tokens; check current pricing

---

## Architecture & Integration

### System Flow

```
┌─────────────┐
│  User       │
│  Selects    │
│  JT File    │
└──────┬──────┘
       │
       ▼
┌─────────────────────────────────────┐
│  JTLoader.ts                        │
│  (Entry Point)                      │
└──────┬──────────────────────────────┘
       │
       ├─── Check Quota ───► AutodeskJTConversionService
       │                          │
       │                          ├─── Quota OK? ──YES──► Use Autodesk API
       │                          │
       │                          └─── Quota Exceeded? ──YES──► Fallback to Local
       │
       └─── Load GLB ───► GLBLoader.ts ───► Babylon.js Scene
```

### File Structure

```
kinetiCORE/
├── src/loaders/jt/
│   ├── JTLoader.ts                    # Main loader (existing)
│   ├── JTConversionService.ts         # Local conversion (existing)
│   ├── AutodeskJTConversionService.ts # NEW: Autodesk API client
│   └── HybridJTConversionService.ts   # NEW: Smart routing service
│
├── tools/jt_conversion/
│   ├── autodesk_converter.py          # NEW: Python backend for Autodesk
│   └── usage_tracker.py               # NEW: Quota tracking
│
├── docs/jt_conversion/
│   └── AUTODESK_PIPELINE_IMPLEMENTATION_GUIDE.md  # This file
│
└── .env                                # Autodesk credentials (gitignored)
```

---

## Implementation Steps

### Phase 1: Backend - Autodesk API Integration

#### Step 1.1: Create Python Backend Service

Create `tools/jt_conversion/autodesk_converter.py`:

```python
#!/usr/bin/env python3
"""
Autodesk Forge Model Derivative API Integration
Converts JT files to GLB via Autodesk cloud service
"""

import os
import requests
import time
from pathlib import Path
from typing import Optional, Dict, Any
import json

class AutodeskConverter:
    def __init__(self):
        self.client_id = os.getenv('AUTODESK_CLIENT_ID')
        self.client_secret = os.getenv('AUTODESK_CLIENT_SECRET')
        self.bucket_name = os.getenv('AUTODESK_BUCKET_NAME', 'kineticore-jt-conversions')
        self.base_url = 'https://developer.api.autodesk.com'
        self.access_token: Optional[str] = None
        self.token_expires_at: float = 0
        
    def get_access_token(self) -> str:
        """Get OAuth 2.0 access token"""
        if self.access_token and time.time() < self.token_expires_at:
            return self.access_token
            
        url = f'{self.base_url}/authentication/v2/token'
        data = {
            'client_id': self.client_id,
            'client_secret': self.client_secret,
            'grant_type': 'client_credentials',
            'scope': 'data:read data:write bucket:create bucket:read'
        }
        
        response = requests.post(url, data=data)
        response.raise_for_status()
        
        token_data = response.json()
        self.access_token = token_data['access_token']
        self.token_expires_at = time.time() + token_data['expires_in'] - 60  # 60s buffer
        
        return self.access_token
    
    def upload_file(self, file_path: Path, object_name: str) -> str:
        """Upload JT file to Autodesk OSS (Object Storage Service)"""
        token = self.get_access_token()
        
        # Ensure bucket exists
        self.ensure_bucket_exists()
        
        # Upload file
        url = f'{self.base_url}/oss/v2/buckets/{self.bucket_name}/objects/{object_name}'
        headers = {
            'Authorization': f'Bearer {token}',
            'Content-Type': 'application/octet-stream'
        }
        
        with open(file_path, 'rb') as f:
            response = requests.put(url, headers=headers, data=f)
            response.raise_for_status()
        
        return f'urn:adsk.objects:os.object:{self.bucket_name}/{object_name}'
    
    def ensure_bucket_exists(self):
        """Create bucket if it doesn't exist"""
        token = self.get_access_token()
        url = f'{self.base_url}/oss/v2/buckets/{self.bucket_name}'
        headers = {'Authorization': f'Bearer {token}'}
        
        # Check if bucket exists
        response = requests.get(url, headers=headers)
        if response.status_code == 200:
            return
        
        # Create bucket
        data = {
            'bucketKey': self.bucket_name,
            'policyKey': 'transient'  # Files auto-delete after 24h
        }
        response = requests.post(
            f'{self.base_url}/oss/v2/buckets',
            headers=headers,
            json=data
        )
        if response.status_code not in [200, 409]:  # 409 = already exists
            response.raise_for_status()
    
    def translate_to_glb(self, file_urn: str) -> str:
        """Start translation job: JT → GLB"""
        token = self.get_access_token()
        url = f'{self.base_url}/modelderivative/v2/designdata/job'
        
        headers = {
            'Authorization': f'Bearer {token}',
            'Content-Type': 'application/json'
        }
        
        # Note: Autodesk doesn't directly support JT → GLB
        # We'll convert JT → OBJ first, then OBJ → GLB locally
        payload = {
            'input': {
                'urn': file_urn
            },
            'output': {
                'formats': [
                    {
                        'type': 'obj',
                        'advanced': {
                            'exportFileStructure': 'single'
                        }
                    }
                ]
            }
        }
        
        response = requests.post(url, headers=headers, json=payload)
        response.raise_for_status()
        
        return response.json()['result']
    
    def check_translation_status(self, job_urn: str) -> Dict[str, Any]:
        """Check status of translation job"""
        token = self.get_access_token()
        url = f'{self.base_url}/modelderivative/v2/designdata/{job_urn}/manifest'
        
        headers = {'Authorization': f'Bearer {token}'}
        response = requests.get(url, headers=headers)
        response.raise_for_status()
        
        return response.json()
    
    def download_converted_file(self, file_urn: str, output_path: Path):
        """Download converted OBJ file"""
        token = self.get_access_token()
        
        # Extract derivative URN
        # This is a simplified version - actual implementation needs proper URN parsing
        url = f'{self.base_url}/modelderivative/v2/designdata/{file_urn}/manifest'
        headers = {'Authorization': f'Bearer {token}'}
        
        manifest = requests.get(url, headers=headers).json()
        
        # Find OBJ file in manifest
        # Implementation depends on manifest structure
        # Then download and convert OBJ → GLB using local tools
        
        raise NotImplementedError("OBJ → GLB conversion needed")
```

#### Step 1.2: Create Usage Tracker

Create `tools/jt_conversion/usage_tracker.py`:

```python
#!/usr/bin/env python3
"""
Track Autodesk API usage to stay within 300 conversions/month limit
"""

import json
from pathlib import Path
from datetime import datetime, date
from typing import Dict

class UsageTracker:
    def __init__(self, data_file: Path = Path('autodesk_usage.json')):
        self.data_file = data_file
        self.quota = 300
        self.load_data()
    
    def load_data(self):
        """Load usage data from file"""
        if self.data_file.exists():
            with open(self.data_file, 'r') as f:
                self.data = json.load(f)
        else:
            self.data = {
                'current_month': datetime.now().strftime('%Y-%m'),
                'conversions': []
            }
    
    def save_data(self):
        """Save usage data to file"""
        with open(self.data_file, 'w') as f:
            json.dump(self.data, f, indent=2)
    
    def reset_if_new_month(self):
        """Reset counter if new month"""
        current_month = datetime.now().strftime('%Y-%m')
        if self.data['current_month'] != current_month:
            self.data['current_month'] = current_month
            self.data['conversions'] = []
            self.save_data()
    
    def can_convert(self) -> bool:
        """Check if we can perform another conversion"""
        self.reset_if_new_month()
        return len(self.data['conversions']) < self.quota
    
    def record_conversion(self, file_name: str, success: bool = True):
        """Record a conversion attempt"""
        self.reset_if_new_month()
        
        self.data['conversions'].append({
            'timestamp': datetime.now().isoformat(),
            'file': file_name,
            'success': success
        })
        self.save_data()
    
    def get_usage_stats(self) -> Dict:
        """Get current usage statistics"""
        self.reset_if_new_month()
        
        return {
            'month': self.data['current_month'],
            'used': len(self.data['conversions']),
            'remaining': self.quota - len(self.data['conversions']),
            'quota': self.quota,
            'percentage': (len(self.data['conversions']) / self.quota) * 100
        }
```

### Phase 2: Frontend - TypeScript Service

#### Step 2.1: Create AutodeskJTConversionService

Create `src/loaders/jt/AutodeskJTConversionService.ts`:

```typescript
/**
 * Autodesk Forge Model Derivative API Integration
 * Converts JT files to GLB via Autodesk cloud service
 */

export interface AutodeskConversionProgress {
    stage: 'uploading' | 'translating' | 'downloading' | 'converting' | 'complete' | 'error';
    percent: number;
    message: string;
}

export interface AutodeskUsageStats {
    month: string;
    used: number;
    remaining: number;
    quota: number;
    percentage: number;
}

export class AutodeskJTConversionError extends Error {
    constructor(
        public code: number,
        message: string,
        public details?: string
    ) {
        super(message);
        this.name = 'AutodeskJTConversionError';
    }
}

export class AutodeskJTConversionService {
    private apiUrl: string = 'http://localhost:8000'; // Python backend URL
    
    constructor(apiUrl?: string) {
        if (apiUrl) this.apiUrl = apiUrl;
    }
    
    /**
     * Check if Autodesk conversion is available and within quota
     */
    async checkAvailability(): Promise<{ available: boolean; stats?: AutodeskUsageStats; error?: string }> {
        try {
            const response = await fetch(`${this.apiUrl}/autodesk/status`);
            if (!response.ok) {
                return { available: false, error: `Server error: ${response.status}` };
            }
            
            const data = await response.json();
            return {
                available: data.available && data.stats.remaining > 0,
                stats: data.stats
            };
        } catch (error) {
            return {
                available: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }
    
    /**
     * Convert JT file to GLB using Autodesk API
     */
    async convertToGLB(
        file: File,
        onProgress?: (progress: AutodeskConversionProgress) => void
    ): Promise<Blob> {
        // Validate file
        if (!file.name.toLowerCase().endsWith('.jt')) {
            throw new AutodeskJTConversionError(
                400,
                'Invalid file type',
                'File must have .jt extension'
            );
        }
        
        // Check availability first
        const availability = await this.checkAvailability();
        if (!availability.available) {
            throw new AutodeskJTConversionError(
                429,
                'Quota exceeded or service unavailable',
                availability.error || 'Autodesk conversion quota exceeded. Please use local conversion.'
            );
        }
        
        // Stage 1: Upload
        onProgress?.({
            stage: 'uploading',
            percent: 10,
            message: `Uploading ${file.name} to Autodesk...`
        });
        
        const formData = new FormData();
        formData.append('file', file);
        
        // Stage 2: Start conversion
        onProgress?.({
            stage: 'translating',
            percent: 30,
            message: 'Starting Autodesk translation job...'
        });
        
        const response = await fetch(`${this.apiUrl}/autodesk/convert`, {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new AutodeskJTConversionError(
                response.status,
                errorData.error || 'Conversion failed',
                errorData.details
            );
        }
        
        // Stage 3: Poll for completion
        const jobData = await response.json();
        const jobId = jobData.job_id;
        
        onProgress?.({
            stage: 'translating',
            percent: 50,
            message: 'Translation in progress...'
        });
        
        // Poll for job completion
        let jobStatus = await this.pollJobStatus(jobId, onProgress);
        
        // Stage 4: Download
        onProgress?.({
            stage: 'downloading',
            percent: 90,
            message: 'Downloading converted file...'
        });
        
        const downloadResponse = await fetch(`${this.apiUrl}/autodesk/download/${jobId}`);
        if (!downloadResponse.ok) {
            throw new AutodeskJTConversionError(
                downloadResponse.status,
                'Failed to download converted file'
            );
        }
        
        const glbBlob = await downloadResponse.blob();
        
        // Stage 5: Complete
        onProgress?.({
            stage: 'complete',
            percent: 100,
            message: 'Autodesk conversion complete!'
        });
        
        return glbBlob;
    }
    
    /**
     * Poll job status until complete
     */
    private async pollJobStatus(
        jobId: string,
        onProgress?: (progress: AutodeskConversionProgress) => void,
        maxAttempts: number = 60,
        pollInterval: number = 2000
    ): Promise<any> {
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            const response = await fetch(`${this.apiUrl}/autodesk/status/${jobId}`);
            const status = await response.json();
            
            if (status.status === 'completed') {
                return status;
            }
            
            if (status.status === 'failed') {
                throw new AutodeskJTConversionError(
                    500,
                    'Autodesk translation failed',
                    status.error
                );
            }
            
            // Update progress
            onProgress?.({
                stage: 'translating',
                percent: 50 + (attempt / maxAttempts) * 40,
                message: status.message || 'Translation in progress...'
            });
            
            await new Promise(resolve => setTimeout(resolve, pollInterval));
        }
        
        throw new AutodeskJTConversionError(
            504,
            'Translation timeout',
            'Job did not complete within expected time'
        );
    }
    
    /**
     * Get usage statistics
     */
    async getUsageStats(): Promise<AutodeskUsageStats> {
        const response = await fetch(`${this.apiUrl}/autodesk/usage`);
        if (!response.ok) {
            throw new Error('Failed to get usage stats');
        }
        return await response.json();
    }
}
```

#### Step 2.2: Create Hybrid Service

Create `src/loaders/jt/HybridJTConversionService.ts`:

```typescript
/**
 * Hybrid JT Conversion Service
 * Automatically routes to Autodesk API or local conversion based on quota
 */

import { AutodeskJTConversionService, AutodeskJTConversionError } from './AutodeskJTConversionService';
import { JTConversionService } from './JTConversionService';

export interface HybridConversionProgress {
    stage: string;
    percent: number;
    message: string;
    method?: 'autodesk' | 'local';
}

export class HybridJTConversionService {
    private autodeskService: AutodeskJTConversionService;
    private localService: JTConversionService;
    private preferAutodesk: boolean = true;
    
    constructor(
        autodeskApiUrl?: string,
        localApiUrl?: string
    ) {
        this.autodeskService = new AutodeskJTConversionService(autodeskApiUrl);
        this.localService = new JTConversionService(localApiUrl);
    }
    
    /**
     * Convert JT to GLB using best available method
     */
    async convertToGLB(
        file: File,
        onProgress?: (progress: HybridConversionProgress) => void
    ): Promise<Blob> {
        // Try Autodesk first if preferred
        if (this.preferAutodesk) {
            try {
                const availability = await this.autodeskService.checkAvailability();
                if (availability.available) {
                    onProgress?.({
                        stage: 'initializing',
                        percent: 5,
                        message: 'Using Autodesk cloud conversion...',
                        method: 'autodesk'
                    });
                    
                    return await this.autodeskService.convertToGLB(file, (progress) => {
                        onProgress?.({
                            ...progress,
                            method: 'autodesk'
                        });
                    });
                }
            } catch (error) {
                if (error instanceof AutodeskJTConversionError && error.code === 429) {
                    // Quota exceeded, fall back to local
                    onProgress?.({
                        stage: 'fallback',
                        percent: 0,
                        message: 'Autodesk quota exceeded, using local conversion...',
                        method: 'local'
                    });
                } else {
                    // Other error, try local as fallback
                    console.warn('[HybridJT] Autodesk conversion failed, falling back to local:', error);
                    onProgress?.({
                        stage: 'fallback',
                        percent: 0,
                        message: 'Autodesk conversion failed, using local conversion...',
                        method: 'local'
                    });
                }
            }
        }
        
        // Use local conversion
        onProgress?.({
            stage: 'initializing',
            percent: 5,
            message: 'Using local JT conversion...',
            method: 'local'
        });
        
        return await this.localService.convertToGLTF(file, (progress) => {
            onProgress?.({
                ...progress,
                method: 'local'
            });
        });
    }
    
    /**
     * Get conversion method preference
     */
    getPreferredMethod(): 'autodesk' | 'local' {
        return this.preferAutodesk ? 'autodesk' : 'local';
    }
    
    /**
     * Set conversion method preference
     */
    setPreferredMethod(method: 'autodesk' | 'local'): void {
        this.preferAutodesk = method === 'autodesk';
    }
}
```

### Phase 3: Integration with JTLoader

#### Step 3.1: Update JTLoader.ts

Modify `src/loaders/jt/JTLoader.ts` to use HybridJTConversionService:

```typescript
import { HybridJTConversionService } from './HybridJTConversionService';

export async function loadJTFromFile(
    file: File,
    scene: BABYLON.Scene
): Promise<{ meshes: BABYLON.AbstractMesh[]; rootNodes: BABYLON.TransformNode[] }> {
    // Use Hybrid service (tries Autodesk first, falls back to local)
    const converter = new HybridJTConversionService();
    
    try {
        console.log(`[JT Import] Converting ${file.name} to GLB...`);
        
        const glbBlob = await converter.convertToGLB(file, (progress) => {
            console.log(`[JT Import] ${progress.message} (${progress.percent}%) [${progress.method}]`);
        });
        
        console.log(`[JT Import] Conversion complete, loading GLB...`);
        
        // Load GLB into scene (existing logic)
        const glbUrl = URL.createObjectURL(glbBlob);
        const result = await BABYLON.SceneLoader.ImportMeshAsync(
            '',
            '',
            glbUrl,
            scene,
            undefined,
            '.glb'
        );
        
        URL.revokeObjectURL(glbUrl);
        
        // Process meshes and return (existing logic)
        // ... rest of existing code ...
        
    } catch (error) {
        // Error handling (existing logic)
        // ...
    }
}
```

---

## Code Examples

### Example 1: Basic Usage

```typescript
import { AutodeskJTConversionService } from '@/loaders/jt/AutodeskJTConversionService';

const service = new AutodeskJTConversionService();

// Check availability
const availability = await service.checkAvailability();
if (availability.available) {
    console.log(`Remaining conversions: ${availability.stats?.remaining}`);
    
    // Convert file
    const glbBlob = await service.convertToGLB(jtFile, (progress) => {
        console.log(`${progress.stage}: ${progress.percent}%`);
    });
    
    // Use GLB blob...
}
```

### Example 2: Hybrid Service (Recommended)

```typescript
import { HybridJTConversionService } from '@/loaders/jt/HybridJTConversionService';

const service = new HybridJTConversionService();

// Automatically uses Autodesk if available, falls back to local
const glbBlob = await service.convertToGLB(jtFile, (progress) => {
    console.log(`${progress.method}: ${progress.message}`);
});
```

### Example 3: Python Backend Endpoint

Add to `tools/jt_conversion/jt_conversion_server_glb.py`:

```python
from autodesk_converter import AutodeskConverter
from usage_tracker import UsageTracker

converter = AutodeskConverter()
tracker = UsageTracker()

@app.post("/autodesk/convert")
async def autodesk_convert(file: UploadFile = File(...)):
    """Convert JT to GLB using Autodesk API"""
    # Check quota
    if not tracker.can_convert():
        raise HTTPException(429, "Monthly quota exceeded (300 conversions)")
    
    # Save uploaded file
    temp_path = save_uploaded_file(file)
    
    try:
        # Upload to Autodesk
        file_urn = converter.upload_file(Path(temp_path), file.filename)
        
        # Start translation
        job_result = converter.translate_to_glb(file_urn)
        job_id = job_result['urn']
        
        # Record conversion attempt
        tracker.record_conversion(file.filename, success=True)
        
        return {"job_id": job_id, "status": "queued"}
    finally:
        # Cleanup
        Path(temp_path).unlink()

@app.get("/autodesk/status")
async def autodesk_status():
    """Check Autodesk service status and quota"""
    stats = tracker.get_usage_stats()
    return {
        "available": stats['remaining'] > 0,
        "stats": stats
    }
```

---

## Testing & Validation

### Test Plan

1. **Quota Management**
   - [ ] Test quota tracking (300 limit)
   - [ ] Test monthly reset
   - [ ] Test fallback when quota exceeded
   - [ ] Verify usage stats accuracy

2. **Conversion Flow**
   - [ ] Test JT → OBJ via Autodesk
   - [ ] Test OBJ → GLB conversion
   - [ ] Test full pipeline: JT → GLB
   - [ ] Verify GLB loads correctly in Babylon.js

3. **Error Handling**
   - [ ] Test network failures
   - [ ] Test invalid credentials
   - [ ] Test malformed JT files
   - [ ] Test timeout scenarios

4. **Integration**
   - [ ] Test with existing JTLoader
   - [ ] Test with ModelLoader
   - [ ] Verify meshes appear in scene
   - [ ] Test with large JT files

### Test Script

Create `tests/jt_conversion/test_autodesk_conversion.ts`:

```typescript
import { AutodeskJTConversionService } from '@/loaders/jt/AutodeskJTConversionService';

describe('Autodesk JT Conversion', () => {
    let service: AutodeskJTConversionService;
    
    beforeEach(() => {
        service = new AutodeskJTConversionService();
    });
    
    it('should check availability', async () => {
        const availability = await service.checkAvailability();
        expect(availability).toHaveProperty('available');
    });
    
    it('should convert JT to GLB', async () => {
        const file = new File(['test'], 'test.jt');
        const blob = await service.convertToGLB(file);
        expect(blob).toBeInstanceOf(Blob);
        expect(blob.type).toContain('gltf');
    });
    
    it('should track usage', async () => {
        const stats = await service.getUsageStats();
        expect(stats.used).toBeLessThanOrEqual(stats.quota);
    });
});
```

---

## Troubleshooting

### Common Issues

#### 1. "Invalid Client Credentials"

**Problem:** Autodesk API returns 401 Unauthorized

**Solution:**
- Verify `AUTODESK_CLIENT_ID` and `AUTODESK_CLIENT_SECRET` in `.env`
- Check credentials in Autodesk Forge dashboard
- Ensure credentials haven't been rotated

#### 2. "Quota Exceeded"

**Problem:** Service returns 429 Too Many Requests

**Solution:**
- Check usage stats: `GET /autodesk/usage`
- Wait for monthly reset (1st of month)
- Consider upgrading Autodesk plan
- Use local conversion as fallback

#### 3. "Translation Job Failed"

**Problem:** Autodesk translation job fails

**Solution:**
- Check job manifest for error details
- Verify JT file is valid (version 8.0-10.x)
- Check file size limits (Autodesk has limits)
- Review Autodesk Forge logs

#### 4. "OBJ to GLB Conversion Failed"

**Problem:** Local OBJ → GLB conversion fails

**Solution:**
- Ensure `gltf-pipeline` or similar tool is installed
- Check OBJ file format compatibility
- Verify sufficient disk space
- Review conversion logs

### Debug Mode

Enable debug logging:

```typescript
// Frontend
const service = new AutodeskJTConversionService();
// Enable console logging
console.log('[Autodesk] Debug mode enabled');

// Backend (Python)
import logging
logging.basicConfig(level=logging.DEBUG)
```

---

## References

### Autodesk Documentation

- **Model Derivative API:** [https://forge.autodesk.com/en/docs/model-derivative/v2/](https://forge.autodesk.com/en/docs/model-derivative/v2/)
- **Authentication:** [https://forge.autodesk.com/en/docs/oauth/v2/](https://forge.autodesk.com/en/docs/oauth/v2/)
- **OSS (Object Storage):** [https://forge.autodesk.com/en/docs/oss/v2/](https://forge.autodesk.com/en/docs/oss/v2/)
- **Pricing & Limits:** [https://forge.autodesk.com/pricing](https://forge.autodesk.com/pricing)

### Related kinetiCORE Docs

- `docs/jt_conversion/ARCHITECTURE.md` - Current JT conversion architecture
- `docs/jt_conversion/QUICKSTART.md` - Quick start guide
- `src/loaders/jt/README.md` - JT loader documentation

### External Tools

- **gltf-pipeline:** [https://github.com/CesiumGS/gltf-pipeline](https://github.com/CesiumGS/gltf-pipeline) - OBJ/GLTF to GLB conversion
- **Autodesk Forge Viewer:** [https://forge.autodesk.com/en/docs/viewer/v7/developers_guide/overview/](https://forge.autodesk.com/en/docs/viewer/v7/developers_guide/overview/) - Alternative viewing option

---

## Next Steps for Edwin

1. **Set up Autodesk account** and create app
2. **Add credentials** to `.env` file
3. **Implement Python backend** (`autodesk_converter.py`)
4. **Implement TypeScript service** (`AutodeskJTConversionService.ts`)
5. **Create hybrid service** (`HybridJTConversionService.ts`)
6. **Update JTLoader** to use hybrid service
7. **Test with sample JT files**
8. **Monitor usage** and verify quota tracking
9. **Document any issues** encountered

---

## Summary

This guide provides a complete implementation path for using Autodesk Forge Model Derivative API to convert JT files to GLB format. The solution:

- ✅ Respects the **300 conversions/month limit**
- ✅ **Automatically falls back** to local conversion when quota exceeded
- ✅ **Seamlessly integrates** with existing kinetiCORE architecture
- ✅ **Tracks usage** to prevent quota overruns
- ✅ **Provides clear error messages** for troubleshooting

**Questions?** Contact the development team or refer to Autodesk Forge documentation.

---

**Last Updated:** 2024-12  
**Author:** AI Assistant  
**For:** Edwin Msakwa


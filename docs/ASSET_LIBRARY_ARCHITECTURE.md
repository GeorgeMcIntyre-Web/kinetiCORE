# Asset Library Architecture

**Owner:** George McIntyre (Agent 1)
**Status:** Architecture Complete, Cloud Integration Pending
**Last Updated:** 2025-10-26

---

## Overview

The Asset Library system provides cloud-based storage and management of 3D models, robots, and scenes with user authentication, versioning, and CDN caching.

### Key Features
- ✅ User-aware asset management
- ✅ Cloud storage (Supabase)
- ✅ Version control
- ✅ Metadata indexing
- ✅ CDN caching
- ✅ Search and filtering
- ⏳ Local/cloud sync (pending)

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        kinetiCORE UI                            │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │          AssetLibraryPanelV2 (React Component)           │  │
│  │  ┌────────────┐  ┌────────────┐  ┌──────────────┐       │  │
│  │  │ BrowserPane│  │FilterPane  │  │DetailsPane   │       │  │
│  │  │  (Grid)    │  │ (Search)   │  │ (Info)       │       │  │
│  │  └────────────┘  └────────────┘  └──────────────┘       │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                   Asset Management Layer                         │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │          UserAwareAssetManager (Main Facade)             │  │
│  │  ┌─────────────┐  ┌──────────────┐  ┌───────────────┐   │  │
│  │  │AssetLibrary │  │AssetMetadata │  │AssetVersion   │   │  │
│  │  │Manager      │  │Manager       │  │Manager        │   │  │
│  │  └─────────────┘  └──────────────┘  └───────────────┘   │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                   Storage & Sync Layer                           │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  AssetUploadService    AssetExporter    CDNCacheManager  │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                   Backend Services                               │
│  ┌────────────┐  ┌──────────────┐  ┌──────────────────┐        │
│  │  Supabase  │  │  Supabase    │  │  Cloudflare      │        │
│  │  Auth      │  │  Storage     │  │  CDN             │        │
│  │  (Users)   │  │  (Assets)    │  │  (Cache)         │        │
│  └────────────┘  └──────────────┘  └──────────────────┘        │
└─────────────────────────────────────────────────────────────────┘
```

---

## Component Details

### 1. UI Layer

#### AssetLibraryPanelV2
**File:** [src/ui/components/AssetLibrary/AssetLibraryPanelV2.tsx](../src/ui/components/AssetLibrary/AssetLibraryPanelV2.tsx)

**Responsibilities:**
- Main asset library UI container
- Coordinates BrowserPane, FilterPane, DetailsPane
- Handles user interactions (select, upload, delete)
- Displays loading states and errors

**Key Features:**
- Grid/list view toggle
- Thumbnail previews
- Drag-and-drop upload
- Context menu actions

#### BrowserPane
**File:** [src/ui/components/AssetLibrary/BrowserPane.tsx](../src/ui/components/AssetLibrary/BrowserPane.tsx)

**Responsibilities:**
- Display asset grid/list
- Thumbnail generation
- Selection handling
- Infinite scroll

#### FilterPane
**File:** [src/ui/components/AssetLibrary/FilterPane.tsx](../src/ui/components/AssetLibrary/FilterPane.tsx)

**Responsibilities:**
- Search by name, tags, type
- Filter by category, date, user
- Sort options

#### DetailsPane
**File:** [src/ui/components/AssetLibrary/DetailsPane.tsx](../src/ui/components/AssetLibrary/DetailsPane.tsx)

**Responsibilities:**
- Asset metadata display
- Version history
- Usage statistics
- Download/delete actions

---

### 2. Management Layer

#### UserAwareAssetManager
**File:** [src/library/UserAwareAssetManager.ts](../src/library/UserAwareAssetManager.ts)

**Main Facade** for asset operations. Coordinates all subsystems.

**API:**
```typescript
class UserAwareAssetManager {
  // Asset CRUD
  async createAsset(data: AssetData): Promise<Asset>
  async getAsset(id: string): Promise<Asset | null>
  async updateAsset(id: string, updates: Partial<AssetData>): Promise<Asset>
  async deleteAsset(id: string): Promise<void>

  // User-specific
  async getUserAssets(userId: string): Promise<Asset[]>
  async shareAsset(assetId: string, userId: string): Promise<void>

  // Search
  async searchAssets(query: SearchQuery): Promise<Asset[]>
}
```

#### AssetLibraryManager
**File:** [src/library/AssetLibraryManager.ts](../src/library/AssetLibraryManager.ts)

**Responsibilities:**
- Core asset registry
- In-memory caching
- Asset lifecycle management

**API:**
```typescript
class AssetLibraryManager {
  addAsset(asset: Asset): void
  getAsset(id: string): Asset | undefined
  getAllAssets(): Asset[]
  removeAsset(id: string): void
  filterAssets(predicate: (asset: Asset) => boolean): Asset[]
}
```

#### AssetMetadataManager
**File:** [src/library/AssetMetadataManager.ts](../src/library/AssetMetadataManager.ts)

**Responsibilities:**
- Metadata extraction from 3D models
- Thumbnail generation
- Tag management
- Search indexing

**API:**
```typescript
class AssetMetadataManager {
  async extractMetadata(file: File): Promise<AssetMetadata>
  async generateThumbnail(mesh: Mesh): Promise<Blob>
  updateTags(assetId: string, tags: string[]): void
  searchByTags(tags: string[]): Asset[]
}
```

#### AssetVersionManager
**File:** [src/library/AssetVersionManager.ts](../src/library/AssetVersionManager.ts)

**Responsibilities:**
- Version control (v1, v2, v3...)
- Diff tracking
- Rollback support
- Changelog management

**API:**
```typescript
class AssetVersionManager {
  async createVersion(assetId: string, data: AssetData): Promise<Version>
  async getVersionHistory(assetId: string): Promise<Version[]>
  async rollback(assetId: string, versionId: string): Promise<void>
  async compareVersions(v1: string, v2: string): Promise<Diff>
}
```

---

### 3. Storage & Sync Layer

#### AssetUploadService
**File:** [src/library/AssetUploadService.ts](../src/library/AssetUploadService.ts)

**Responsibilities:**
- Upload assets to Supabase Storage
- Progress tracking
- Retry logic
- Chunked uploads for large files

**API:**
```typescript
class AssetUploadService {
  async upload(
    file: File,
    metadata: AssetMetadata,
    onProgress?: (percent: number) => void
  ): Promise<UploadResult>

  async uploadMultiple(files: File[]): Promise<UploadResult[]>
  cancelUpload(uploadId: string): void
}
```

**Upload Flow:**
```
1. User selects file(s)
2. Validate file type/size
3. Extract metadata
4. Generate thumbnail
5. Upload to Supabase Storage
6. Create database entry
7. Update local cache
8. Notify UI
```

#### AssetExporter
**File:** [src/library/AssetExporter.ts](../src/library/AssetExporter.ts)

**Responsibilities:**
- Export 3D models to various formats (OBJ, GLTF, USD)
- Scene serialization
- Robot configuration export

**API:**
```typescript
class AssetExporter {
  async exportToOBJ(mesh: Mesh): Promise<Blob>
  async exportToGLTF(scene: Scene): Promise<Blob>
  async exportToUSD(scene: Scene): Promise<Blob>
  async exportRobotConfig(robot: Robot): Promise<Blob>
}
```

#### CDNCacheManager
**File:** [src/library/CDNCacheManager.ts](../src/library/CDNCacheManager.ts)

**Responsibilities:**
- CDN cache management (Cloudflare)
- Cache invalidation
- Cache warming
- Performance optimization

**API:**
```typescript
class CDNCacheManager {
  async cacheAsset(url: string): Promise<void>
  async invalidateCache(assetId: string): Promise<void>
  async warmCache(assetIds: string[]): Promise<void>
  getCacheStatus(url: string): CacheStatus
}
```

---

### 4. Backend Services

#### Supabase Auth
**File:** [src/lib/supabase-client.ts](../src/lib/supabase-client.ts)

**Configuration:**
```typescript
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
)
```

**Features:**
- User registration/login
- OAuth providers (Google, GitHub)
- Session management
- Row-level security (RLS)

#### Supabase Storage
**Bucket:** `kineticore-assets`

**Structure:**
```
kineticore-assets/
├── users/
│   └── {user_id}/
│       ├── models/
│       │   ├── {asset_id}.obj
│       │   ├── {asset_id}.gltf
│       │   └── {asset_id}.mtl
│       ├── thumbnails/
│       │   └── {asset_id}.png
│       └── metadata/
│           └── {asset_id}.json
└── public/
    └── shared/
        └── {asset_id}/...
```

**Database Schema:**
```sql
-- Assets table
CREATE TABLE assets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id),
  name TEXT NOT NULL,
  type TEXT NOT NULL, -- 'model', 'robot', 'scene'
  format TEXT NOT NULL, -- 'obj', 'gltf', 'urdf', etc.
  size_bytes BIGINT,
  storage_path TEXT,
  thumbnail_url TEXT,
  metadata JSONB,
  tags TEXT[],
  version INT DEFAULT 1,
  is_public BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Versions table
CREATE TABLE asset_versions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  asset_id UUID REFERENCES assets(id) ON DELETE CASCADE,
  version INT NOT NULL,
  storage_path TEXT,
  changelog TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(asset_id, version)
);

-- Sharing table
CREATE TABLE asset_shares (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  asset_id UUID REFERENCES assets(id) ON DELETE CASCADE,
  shared_with_user_id UUID REFERENCES auth.users(id),
  permission TEXT DEFAULT 'view', -- 'view' or 'edit'
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### Cloudflare CDN
**Proxy:** kineticore-supabase-proxy.fractalnexustech.workers.dev

**Features:**
- Asset caching
- Global distribution
- DDoS protection
- Analytics

---

## Data Flow

### Upload Asset Flow
```
1. User clicks "Upload" in AssetLibraryPanelV2
2. File picker opens
3. User selects file (e.g., robot.obj)
4. AssetMetadataManager.extractMetadata(file)
   - Parse OBJ to count vertices/faces
   - Extract bounding box
   - Generate preview mesh
5. AssetMetadataManager.generateThumbnail(mesh)
   - Render 256x256 preview
   - Save as PNG blob
6. AssetUploadService.upload(file, metadata)
   a. Upload OBJ to Supabase Storage
   b. Upload thumbnail
   c. Upload metadata JSON
   d. Create database entry
7. UserAwareAssetManager.createAsset(data)
   - Add to local cache
   - Update UI state
8. AssetLibraryPanelV2 shows new asset in grid
```

### Download Asset Flow
```
1. User clicks asset in grid
2. DetailsPane shows metadata
3. User clicks "Load Model"
4. CDNCacheManager checks cache
5. If cached: Return cached URL
6. If not cached:
   a. Fetch from Supabase Storage
   b. Cache in CDN
   c. Return URL
7. Load asset into scene
```

---

## Testing Strategy

### Unit Tests

**AssetMetadataManager:**
```typescript
describe('AssetMetadataManager', () => {
  it('should extract metadata from OBJ file')
  it('should generate thumbnail from mesh')
  it('should calculate bounding box correctly')
  it('should detect file format automatically')
})
```

**AssetVersionManager:**
```typescript
describe('AssetVersionManager', () => {
  it('should create new version')
  it('should rollback to previous version')
  it('should compare versions (diff)')
  it('should limit version history to 10')
})
```

### Integration Tests

**Upload/Download Flow:**
```typescript
describe('Asset Library Integration', () => {
  it('should upload asset to Supabase', async () => {
    const file = new File([objData], 'test.obj')
    const result = await uploadService.upload(file, metadata)
    expect(result.success).toBe(true)
    expect(result.url).toContain('supabase.co')
  })

  it('should retrieve user assets', async () => {
    const assets = await assetManager.getUserAssets(userId)
    expect(assets.length).toBeGreaterThan(0)
  })
})
```

### E2E Tests

**User Journey:**
```typescript
describe('Asset Library E2E', () => {
  it('should complete full upload/download cycle', async () => {
    // 1. Login
    await login(testUser)

    // 2. Upload asset
    await uploadAsset('robot.obj')

    // 3. Verify in library
    const assets = await getAssets()
    expect(assets).toContain('robot.obj')

    // 4. Download asset
    await loadAsset('robot.obj')

    // 5. Verify in scene
    const meshes = scene.getMeshes()
    expect(meshes.length).toBeGreaterThan(0)
  })
})
```

---

## Performance Optimization

### Caching Strategy
1. **Local Cache:** In-memory asset metadata (fast access)
2. **Browser Cache:** Thumbnails and small assets (localStorage)
3. **CDN Cache:** Large assets (Cloudflare, 24h TTL)
4. **Database Cache:** Frequently accessed metadata (Redis, if needed)

### Lazy Loading
- Load thumbnails as user scrolls
- Load full assets only when selected
- Paginate asset list (100 per page)

### Compression
- GLTF with Draco compression
- PNG thumbnails (optimize with pngquant)
- OBJ files (gzip on server)

---

## Security

### Authentication
- Supabase Auth with JWT tokens
- OAuth providers: Google, GitHub
- Session expiry: 1 hour
- Refresh tokens: 30 days

### Authorization (RLS)
```sql
-- Users can only see their own assets
CREATE POLICY "Users can view own assets"
  ON assets FOR SELECT
  USING (auth.uid() = user_id);

-- Users can only upload to their own folder
CREATE POLICY "Users can insert own assets"
  ON assets FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can delete only their own assets
CREATE POLICY "Users can delete own assets"
  ON assets FOR DELETE
  USING (auth.uid() = user_id);

-- Shared assets visible to shared users
CREATE POLICY "Users can view shared assets"
  ON assets FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM asset_shares
      WHERE asset_id = assets.id
      AND shared_with_user_id = auth.uid()
    )
  );
```

### File Validation
- Check file extensions (`.obj`, `.gltf`, `.urdf`)
- Limit file size (max 100MB per asset)
- Scan for malware (ClamAV integration, if needed)
- Validate file format (parse OBJ header)

---

## Current Status

### ✅ Completed
- AssetLibraryPanelV2 UI
- UserAwareAssetManager facade
- AssetMetadataManager
- AssetVersionManager
- Supabase client configuration
- Database schema design

### ⏳ Pending
- **Issue #2:** Cloud storage integration testing
  - Upload test
  - Download test
  - Auth flow validation
- CDN configuration
- Performance optimization
- E2E testing

---

## Next Steps

1. **Test Upload Flow:**
   - Create test OBJ file
   - Upload to Supabase Storage
   - Verify database entry
   - Check thumbnail generation

2. **Test Download Flow:**
   - Fetch asset from Supabase
   - Load into Babylon.js scene
   - Verify mesh renders correctly

3. **Test Auth Flow:**
   - Sign up new user
   - Login existing user
   - Upload asset (verify user isolation)
   - Share asset with another user

4. **Performance Testing:**
   - Upload 100 assets
   - Measure load time
   - Test pagination
   - Verify CDN caching

---

## References

- **Supabase Docs:** https://supabase.com/docs
- **Cloudflare CDN:** https://developers.cloudflare.com/cache/
- **Babylon.js AssetManager:** https://doc.babylonjs.com/features/featuresDeepDive/importers/assetManager
- **Project Status:** [PROJECT_STATUS.md](../PROJECT_STATUS.md)

---

**Last Updated:** 2025-10-26
**Owner:** George McIntyre (Agent 1)

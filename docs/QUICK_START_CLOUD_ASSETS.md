# Cloud Asset Storage - Quick Start Guide

**Feature Branch:** `feature/cloud-asset-library`
**Status:** Ready to implement
**Owner:** George

---

## What We're Building

A **cloud-based asset storage and delivery system** that enables kinetiCORE to:
- Host 100+ industrial robot models on Cloudflare's global CDN
- Load assets in <2 seconds from anywhere in the world
- Support versioning and collaborative asset sharing
- Enable user uploads and custom asset libraries
- Reduce app bundle size by 500MB+ (no local assets)

---

## Technology Stack

### Cloudflare Platform (All Free Tier)

| Service | Purpose | Why |
|---------|---------|-----|
| **R2 Storage** | Object storage for robot models | Zero egress fees, S3-compatible |
| **Workers** | API endpoints | Serverless, global edge computing |
| **D1** | Metadata database | SQLite at the edge, FTS search |
| **KV** | Manifest cache | Ultra-fast key-value cache |
| **CDN** | Asset delivery | Automatic with R2, 285+ cities |

**Total Cost:** $0/month (within generous free tier)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     kinetiCORE Client                       │
│  ┌──────────────────┐         ┌─────────────────────────┐  │
│  │ AssetLibraryPanel│─────────│ AssetLibraryManager    │  │
│  │  (React UI)      │         │  (Search/Filter Logic) │  │
│  └──────────────────┘         └───────────┬─────────────┘  │
│                                            │                │
│                                  ┌─────────▼─────────────┐  │
│                                  │  CloudAssetLoader     │  │
│                                  │  (Download & Cache)   │  │
│                                  └─────────┬─────────────┘  │
└────────────────────────────────────────────┼────────────────┘
                                             │
                                    HTTPS    │
                                             ▼
┌─────────────────────────────────────────────────────────────┐
│                    Cloudflare Edge Network                  │
│                                                             │
│  ┌────────────────┐     ┌──────────────┐   ┌────────────┐  │
│  │ Workers API    │────▶│  KV Cache    │   │ R2 Storage │  │
│  │ (Asset Search) │     │ (Manifests)  │   │ (3D Files) │  │
│  └───────┬────────┘     └──────────────┘   └─────┬──────┘  │
│          │                                        │         │
│          ▼                                        ▼         │
│  ┌──────────────┐                        ┌────────────────┐ │
│  │ D1 Database  │                        │   CDN Cache    │ │
│  │ (Metadata)   │                        │ (Global Edge)  │ │
│  └──────────────┘                        └────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

## Storage Structure

```
R2 Bucket: kineticore-assets
│
├── manifests/
│   ├── global-manifest.json          # Master catalog
│   ├── manufacturing.json             # Domain manifests
│   └── medical.json
│
├── packages/
│   └── mujoco-menagerie/
│       ├── franka_emika_panda/
│       │   ├── v1.0.0/
│       │   │   ├── panda.xml          # MJCF model
│       │   │   ├── scene.xml
│       │   │   ├── assets/
│       │   │   │   ├── link0.stl      # Meshes
│       │   │   │   ├── link1.stl
│       │   │   │   └── ...
│       │   │   ├── metadata.json      # Searchable metadata
│       │   │   └── thumbnail.png
│       │   └── latest -> v1.0.0       # Version alias
│       │
│       ├── unitree_go2/
│       │   └── v1.0.0/...
│       └── ...
│
└── thumbnails/
    ├── franka_panda_256x256.webp
    └── ...
```

**CDN URLs:**
```
https://assets.kineticore.io/packages/mujoco-menagerie/franka_emika_panda/v1.0.0/panda.xml
https://assets.kineticore.io/packages/mujoco-menagerie/franka_emika_panda/latest/assets/link0.stl
```

---

## Implementation Phases

### Phase 1: Foundation (2 weeks) 🏗️
**Goal:** Set up cloud infrastructure

- [ ] Create Cloudflare account and services
- [ ] Set up R2 bucket with folder structure
- [ ] Create D1 database schema
- [ ] Build basic Workers API (`GET /v1/assets`, `GET /v1/manifests/global`)
- [ ] Configure custom domain `assets.kineticore.io`

**Milestone:** API returns empty manifest, CDN is accessible

---

### Phase 2: Asset Ingestion (2 weeks) 📦
**Goal:** Import MuJoCo Menagerie to cloud

- [ ] Write import script (Node.js)
- [ ] Parse MuJoCo Menagerie folder structure
- [ ] Extract metadata from README files
- [ ] Upload 50+ robots to R2
- [ ] Generate global manifest
- [ ] Populate D1 database

**Milestone:** 50+ robots available via CDN, searchable via API

---

### Phase 3: Client Integration (2 weeks) 🔌
**Goal:** Update kinetiCORE to load cloud assets

- [ ] Create `CloudAssetLoader.ts`
- [ ] Update `AssetLibraryManager.ts` to fetch from API
- [ ] Implement IndexedDB caching
- [ ] Update MJCF/URDF loaders for remote meshes
- [ ] Add download progress UI
- [ ] Add cloud/local asset badges

**Milestone:** kinetiCORE loads assets from CDN, with local fallback

---

### Phase 4: Upload & Versioning (2 weeks) ⬆️
**Goal:** Enable asset uploads

- [ ] Build upload API (`POST /v1/upload/*`)
- [ ] Create validation Worker
- [ ] Build web UI for uploads
- [ ] Implement versioning system
- [ ] Create CLI upload tool

**Milestone:** Users can upload custom robots to cloud

---

### Phase 5: Advanced Features (2 weeks) 🚀
**Goal:** Add polish and optimization

- [ ] Full-text search (FTS5)
- [ ] Asset analytics dashboard
- [ ] Mesh compression (Draco)
- [ ] User authentication
- [ ] Collaborative features (comments, ratings)

**Milestone:** Production-grade asset library with advanced features

---

### Phase 6: Production Hardening (2 weeks) 🔒
**Goal:** Prepare for launch

- [ ] Performance optimization
- [ ] Monitoring & logging
- [ ] Security hardening
- [ ] Load testing
- [ ] Documentation
- [ ] Backup/disaster recovery

**Milestone:** Production launch 🚀

---

## Key Workflows

### Workflow 1: User Loads an Asset

1. User opens Asset Library panel
2. `AssetLibraryManager` fetches `global-manifest.json` from API
3. User searches for "franka panda"
4. API queries D1 database with FTS search
5. Results displayed with thumbnails
6. User drags asset to viewport
7. `CloudAssetLoader` requests download URLs
8. Worker returns signed CDN URLs for all files
9. Client downloads MJCF + meshes in parallel
10. Files cached in IndexedDB
11. MJCF parser instantiates robot in scene

**Performance:** <2s (cached), <10s (cold load)

---

### Workflow 2: Upload a Custom Robot

1. User clicks "Upload Asset" in UI
2. Drag-and-drop robot folder (MJCF + meshes)
3. Fill metadata form (name, manufacturer, DOF, etc.)
4. Click "Upload"
5. Client calls `POST /v1/upload/initiate`
6. Worker generates presigned R2 upload URLs
7. Client uploads files to R2 (with progress bar)
8. Client calls `POST /v1/upload/complete`
9. Validation Worker:
   - Checks MJCF syntax
   - Validates mesh references
   - Generates thumbnail
   - Scans for security issues
10. If valid: Move to `packages/`, update manifest, insert to D1
11. If invalid: Show errors, delete temp files
12. Asset published, appears in search results

**Upload Time:** <5 min for typical robot

---

## API Endpoints

### Asset Discovery

```http
GET /v1/assets
Query Params:
  - query: "franka"
  - domain: "manufacturing"
  - assetClass: "arm"
  - manufacturer: "Franka Robotics"
  - minDof: 6
  - maxDof: 7
  - sortBy: "name" | "downloads" | "updated"
  - limit: 50
  - offset: 0

Response:
{
  "assets": [
    {
      "id": "mujoco-menagerie/franka_emika_panda",
      "name": "Franka Emika Panda",
      "version": "1.0.0",
      "manufacturer": "Franka Robotics",
      "thumbnail": "https://assets.kineticore.io/thumbnails/franka_panda.webp",
      "capabilities": {
        "dof": 7,
        "payload": 3,
        "reach": 855
      }
    }
  ],
  "total": 1,
  "offset": 0,
  "limit": 50
}
```

### Asset Download

```http
GET /v1/assets/:assetId/download?version=latest

Response:
{
  "assetId": "mujoco-menagerie/franka_emika_panda",
  "version": "1.0.0",
  "files": [
    {
      "path": "panda.xml",
      "url": "https://assets.kineticore.io/packages/.../panda.xml",
      "size": 14725,
      "checksum": "sha256:abc123..."
    },
    {
      "path": "assets/link0.stl",
      "url": "https://assets.kineticore.io/packages/.../assets/link0.stl",
      "size": 10084,
      "checksum": "sha256:def456..."
    }
  ]
}
```

### Upload

```http
POST /v1/upload/initiate
{
  "assetId": "custom/my_robot",
  "version": "1.0.0",
  "metadata": {
    "name": "My Custom Robot",
    "manufacturer": "ACME Corp",
    "domain": "manufacturing",
    "assetClass": "arm"
  }
}

Response:
{
  "uploadId": "upload_abc123",
  "uploadUrls": {
    "robot.xml": "https://r2-presigned-url-1",
    "assets/link0.stl": "https://r2-presigned-url-2"
  },
  "expiresAt": "2025-10-08T12:00:00Z"
}
```

---

## Database Schema

```sql
-- Assets table
CREATE TABLE assets (
  id TEXT PRIMARY KEY,               -- "mujoco-menagerie/franka_emika_panda"
  name TEXT NOT NULL,
  domain TEXT NOT NULL,
  asset_class TEXT NOT NULL,
  manufacturer TEXT,
  latest_version TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Asset versions
CREATE TABLE asset_versions (
  id INTEGER PRIMARY KEY,
  asset_id TEXT NOT NULL,
  version TEXT NOT NULL,             -- "1.0.0"
  r2_path TEXT NOT NULL,
  metadata_json TEXT NOT NULL,
  package_size INTEGER,
  checksum TEXT,
  uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (asset_id) REFERENCES assets(id)
);

-- Full-text search
CREATE VIRTUAL TABLE assets_search USING fts5(
  id, name, manufacturer, tags, keywords, description
);

-- Usage tracking
CREATE TABLE asset_usage (
  asset_id TEXT NOT NULL,
  event_type TEXT NOT NULL,          -- download | view | instantiate
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

## Client Code Structure

### New Files

```
src/
├── library/
│   ├── AssetLibraryManager.ts       # [UPDATE] Add cloud loading
│   ├── CloudAssetLoader.ts          # [NEW] Download from CDN
│   ├── AssetCache.ts                # [NEW] IndexedDB caching
│   └── types.ts                     # [UPDATE] Add cloud-specific types
│
├── loaders/
│   ├── MJCFLoader.ts                # [UPDATE] Support remote meshes
│   └── URDFLoader.ts                # [UPDATE] Support remote meshes
│
└── ui/
    └── components/
        └── AssetLibrary/
            ├── AssetLibraryPanel.tsx      # [UPDATE] Show cloud status
            └── AssetUploadModal.tsx       # [NEW] Upload UI
```

### Key Classes

```typescript
// CloudAssetLoader.ts
export class CloudAssetLoader {
  private apiBaseUrl = 'https://api.kineticore.io/v1';
  private cache: AssetCache;

  async downloadAsset(assetId: string, version = 'latest'): Promise<AssetPackage> {
    // 1. Check cache
    const cached = await this.cache.get(assetId, version);
    if (cached && !this.isStale(cached)) return cached;

    // 2. Get download URLs from API
    const response = await fetch(
      `${this.apiBaseUrl}/assets/${assetId}/download?version=${version}`
    );
    const { files } = await response.json();

    // 3. Download files in parallel
    const downloads = files.map(file => this.downloadFile(file.url));
    const fileData = await Promise.all(downloads);

    // 4. Cache asset
    const assetPackage = { assetId, version, files: fileData };
    await this.cache.set(assetId, version, assetPackage);

    return assetPackage;
  }

  private async downloadFile(url: string): Promise<ArrayBuffer> {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Download failed: ${url}`);
    return response.arrayBuffer();
  }
}

// AssetCache.ts
export class AssetCache {
  private db: IDBDatabase;
  private readonly MAX_CACHE_SIZE = 500 * 1024 * 1024; // 500MB

  async get(assetId: string, version: string): Promise<AssetPackage | null> {
    // IndexedDB lookup
  }

  async set(assetId: string, version: string, asset: AssetPackage): Promise<void> {
    // IndexedDB storage with LRU eviction
  }

  async clear(): Promise<void> {
    // Clear all cached assets
  }
}
```

---

## Success Criteria

### Performance
- ✅ Asset load time: <2s P95 (cached), <10s P95 (cold)
- ✅ Search latency: <200ms P95
- ✅ CDN cache hit rate: >90%
- ✅ API availability: >99.9%

### Scale
- ✅ 100+ assets in library (Phase 2)
- ✅ 1000+ downloads/month (Phase 3)
- ✅ 10+ user uploads (Phase 4)

### User Experience
- ✅ Asset discovery: <30s to find robot
- ✅ Upload workflow: <5 min
- ✅ Zero breaking changes for existing users

---

## Cost Projection

### Free Tier Limits (Cloudflare)
- R2 Storage: 10 GB
- R2 Operations: 1M Class A, 10M Class B / month
- Workers: 100K requests/day
- D1: 5GB storage, 5M reads/day
- KV: 100K reads/day

### Expected Usage (100 assets, 1000 users)
- Storage: ~5 GB (well within 10 GB)
- Operations: ~50K Class A, ~500K Class B / month
- Workers: ~10K requests/day
- D1 Reads: ~100K/day

**Total Cost:** $0/month (100% free tier)

**At 10x scale (1000 assets, 10K users):**
- Storage: ~50 GB → **$0.60/month**
- Operations: ~500K Class A → **$2.25/month**
- Workers: ~100K req/day → **$5/month**

**Total at 10x:** ~**$8/month**

---

## Next Actions

### This Week
1. ✅ Review this plan with team
2. ⏳ Create Cloudflare account
3. ⏳ Set up R2 bucket, D1 database
4. ⏳ Initialize Workers project
5. ⏳ Write first API endpoint (`GET /v1/manifests/global`)

### Next Week
1. ⏳ Build import script for MuJoCo Menagerie
2. ⏳ Upload 5 test robots
3. ⏳ Test CDN delivery
4. ⏳ Begin client integration

---

## Questions & Decisions

### Open Questions
- [ ] Authentication strategy for uploads? (API keys vs. OAuth vs. Cloudflare Access)
- [ ] Asset approval workflow? (Auto-publish vs. manual review)
- [ ] Custom domain preference? (`assets.kineticore.io` vs. `cdn.kineticore.io`)
- [ ] Mesh compression format? (Draco vs. glTF with Draco)

### Decisions Made
- ✅ Use Cloudflare R2 (not AWS S3) → Zero egress fees
- ✅ Use D1 for metadata (not external DB) → Simplicity, edge performance
- ✅ Semantic versioning (MAJOR.MINOR.PATCH)
- ✅ Support both cloud and local assets (hybrid loader)

---

## References

- **Full Plan:** [docs/CLOUD_ASSET_STORAGE_PLAN.md](./CLOUD_ASSET_STORAGE_PLAN.md)
- **Cloudflare R2:** https://developers.cloudflare.com/r2/
- **Cloudflare Workers:** https://developers.cloudflare.com/workers/
- **MuJoCo Menagerie:** https://github.com/google-deepmind/mujoco_menagerie
- **MJCF Reference:** https://mujoco.readthedocs.io/en/stable/XMLreference.html

---

**Status:** Ready to start Phase 1
**Estimated Timeline:** 12 weeks to production
**Risk Level:** Low (using proven tech stack, generous free tier)

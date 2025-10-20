# Asset API Backend - Implementation Plan

## Overview

**Goal:** Build a scalable, decoupled backend system for managing kinetiCORE's asset library.

**Status:** 📋 **Planning Phase** - Frontend infrastructure ready

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  kinetiCORE Frontend (React + Babylon.js)                  │
│  - AssetLibraryPanel (Three-pane UI)                       │
│  - AssetAPIService (HTTP client)                           │
└──────────────────────┬──────────────────────────────────────┘
                       │ HTTPS/REST
                       ↓
┌──────────────────────────────────────────────────────────────┐
│  Asset API (Node.js + Express)                              │
│  - GET /api/assets (list, search, filter)                   │
│  - GET /api/categories                                      │
│  - POST /api/assets/:id/usage (track popularity)            │
│  - Admin endpoints (auth required)                          │
└──────────────────────┬─────────────────┬────────────────────┘
                       │                 │
                       ↓                 ↓
              ┌────────────────┐  ┌───────────────┐
              │  MongoDB        │  │ Cloudflare R2 │
              │  (Metadata)     │  │ (3D Files)    │
              │  - Specs        │  │ - .glb files  │
              │  - Categories   │  │ - Thumbnails  │
              │  - Usage data   │  │ - URDF/MJCF  │
              └────────────────┘  └───────────────┘
```

---

## Phase 1: Backend API (Node.js + Express)

### Setup

**Technology Stack:**
- **Runtime:** Node.js 18+ (with TypeScript)
- **Framework:** Express.js
- **Database:** MongoDB (via Mongoose)
- **File Storage:** Cloudflare R2 (S3-compatible)
- **Validation:** Zod
- **Testing:** Vitest
- **Deployment:** Cloudflare Workers or Railway

### Project Structure

```
kineticore-asset-api/
├── src/
│   ├── routes/
│   │   ├── assets.ts          # GET /api/assets, GET /api/assets/:id
│   │   ├── categories.ts      # GET /api/categories
│   │   ├── admin.ts           # POST /api/admin/assets (auth required)
│   │   └── health.ts          # GET /api/health
│   ├── models/
│   │   ├── Asset.ts           # Mongoose schema
│   │   └── Category.ts
│   ├── services/
│   │   ├── assetService.ts    # Business logic
│   │   ├── storageService.ts  # R2 upload/download
│   │   └── searchService.ts   # Advanced search
│   ├── middleware/
│   │   ├── auth.ts            # JWT validation
│   │   ├── rateLimit.ts       # API rate limiting
│   │   └── cors.ts
│   ├── utils/
│   │   ├── validation.ts      # Zod schemas
│   │   └── logger.ts
│   └── server.ts              # Express app entry point
├── tests/
├── package.json
└── tsconfig.json
```

### Core Endpoints

#### 1. **GET /api/assets**

**Query Parameters:**
- `search` - Full-text search across name, manufacturer, tags
- `domains` - Comma-separated list (e.g., `manufacturing,logistics`)
- `classes` - Asset classes (e.g., `robots,endEffectors`)
- `manufacturers` - Filter by manufacturer
- `payloadMin` / `payloadMax` - Payload range (kg)
- `reachMin` / `reachMax` - Reach range (mm)
- `dofMin` / `dofMax` - DOF range
- `hasKinematics` - Boolean
- `sortBy` - `name | manufacturer | usageCount | lastUsed`
- `sortOrder` - `asc | desc`
- `page` - Pagination (default: 1)
- `limit` - Results per page (default: 50, max: 100)

**Response:**
```json
{
  "assets": [
    {
      "id": "fanuc-lr-mate-200id",
      "name": "FANUC LR Mate 200iD",
      "manufacturer": "FANUC",
      "domain": "manufacturing",
      "assetClass": "robots",
      "capabilities": {
        "payload": 7,
        "reach": 911,
        "dof": 6
      },
      "filePath": "https://cdn.kineticore.com/assets/fanuc-lr-mate-200id.glb",
      "thumbnail": "https://cdn.kineticore.com/thumbs/fanuc-lr-mate-200id.jpg",
      "tags": ["6-axis", "light-duty", "ip67"]
    }
  ],
  "total": 42,
  "page": 1,
  "totalPages": 1
}
```

#### 2. **GET /api/categories**

**Response:**
```json
{
  "domains": [
    { "id": "manufacturing", "name": "Manufacturing", "count": 28 },
    { "id": "logistics", "name": "Logistics", "count": 14 }
  ],
  "assetClasses": [
    { "id": "robots", "name": "Robots", "count": 18 },
    { "id": "endEffectors", "name": "Grippers & Tools", "count": 10 }
  ]
}
```

#### 3. **POST /api/assets/:id/usage**

Record that an asset was used (for popularity tracking).

**Response:** `{ "success": true }`

#### 4. **Admin Endpoints (Protected)**

- `POST /api/admin/assets` - Create new asset
- `PUT /api/admin/assets/:id` - Update asset
- `DELETE /api/admin/assets/:id` - Delete asset
- `POST /api/admin/upload` - Upload 3D file to R2

---

## Phase 2: MongoDB Database Schema

### Asset Document

```typescript
interface AssetDocument {
  _id: ObjectId;
  id: string;                    // Unique slug (e.g., "fanuc-lr-mate-200id")
  name: string;
  manufacturer?: string;
  modelNumber?: string;
  version?: string;

  // Classification
  domain: Domain;
  assetClass: AssetClass;
  assetType: string;

  // Files
  loaderType: LoaderType;
  filePath: string;              // R2 URL
  fileSize?: number;             // MB
  thumbnail?: string;            // R2 URL

  // Capabilities
  capabilities?: {
    hasKinematics?: boolean;
    dof?: number;
    payload?: number;            // kg
    reach?: number;              // mm
    dimensions?: {
      length: number;
      width: number;
      height: number;
    };
    mass?: number;
    powerRequirement?: string;
    precision?: number;
    cycleTime?: number;
    [key: string]: any;          // Extensible
  };

  // Discovery
  tags: string[];
  searchKeywords: string[];
  description?: string;

  // Documentation
  documentationUrl?: string;
  specSheetUrl?: string;

  // Sourcing
  source: AssetSource;
  vendor?: {
    name: string;
    url?: string;
    partNumber?: string;
    price?: number;
    currency?: string;
  };

  // Usage tracking
  usageCount: number;
  lastUsed?: Date;
  favorites: number;             // Count of users who favorited

  // Metadata
  createdAt: Date;
  updatedAt: Date;
}
```

### Indexes

```typescript
// Text search index
{ name: 'text', manufacturer: 'text', tags: 'text', searchKeywords: 'text' }

// Filter indexes
{ domain: 1 }
{ assetClass: 1 }
{ 'capabilities.payload': 1 }
{ 'capabilities.reach': 1 }
{ usageCount: -1 }
```

---

## Phase 3: Cloudflare R2 File Storage

### Bucket Structure

```
kineticore-assets/
├── models/
│   ├── fanuc-lr-mate-200id.glb
│   ├── ur5e.urdf
│   └── panda-arm.mjcf
├── thumbnails/
│   ├── fanuc-lr-mate-200id.jpg
│   ├── ur5e.jpg
│   └── panda-arm.jpg
└── documentation/
    ├── fanuc-lr-mate-200id.pdf
    └── ur5e-specs.pdf
```

### Upload Flow

1. Admin uploads file via Admin Panel
2. Backend validates file (size, type)
3. Backend uploads to R2 using S3 SDK
4. R2 returns public URL
5. Backend saves URL to MongoDB
6. Frontend fetches URL and displays asset

### CDN Configuration

- **Cloudflare CDN:** Automatically caches files globally
- **Custom Domain:** `https://assets.kineticore.com/models/...`
- **Cache Control:** `Cache-Control: public, max-age=31536000` (1 year)

---

## Phase 4: Admin Panel (Optional)

### Simple Admin Interface

**Framework:** React (same as main app)

**Pages:**
1. **Asset List** - Table view of all assets with edit/delete buttons
2. **Add Asset** - Form to create new asset
3. **Edit Asset** - Form to update existing asset
4. **Upload Files** - Drag & drop interface for 3D models

**Authentication:**
- Simple JWT-based auth
- Admin credentials stored securely
- Only accessible to authorized users

**Features:**
- Bulk import from CSV
- Auto-generate thumbnails (if possible)
- Validation warnings for missing data
- Preview 3D models before publishing

---

## Phase 5: Deployment

### Option 1: Cloudflare Workers (Recommended)

**Pros:**
- Global edge network
- Auto-scaling
- Integrated with R2 (no egress fees)
- Free tier: 100,000 requests/day

**Cons:**
- Need to use Cloudflare D1 or external MongoDB

**Setup:**
```bash
npm create cloudflare@latest kineticore-asset-api
cd kineticore-asset-api
wrangler deploy
```

### Option 2: Railway / Render

**Pros:**
- Easy MongoDB integration
- Traditional Node.js environment
- Simple deployment

**Cons:**
- Regional (not edge)
- Costs scale with usage

---

## Migration Strategy

### Step 1: Test Backend Locally

1. Build API with local MongoDB
2. Migrate existing `manifest.json` data to MongoDB
3. Test all endpoints with Postman
4. Frontend connects to `http://localhost:3001`

### Step 2: Deploy Backend

1. Deploy API to Cloudflare Workers or Railway
2. Update frontend `.env` file:
   ```
   VITE_ASSET_API_URL=https://api.kineticore.com
   VITE_USE_LOCAL_ASSETS=false
   ```

### Step 3: Gradual Migration

- Keep `manifest.json` as fallback
- Frontend tries API first, falls back to local on error
- Allows testing without breaking production

---

## Success Metrics

### Performance
- API response time: < 200ms (p95)
- 3D file load time: < 2 seconds for typical model

### Scalability
- Support 10,000+ assets without performance degradation
- Handle 100+ concurrent users

### Reliability
- 99.9% uptime
- Graceful degradation (local fallback)

---

## Timeline Estimate

| Phase | Estimated Time | Priority |
|-------|---------------|----------|
| Phase 1: API Backend | 2-3 days | 🔴 High |
| Phase 2: MongoDB Setup | 1 day | 🔴 High |
| Phase 3: R2 Integration | 1 day | 🟡 Medium |
| Phase 4: Admin Panel | 2-3 days | 🟢 Low |
| Phase 5: Deployment | 1 day | 🔴 High |
| **Total** | **1-2 weeks** | |

---

## Next Steps

1. ✅ **Frontend Ready** - AssetAPIService implemented with local fallback
2. ⏭️ **Build Backend** - Start with Express + MongoDB API
3. ⏭️ **Test Locally** - Ensure frontend/backend integration works
4. ⏭️ **Deploy** - Choose Cloudflare Workers or Railway
5. ⏭️ **Migrate Data** - Move manifest.json to MongoDB
6. ⏭️ **Admin Panel** - Build simple management UI

---

## Questions to Answer

1. **Authentication:** Do we need user-specific favorites, or just global usage tracking?
2. **Admin Access:** Who should have permission to add/edit assets?
3. **Hosting:** Cloudflare Workers (edge) vs Railway (traditional server)?
4. **Budget:** Cloudflare R2 is extremely cheap (~$0.015/GB), but need to estimate asset library size.

---

**Status:** 📋 Planning Complete - Ready for Implementation

**Owner:** George (Architecture) + Agent 3 (Cloudflare deployment)

**Documentation:** This file serves as the implementation blueprint.

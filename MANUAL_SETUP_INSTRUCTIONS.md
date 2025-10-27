# Manual Cloud Setup Instructions

Since CLI requires interactive login, here's how to set up the cloud asset library manually:

## Architecture Confirmed ✅

**Yes, you're correct!**

```
3D Files (Binary Data) → Cloudflare R2 Storage
├── Robot models (.glb, .urdf)
├── STL mesh files
├── Textures
└── Large binary assets (100MB+)

Metadata (JSON/Text) → Supabase PostgreSQL
├── Asset information (name, tags, description)
├── User accounts and permissions
├── Teams and collaborators
├── Analytics and usage stats
└── Search indexes and relationships
```

**Why this split?**
- R2: Cheap ($0.015/GB/month), fast CDN, handles large files
- Supabase: Fast queries, relational data, real-time sync

---

## Option 1: Use Supabase Dashboard (Easiest)

### Step 1: Open Supabase Dashboard

Go to: https://supabase.com/dashboard/project/nhkusjsounzwkmevjsgl

### Step 2: Run Migration SQL

1. Click **SQL Editor** in left sidebar
2. Click **New Query**
3. Copy entire contents of `supabase/migrations/20240101000000_create_asset_tables.sql`
4. Paste into query editor
5. Click **RUN**

This creates all tables, buckets, RLS policies, etc.

### Step 3: Seed Starter Assets

1. Still in SQL Editor
2. Click **New Query**
3. Copy entire contents of `supabase/seed.sql`
4. Paste into query editor
5. Click **RUN**

This adds 5 starter assets (Fanuc, KUKA, ABB robots, etc.)

### Step 4: Verify

Run this query:
```sql
SELECT name, visibility, asset_class FROM public.assets WHERE visibility = 'public';
```

Should return 5 public starter assets ✅

---

## Option 2: Use Remote Database Connection

### Step 1: Get Connection String

From Supabase Dashboard → Settings → Database → Connection String

Example:
```
postgresql://postgres:[YOUR-PASSWORD]@db.nhkusjsounzwkmevjsgl.supabase.co:5432/postgres
```

### Step 2: Run Migration with psql

```bash
# Install PostgreSQL client if needed
# Windows: choco install postgresql
# Mac: brew install postgresql

# Run migration
psql "postgresql://postgres:[PASSWORD]@db.nhkusjsounzwkmevjsgl.supabase.co:5432/postgres" \
  -f supabase/migrations/20240101000000_create_asset_tables.sql

# Run seed
psql "postgresql://postgres:[PASSWORD]@db.nhkusjsounzwkmevjsgl.supabase.co:5432/postgres" \
  -f supabase/seed.sql
```

---

## Option 3: Run Locally with Docker (For Development)

```bash
# Start local Supabase
npx supabase start

# This starts:
# - PostgreSQL database (localhost:54322)
# - Studio UI (localhost:54323)
# - Auth server
# - Storage server

# Migrations run automatically on start!
```

Then use local Supabase for development:
```env
VITE_SUPABASE_URL=http://localhost:54321
VITE_SUPABASE_ANON_KEY=<from supabase start output>
```

---

## Verify Setup is Working

### Test 1: Run Connection Test

```bash
node scripts/test-cloud-connection.js
```

Expected output:
```
✅ Database connected! Found 5 total assets
✅ Found 5 public starter assets:
   1. Fanuc LR Mate 200iD Robot
   2. KUKA KR 120 R2500 Pro
   3. ABB IRB 6700 Robot
   4. Conveyor Belt System
   5. Work Cell Layout
```

### Test 2: Open kinetiCORE

```bash
npm run dev
```

Navigate to Asset Library → Should see 5 starter assets ✅

### Test 3: Save Asset to Cloud

1. Load robot (File → Import → URDF)
2. Right-click → "Save to Library"
3. Fill form → Click "Save to Library"
4. Check console: Should see "✅ Asset saved successfully"
5. Asset appears in "My Assets"

---

## Cloudflare R2 Setup (Optional - For Large Files)

### If you want to use R2 for 3D file storage:

### Step 1: Create R2 Bucket

1. Go to Cloudflare Dashboard → R2
2. Create bucket: `kineticore-assets`
3. Enable public access (for public assets)

### Step 2: Get R2 Credentials

1. R2 → Manage R2 API Tokens
2. Create API token with:
   - Permissions: Object Read & Write
   - Bucket: kineticore-assets
3. Save:
   - Access Key ID
   - Secret Access Key
   - Bucket URL

### Step 3: Add to .env

```env
VITE_R2_ENDPOINT=https://xxxxxx.r2.cloudflarestorage.com
VITE_R2_ACCESS_KEY_ID=your_access_key
VITE_R2_SECRET_ACCESS_KEY=your_secret_key
VITE_R2_BUCKET_NAME=kineticore-assets
```

### Step 4: Update AssetUploadService

AssetUploadService.ts already has R2 upload logic! Just needs credentials.

---

## Current Status

✅ `.env` file created with Supabase credentials
✅ Supabase client configured ([src/lib/supabase-client.ts](src/lib/supabase-client.ts))
✅ SaveToLibraryService integrated with cloud
✅ Migration SQL files ready
✅ Seed data with 5 starter assets ready
✅ Test script created

⏳ Database tables need to be created (run migration)
⏳ Starter assets need to be seeded
⏳ R2 storage optional (can use Supabase storage for now)

---

## Quick Start (Recommended)

**Use Supabase Dashboard (5 minutes):**

1. Open: https://supabase.com/dashboard/project/nhkusjsounzwkmevjsgl/editor
2. SQL Editor → New Query
3. Copy/paste from `supabase/migrations/20240101000000_create_asset_tables.sql`
4. Run query ✅
5. New Query → Copy/paste from `supabase/seed.sql`
6. Run query ✅
7. Test: `node scripts/test-cloud-connection.js`
8. Open kinetiCORE → Asset Library should show 5 robots! 🎉

---

## Support

If you get stuck, check:
- Supabase logs: https://supabase.com/dashboard/project/nhkusjsounzwkmevjsgl/logs
- Supabase docs: https://supabase.com/docs
- Cloudflare R2 docs: https://developers.cloudflare.com/r2/

---

## Summary

**Data Architecture:**
```
User uploads robot.glb (50MB)
  ↓
SaveToLibraryService
  ├─→ Upload robot.glb to R2 (binary file)
  └─→ Save metadata to Supabase (name, tags, etc.)

User searches "fanuc robot"
  ↓
Supabase query (fast!)
  ↓
Returns metadata + R2 URL
  ↓
Frontend loads robot.glb from R2 CDN
```

**Benefits:**
- Fast search (Supabase indexes)
- Cheap storage (R2 at $0.015/GB)
- Fast delivery (R2 CDN)
- Scalable (both auto-scale)
- Secure (RLS policies + signed URLs)

**You are correct!** 3D files → R2, Metadata → Supabase. Perfect architecture! ✅

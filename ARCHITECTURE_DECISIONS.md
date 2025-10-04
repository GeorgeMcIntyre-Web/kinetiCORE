# kinetiCORE - Architecture Decision Records (ADR)

## ADR-001: Local-First Architecture for MVP

**Date:** January 2025
**Status:** ✅ Accepted
**Deciders:** George (Architecture Lead)

### Context
We need to decide whether to implement cloud storage and real-time collaboration in the MVP or keep it client-only with local file storage.

### Decision
**Keep client-only for MVP. Add cloud storage in Week 5-6 only if proven demand.**

### Rationale

#### ✅ Advantages of Local-First MVP

1. **Industrial User Privacy**
   - Robot programs contain proprietary IP
   - CAD models are confidential
   - Many factories have air-gapped networks
   - No data leaves user's machine → No security audits needed

2. **Offline Capability**
   - Works on factory floor without internet
   - No latency/reliability concerns
   - Zero backend infrastructure = zero downtime
   - Critical for industrial environments

3. **Fast Development Iteration**
   - No backend to build/maintain
   - No authentication/authorization
   - No database schema migrations
   - No API versioning
   - Focus 100% on core product features

4. **Cost Structure**
   - $0 hosting costs during development
   - No Supabase/Firebase monthly fees until revenue
   - No bandwidth charges
   - Linear scaling (users bring their own compute)

5. **Existing Solution is Sufficient**
   - `WorldSerializer.ts` already working
   - Save/Load to `.kicore` JSON files
   - Export/Import world state
   - User controls file location (Desktop, USB drive, etc.)

#### ⚠️ Disadvantages (Mitigated)

1. **No Cloud Backup**
   - *Mitigation:* User saves to their preferred backup location (OneDrive, Dropbox, Git)
   - *Reality:* Industrial users prefer this (they control backups)

2. **No Collaboration**
   - *Mitigation:* File sharing via email/Git is standard in engineering
   - *Reality:* Most robot programming is solo work or async review

3. **No Multi-Device Sync**
   - *Mitigation:* Engineers typically work on one workstation
   - *Reality:* Can copy `.kicore` file to USB drive if needed

### Current Implementation

```typescript
// src/scene/WorldSerializer.ts (ALREADY EXISTS)
export function saveWorldToFile(): void {
  const worldData = {
    version: '1.0',
    timestamp: Date.now(),
    sceneTree: SceneTreeManager.getInstance().exportTree(),
    joints: KinematicsManager.getInstance().getAllJoints(),
    // ... all state serialized to JSON
  };

  // Browser download (user picks location)
  const blob = new Blob([JSON.stringify(worldData)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `robot_scene_${Date.now()}.kicore`;
  a.click();
}

export async function loadWorldFromFile(file: File): Promise<void> {
  const json = await file.text();
  const worldData = JSON.parse(json);
  restoreWorldState(worldData);
}
```

**User Workflow:**
1. Design robot cell in kinetiCORE
2. Click "Save" → Downloads `my_robot_cell.kicore` to local disk
3. User backs up to their preferred location (OneDrive, Git, etc.)
4. Open on another machine → Drag `.kicore` file into kinetiCORE → Restored

**This is exactly how CAD software works (SolidWorks, Fusion360, etc.)**

---

## ADR-002: Cloud Storage Strategy (Week 5-6)

**Date:** January 2025
**Status:** 📋 Planned (Not Started)

### When to Add Cloud Storage

**Trigger Conditions (ANY of these):**
1. **User Feedback:** 3+ users explicitly request cloud storage
2. **Usage Pattern:** Analytics show users work on multiple devices
3. **Collaboration Need:** Users email `.kicore` files back and forth
4. **Revenue Milestone:** $10K MRR → Can afford backend costs

### Recommended Stack: Supabase

**Why Supabase (over Firebase/AWS/Custom):**

| Factor | Supabase | Firebase | AWS | Custom |
|--------|----------|----------|-----|--------|
| **PostgreSQL** | ✅ Real database | ❌ NoSQL | ✅ RDS | ✅ Any |
| **REST API** | ✅ Auto-generated | ✅ SDKs | ❌ Manual | ❌ Manual |
| **Auth** | ✅ Built-in | ✅ Built-in | ❌ Cognito | ❌ DIY |
| **File Storage** | ✅ S3-compatible | ✅ Cloud Storage | ✅ S3 | ❌ DIY |
| **Real-time** | ✅ WebSockets | ✅ Realtime DB | ❌ DIY | ❌ DIY |
| **Cost (10 users)** | $0 (free tier) | $25/mo | $50/mo | $100/mo |
| **TypeScript SDK** | ✅ Excellent | ✅ Good | ⚠️ Complex | N/A |
| **Self-hostable** | ✅ Yes | ❌ No | ❌ No | ✅ Yes |

**Winner:** Supabase
- Best balance of features/complexity/cost
- Industrial users can self-host if needed
- Free tier supports 10K users
- PostgreSQL = familiar to engineers

### Implementation Plan (Week 5-6)

#### Phase 1: Optional Cloud Save (Week 5)
```typescript
// New file: src/cloud/CloudStorage.ts
import { createClient } from '@supabase/supabase-js';

export class CloudStorage {
  private supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  async saveToCloud(worldData: WorldData): Promise<string> {
    const { data, error } = await this.supabase
      .from('robot_scenes')
      .insert({
        user_id: this.getCurrentUserId(),
        name: worldData.name,
        data: worldData,
        version: worldData.version,
      })
      .select()
      .single();

    return data.id; // UUID of saved scene
  }

  async loadFromCloud(sceneId: string): Promise<WorldData> {
    const { data } = await this.supabase
      .from('robot_scenes')
      .select('data')
      .eq('id', sceneId)
      .single();

    return data.data;
  }
}
```

**UI Changes:**
```tsx
// Add to Toolbar
<Menu>
  <MenuItem onClick={saveLocal}>💾 Save Locally (.kicore)</MenuItem>
  <MenuItem onClick={saveCloud}>☁️ Save to Cloud (Beta)</MenuItem>
</Menu>

<Menu>
  <MenuItem onClick={loadLocal}>📂 Open Local File</MenuItem>
  <MenuItem onClick={loadCloud}>☁️ Open from Cloud (Beta)</MenuItem>
</Menu>
```

**Database Schema:**
```sql
create table robot_scenes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  name text not null,
  data jsonb not null,
  version text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Row-level security
alter table robot_scenes enable row level security;

create policy "Users can only access their own scenes"
  on robot_scenes for all
  using (auth.uid() = user_id);
```

#### Phase 2: Auto-Save (Week 6)
```typescript
// Auto-save every 30 seconds (like Google Docs)
setInterval(() => {
  if (userHasCloudEnabled && hasUnsavedChanges) {
    cloudStorage.saveToCloud(getCurrentWorldData());
    toast.info('Auto-saved to cloud ☁️');
  }
}, 30000);
```

#### Phase 3: Version History (Week 7+)
```sql
create table scene_versions (
  id uuid primary key default gen_random_uuid(),
  scene_id uuid references robot_scenes not null,
  version_number int not null,
  data jsonb not null,
  created_at timestamptz default now()
);
```

**UI:**
```tsx
<VersionHistory sceneId={currentSceneId}>
  {versions.map(v => (
    <VersionItem
      version={v.version_number}
      timestamp={v.created_at}
      onRestore={() => restoreVersion(v.id)}
    />
  ))}
</VersionHistory>
```

---

## ADR-003: Real-Time Collaboration (Future)

**Date:** January 2025
**Status:** ⏳ Deferred (Wait for User Demand)

### Decision
**Do NOT implement real-time collaboration in MVP or Week 5-6.**

**Only add if:**
1. Multiple users (5+) explicitly request it
2. Use case is validated (e.g., "I need my team to edit robot program together")
3. Async file sharing (email/Git) proves insufficient

### Why Defer?

**Complexity vs Value:**
- Real-time = 10x complexity (CRDTs, conflict resolution, WebSocket infrastructure)
- Value = Unproven (engineers rarely edit robot programs simultaneously)
- CAD software doesn't have real-time (SolidWorks, Fusion360 are async)

**Industrial Reality:**
- Robot programming is **sequential** (design → program → test → iterate)
- Code review is **async** (email CAD file, review, comment, return)
- Real-time editing = Merge conflicts (nightmare with robot trajectories)

**If Needed Later:**
```typescript
// Supabase already supports real-time (just enable it)
const channel = supabase
  .channel('robot_scene:' + sceneId)
  .on('postgres_changes',
    { event: 'UPDATE', schema: 'public', table: 'robot_scenes' },
    (payload) => {
      // Merge remote changes into local state
      mergeRemoteChanges(payload.new.data);
    }
  )
  .subscribe();
```

**But DO NOT build this until proven demand.**

---

## ADR-004: File Format Strategy

**Date:** January 2025
**Status:** ✅ Accepted

### Decision
**Use `.kicore` JSON format for all saves (local and cloud).**

### Format Specification
```typescript
interface KiCoreFile {
  version: string; // Semantic versioning: "1.0.0"
  metadata: {
    created: number; // Unix timestamp
    modified: number;
    author?: string;
    description?: string;
  };
  scene: {
    tree: SceneTreeData; // Full scene hierarchy
    camera: CameraState;
    lighting: LightingState;
  };
  kinematics: {
    joints: JointConfig[];
    chains: KinematicChain[];
    groundedNodes: string[];
  };
  physics: {
    enabled: boolean;
    gravity: Vector3;
    // Physics body configs stored in entity metadata
  };
  assets: {
    // External file references (CAD models, textures)
    models: Array<{
      id: string;
      filename: string;
      format: 'urdf' | 'glb' | 'stl';
      // Optionally embed small files as base64
    }>;
  };
}
```

**Versioning Strategy:**
```typescript
// Backward compatibility
function loadKiCoreFile(json: string): KiCoreFile {
  const data = JSON.parse(json);

  switch (data.version) {
    case '1.0.0':
      return data;
    case '0.9.0':
      return migrateFrom_0_9_to_1_0(data);
    default:
      throw new Error(`Unsupported version: ${data.version}`);
  }
}
```

---

## ADR-005: Authentication Strategy (Future)

**Date:** January 2025
**Status:** ⏳ Deferred until Week 5

### Decision
**When adding cloud storage, use Supabase Auth with email/password + Google OAuth.**

**Auth Providers (Priority Order):**
1. **Google** (engineering teams already use Gmail)
2. **Email/Password** (air-gapped factories)
3. ~~GitHub~~ (nice-to-have, not critical)
4. ~~Microsoft~~ (enterprise, but adds complexity)

**Implementation:**
```typescript
// Login with Google
const { data, error } = await supabase.auth.signInWithOAuth({
  provider: 'google',
  options: {
    redirectTo: window.location.origin + '/auth/callback'
  }
});

// Login with email
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'engineer@factory.com',
  password: 'secure_password'
});
```

**UI:**
```tsx
{!user && (
  <LoginModal>
    <button onClick={loginWithGoogle}>
      <GoogleIcon /> Continue with Google
    </button>
    <Divider>or</Divider>
    <EmailPasswordForm />
  </LoginModal>
)}
```

**Anonymous Usage:**
- Local-only mode requires NO auth
- Cloud features require login
- Graceful degradation (user sees "Sign in to enable cloud save")

---

## Summary

### Current Architecture (MVP)
```
User Machine
├── Browser (React + Babylon.js + Rapier)
├── Local Storage (settings only)
└── File System (.kicore files)
    ├── User manages backups (OneDrive, Git, USB)
    └── User manages sharing (email, Slack)
```

**Benefits:**
- ✅ Zero backend costs
- ✅ Works offline
- ✅ Private by default
- ✅ Fast development
- ✅ Industrial-friendly

### Future Architecture (Week 5-6)
```
User Machine                  Cloud (Supabase)
├── Browser                   ├── PostgreSQL
│   ├── Local-first           │   ├── robot_scenes
│   └── Optional cloud sync   │   └── scene_versions
└── File System               ├── Storage (S3)
    └── .kicore files         │   └── CAD assets
                              └── Auth
                                  └── Email + Google OAuth
```

**When to Add:**
- User demand proven (3+ requests)
- OR $10K MRR milestone
- OR multi-device usage pattern

### Non-Goals (Do NOT Build)
- ❌ Real-time collaboration (wait for demand)
- ❌ Custom backend (use Supabase)
- ❌ Desktop app (web is sufficient)
- ❌ Mobile app (not a mobile use case)

---

**Architecture Philosophy:**
> "Build the minimum viable product. Add complexity only when users prove they need it."

**Current Status:**
- ✅ Local-first MVP architecture
- ✅ WorldSerializer.ts working
- 📋 Cloud storage planned for Week 5-6
- ⏳ Real-time collaboration deferred indefinitely

---

*Last Updated: January 2025*
*Owner: George (Architecture Lead)*

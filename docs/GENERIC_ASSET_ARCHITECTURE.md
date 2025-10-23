# kinetiCORE Generic Asset Architecture

**Status:** Core Design Principle
**Owner:** George
**Last Updated:** 2025-10-08

---

## Vision

**kinetiCORE is a format-agnostic industrial simulation platform.** It loads, stores, and serves ANY robot/equipment model format from ANY source - not tied to specific vendors, repositories, or file formats.

## Core Principle

> **Cloud Asset Storage is a generic infrastructure layer, not a MuJoCo-specific tool.**

The system enables:
- ✅ **Your company** → Host proprietary robot models
- ✅ **Customers** → Upload factory equipment layouts
- ✅ **Partners** → Share equipment catalogs
- ✅ **Community** → Contribute open-source models
- ✅ **Vendors** → Publish official model libraries

❌ **NOT** tied to MuJoCo Menagerie
❌ **NOT** limited to MJCF format
❌ **NOT** dependent on any specific data source

---

## Supported Asset Types

### File Formats

| Format | Extension | Description | Use Case |
|--------|-----------|-------------|----------|
| **URDF** | `.urdf` | Universal Robot Description Format | ROS robots, open-source |
| **MJCF** | `.xml` | MuJoCo XML | MuJoCo simulations, research |
| **STEP** | `.step`, `.stp` | CAD interchange format | Vendor CAD models |
| **STL** | `.stl` | Mesh geometry | Visual/collision meshes |
| **OBJ** | `.obj` | 3D object format | Visual meshes with textures |
| **JT** | `.jt` | Siemens JT format | Industrial CAD (future) |
| **glTF** | `.gltf`, `.glb` | 3D scene format | Web-optimized assets (future) |

### Asset Domains

- **Manufacturing** - Industrial robots, CNC machines, assembly lines
- **Logistics** - AGVs, conveyors, warehouse equipment
- **Medical** - Surgical robots, medical devices
- **Construction** - Cranes, heavy equipment
- **Aerospace** - Drones, UAVs, satellite systems
- **Research** - Custom robots, experimental platforms
- **Custom** - User-defined categories

---

## Asset Sources

### 1. User Uploads (Primary)

**Direct upload from users via web UI or API:**

```
User's Computer → kinetiCORE Upload UI → Cloud Storage → Available Globally
```

**Use Cases:**
- Company uploads their custom robot models
- Customer uploads factory layout equipment
- Engineer uploads new gripper design
- Designer uploads CAD models from SolidWorks

**Supported Workflows:**
- Drag & drop folder upload (web UI)
- Programmatic upload via API
- CLI upload tool
- CAD plugin direct export (future)

### 2. Batch Import from Collections (Optional)

**Import existing asset collections:**

```typescript
// Generic import script - works with ANY organized collection
npm run import-assets -- \
  --source /path/to/your_robot_library \
  --format auto \
  --namespace "your-company" \
  --upload
```

**Example Sources:**
- MuJoCo Menagerie (MJCF robots) ← Just one example!
- ROS Industrial (URDF robots)
- Company internal asset library
- GrabCAD models
- Customer-provided collections
- Any organized directory structure

**Important:** The import script is **generic** and works with any collection structure, not just MuJoCo Menagerie.

### 3. Vendor Integration (Future)

**Direct integration with vendor catalogs:**

- Fanuc robot catalog API
- Universal Robots model database
- ABB RobotStudio models
- KUKA robot library
- Direct from manufacturer websites

---

## Architecture Layers

### Layer 1: Storage (Format-Agnostic)

**Cloudflare R2** stores files without understanding formats:

```
R2 Bucket: kineticore-assets/
├── packages/
│   ├── my-company/              ← Your namespace
│   │   ├── custom_robot_arm/
│   │   │   └── v1.0.0/
│   │   │       ├── robot.urdf   ← URDF format
│   │   │       └── meshes/...
│   │   └── cnc_machine/
│   │       └── v1.0.0/
│   │           ├── machine.step ← STEP format
│   │           └── textures/...
│   ├── customer-abc/            ← Customer namespace
│   │   └── factory_layout/
│   │       └── v1.0.0/
│   │           ├── conveyor.xml ← MJCF format
│   │           └── ...
│   └── mujoco-menagerie/        ← Optional: Community collection
│       └── franka_panda/
│           └── v1.0.0/
│               ├── panda.xml    ← MJCF format
│               └── ...
```

### Layer 2: Metadata (Format-Aware)

**D1 Database** indexes assets with generic metadata:

```sql
CREATE TABLE assets (
  id TEXT PRIMARY KEY,           -- "my-company/custom_robot_arm"
  name TEXT,                     -- "Custom Robot Arm"
  domain TEXT,                   -- "manufacturing"
  asset_class TEXT,              -- "robots"
  format TEXT,                   -- "urdf" | "mjcf" | "step"
  manufacturer TEXT,             -- "ACME Robotics"
  ...
);
```

### Layer 3: Loaders (Format-Specific)

**kinetiCORE client** handles format parsing:

```typescript
// Auto-detect format and load
const loader = AssetLoaderFactory.create(asset.format);
const model = await loader.load(assetFiles);

// URDF Loader
class URDFLoader implements AssetLoader {
  async load(files: Map<string, ArrayBuffer>) {
    // Parse URDF, load meshes, build kinematic tree
  }
}

// MJCF Loader
class MJCFLoader implements AssetLoader {
  async load(files: Map<string, ArrayBuffer>) {
    // Parse MJCF XML, load meshes
  }
}

// STEP Loader (future)
class STEPLoader implements AssetLoader {
  async load(files: Map<string, ArrayBuffer>) {
    // Parse STEP geometry
  }
}
```

---

## Real-World Workflows

### Workflow 1: Company Uploads Custom Robots

**Scenario:** ACME Robotics wants to host their proprietary robot models

```bash
# 1. Prepare robot directory
acme_robot_v2/
├── robot.urdf
├── meshes/
│   ├── base.stl
│   ├── link1.stl
│   └── ...
└── README.md

# 2. Upload via web UI
Open kinetiCORE → Asset Library → Upload → Drag & drop folder

# 3. Or via CLI
npm run import-assets -- \
  --source ./acme_robot_v2 \
  --format urdf \
  --namespace "acme-robotics" \
  --upload
```

**Result:** Available at `kineticore.io/assets/acme-robotics/acme_robot_v2`

### Workflow 2: Customer Uploads Factory Layout

**Scenario:** Customer wants to simulate their factory equipment

```bash
# Customer exports from their CAD system
factory_conveyor/
├── conveyor_system.step
├── motor_specs.pdf
└── thumbnail.png

# Upload via web UI
Drag & drop → Automatic format detection (STEP) → Upload

# Asset immediately available in customer's library
```

### Workflow 3: Import Open-Source Collection

**Scenario:** Import ROS Industrial robots (URDF format)

```bash
# Clone ROS Industrial repository
git clone https://github.com/ros-industrial/robot_descriptions

# Import to kinetiCORE cloud
npm run import-assets -- \
  --source ./robot_descriptions \
  --format urdf \
  --namespace "ros-industrial" \
  --upload
```

### Workflow 4: Vendor Publishes Official Models

**Scenario:** Universal Robots publishes official UR5e model

```bash
# UR engineers prepare official package
ur5e_official/
├── ur5e.urdf
├── meshes/
├── joint_limits.yaml
└── README.md

# Upload with verified badge
Upload → Verify ownership → Tag as "official" → Publish
```

---

## Import Script: Generic by Design

The `import-asset-collection.ts` script is **completely generic**:

### Features

✅ **Multi-format support:** URDF, MJCF, STEP, auto-detect
✅ **Any directory structure:** Organized folders with assets
✅ **Custom namespaces:** `my-company`, `customer-123`, etc.
✅ **External metadata:** Load metadata from JSON/YAML
✅ **Selective import:** Filter with regex patterns
✅ **Dry-run mode:** Preview before uploading

### Example Uses

**Import Your Company Library:**
```bash
npm run import-assets -- \
  --source /path/to/your_robots \
  --format urdf \
  --namespace "your-company" \
  --upload
```

**Import MuJoCo Menagerie (just one option!):**
```bash
npm run import-assets -- \
  --source /path/to/mujoco_menagerie \
  --format mjcf \
  --namespace "mujoco-menagerie" \
  --dry-run
```

**Import with Custom Metadata:**
```bash
npm run import-assets -- \
  --source /path/to/assets \
  --metadata robots_metadata.json \
  --namespace "acme" \
  --upload
```

---

## Namespace Strategy

Assets are organized by **namespace** to prevent conflicts:

| Namespace | Owner | Example Assets |
|-----------|-------|----------------|
| `my-company` | Your organization | `my-company/robot_arm_v2` |
| `customer-abc` | Specific customer | `customer-abc/factory_layout` |
| `mujoco-menagerie` | Community (optional) | `mujoco-menagerie/franka_panda` |
| `ros-industrial` | Community (optional) | `ros-industrial/ur5e` |
| `fanuc` | Vendor (future) | `fanuc/m20ia` |
| `universal-robots` | Vendor (future) | `universal-robots/ur5e_official` |

**Format:** `{namespace}/{asset_name}`

---

## Migration Path

### Phase 1: Generic Foundation (Current)
- ✅ Format-agnostic storage (R2)
- ✅ Generic metadata schema (D1)
- ✅ Multi-format loader architecture
- ✅ Generic import script

### Phase 2: User Upload UI
- ⏳ Web-based upload interface
- ⏳ Drag & drop asset folders
- ⏳ Automatic format detection
- ⏳ Metadata form

### Phase 3: Format Expansion
- ⏳ STEP loader implementation
- ⏳ glTF loader
- ⏳ JT loader (industrial CAD)

### Phase 4: Vendor Integration
- ⏳ Fanuc catalog API
- ⏳ Universal Robots models
- ⏳ ABB RobotStudio integration

---

## Key Differentiators

### vs. GitHub/GrabCAD
- **kinetiCORE:** Simulation-ready, validated, versioned, searchable by capabilities
- **GitHub:** Just file storage, no validation, no capability search

### vs. ROS Package Repos
- **kinetiCORE:** Multi-format, not ROS-specific, web-based, cross-platform
- **ROS:** URDF only, requires ROS installation

### vs. Vendor Websites
- **kinetiCORE:** Unified search across all vendors, version management, simulation-optimized
- **Vendor Sites:** Fragmented, download-only, not simulation-optimized

---

## Summary

**kinetiCORE Cloud Assets = Generic Industrial Asset Infrastructure**

- 🌍 **Universal:** Any format, any source, any domain
- 🏢 **Multi-tenant:** Company, customer, community namespaces
- 🔧 **Flexible:** Upload, import, or API integration
- 📊 **Searchable:** Find assets by capabilities, not just names
- ✅ **Validated:** Automatic format checking and thumbnail generation
- 🚀 **Fast:** Global CDN, intelligent caching

**MuJoCo Menagerie is just one example data source** - the system is designed to host assets from anywhere, in any format.

---

## See Also

- [Cloud Asset Storage Plan](./CLOUD_ASSET_STORAGE_PLAN.md) - Full technical architecture
- [Quick Start Guide](./QUICK_START_CLOUD_ASSETS.md) - Implementation guide
- [Import Script Examples](../scripts/examples/) - Real-world import examples

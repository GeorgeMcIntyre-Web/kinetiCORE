# Asset Deduplication - Visual Explanation

## Without Deduplication (Old Way) ❌

```
┌──────────────────────────────────────────────────────────────┐
│                        World Save File                        │
└──────────────────────────────────────────────────────────────┘

Robot Instance 1 "Welding Robot"
├─ Complete URDF file (500 KB)
├─ base_link.stl (1.2 MB)
├─ link1.stl (800 KB)
├─ link2.stl (900 KB)
├─ link3.stl (600 KB)
├─ link4.stl (400 KB)
├─ link5.stl (300 KB)
├─ link6.stl (200 KB)
├─ Position: (0, 0, 0)
└─ Joint states: [0, -90, 90, 0, 0, 0]

Robot Instance 2 "Painting Robot" (SAME MODEL!)
├─ Complete URDF file (500 KB)      ← DUPLICATE!
├─ base_link.stl (1.2 MB)           ← DUPLICATE!
├─ link1.stl (800 KB)               ← DUPLICATE!
├─ link2.stl (900 KB)               ← DUPLICATE!
├─ link3.stl (600 KB)               ← DUPLICATE!
├─ link4.stl (400 KB)               ← DUPLICATE!
├─ link5.stl (300 KB)               ← DUPLICATE!
├─ link6.stl (200 KB)               ← DUPLICATE!
├─ Position: (5, 0, 0)
└─ Joint states: [30, -45, 70, 0, 15, -30]

Robot Instance 3 "Assembly Robot" (SAME MODEL!)
├─ Complete URDF file (500 KB)      ← DUPLICATE!
├─ base_link.stl (1.2 MB)           ← DUPLICATE!
├─ ... (all files repeated again)
└─ ...

─────────────────────────────────────────────────────────────

Total Storage:
  3 robots × 5.3 MB each = 15.9 MB

Problem: 90% of data is duplicated! 😱
```

---

## With Deduplication (New Way) ✅

```
┌──────────────────────────────────────────────────────────────┐
│                        World Save File                        │
└──────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────┐
│  ASSET LIBRARY (Deduplicated - Stored Once)                 │
└────────────────────────────────────────────────────────────┘

Library Asset: "lib_asset_kr270"
├─ ID: "lib_asset_kr270"
├─ Name: "KUKA KR270 R2700"
├─ LoaderType: "urdf"
├─ FilePath: "robots/kuka/kr270/robot.urdf"
├─ URDF file (500 KB)
├─ base_link.stl (1.2 MB)
├─ link1.stl (800 KB)
├─ link2.stl (900 KB)
├─ link3.stl (600 KB)
├─ link4.stl (400 KB)
├─ link5.stl (300 KB)
├─ link6.stl (200 KB)
└─ Total: 5.3 MB ← STORED ONCE! ✨

┌────────────────────────────────────────────────────────────┐
│  ASSET INSTANCES (References Only)                          │
└────────────────────────────────────────────────────────────┘

Instance 1: "Welding Robot"
├─ AssetID: "lib_asset_kr270" ← REFERENCE!
├─ Position: (0, 0, 0)
├─ Rotation: (0, 0, 0, 1)
├─ Joint states: [0, -90, 90, 0, 0, 0]
└─ Size: ~2 KB

Instance 2: "Painting Robot"
├─ AssetID: "lib_asset_kr270" ← REFERENCE!
├─ Position: (5, 0, 0)
├─ Rotation: (0, 0, 0.707, 0.707)
├─ Joint states: [30, -45, 70, 0, 15, -30]
└─ Size: ~2 KB

Instance 3: "Assembly Robot"
├─ AssetID: "lib_asset_kr270" ← REFERENCE!
├─ Position: (10, 0, 0)
├─ Rotation: (0, 0, -0.707, 0.707)
├─ Joint states: [0, 0, 0, 0, 0, 0]
└─ Size: ~2 KB

─────────────────────────────────────────────────────────────

Total Storage:
  1 asset × 5.3 MB + 3 instances × 2 KB = 5.306 MB

Reduction: 15.9 MB → 5.3 MB = 67% savings! 🎉
With 50 robots: 265 MB → 5.4 MB = 98% savings! 🚀
```

---

## How It Works

### 1. On Save

```typescript
// Step 1: Collect unique assets
const usedAssets = new Set<string>();
scene.getAllInstances().forEach(instance => {
  usedAssets.add(instance.assetId);
});

// Step 2: Build asset library (deduplicated)
const assetLibrary = {
  assets: Array.from(usedAssets).map(assetId => ({
    id: assetId,
    name: "KUKA KR270 R2700",
    loaderType: "urdf",
    filePath: "robots/kuka/kr270/robot.urdf",
    meshes: [...] // Full mesh data stored here
  }))
};

// Step 3: Save instances (references only)
const assetInstances = scene.getAllInstances().map(instance => ({
  id: instance.id,
  assetId: instance.assetId, // ← Just a reference!
  position: instance.position,
  rotation: instance.rotation,
  jointStates: instance.jointStates
}));

// Final save data
const worldData = {
  assetLibrary,        // Big, but deduplicated
  assetInstances       // Small, just references
};
```

### 2. On Load

```typescript
// Step 1: Load asset library (once per unique asset)
const assetCache = new Map<string, LoadedAsset>();

for (const libAsset of worldData.assetLibrary.assets) {
  const loadedAsset = await loadAsset(libAsset);
  assetCache.set(libAsset.id, loadedAsset);
}

// Step 2: Instantiate each instance
for (const instance of worldData.assetInstances) {
  // Get the loaded asset from cache
  const asset = assetCache.get(instance.assetId);
  
  // Clone the asset for this instance
  const clone = asset.clone();
  
  // Apply instance-specific transform
  clone.setPosition(instance.position);
  clone.setRotation(instance.rotation);
  clone.setJointStates(instance.jointStates);
  
  // Add to scene
  scene.add(clone);
}
```

---

## Real-World Example

### Factory Simulation Scene

```
┌─────────────────────────────────────────────────────────────┐
│  Asset Library (Unique Assets)                               │
├─────────────────────────────────────────────────────────────┤
│  1. KUKA KR270 (5.3 MB)                                      │
│  2. Belt Conveyor 2m (800 KB)                                │
│  3. Pallet (200 KB)                                          │
│  4. Safety Fence Panel (150 KB)                              │
│  5. Work Table (400 KB)                                      │
│  ─────────────────────────────                               │
│  Total: 6.85 MB                                              │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  Asset Instances (References + Transforms)                   │
├─────────────────────────────────────────────────────────────┤
│  • 10 × KUKA KR270 robots (10 × 2 KB = 20 KB)               │
│  • 5 × Belt Conveyors (5 × 2 KB = 10 KB)                     │
│  • 50 × Pallets (50 × 2 KB = 100 KB)                         │
│  • 40 × Safety Fence Panels (40 × 2 KB = 80 KB)             │
│  • 20 × Work Tables (20 × 2 KB = 40 KB)                      │
│  ─────────────────────────────                               │
│  Total: 250 KB                                               │
└─────────────────────────────────────────────────────────────┘

Final Save Size:
  Asset Library: 6.85 MB
  Asset Instances: 250 KB
  Scene State: 50 KB
  ─────────────────────
  Total: 7.15 MB

Without Deduplication:
  10 robots × 5.3 MB = 53 MB
  5 conveyors × 800 KB = 4 MB
  50 pallets × 200 KB = 10 MB
  40 fences × 150 KB = 6 MB
  20 tables × 400 KB = 8 MB
  ─────────────────────
  Total: 81 MB

Savings: 81 MB → 7.15 MB = 91% reduction! 🎉
```

---

## Benefits

### 1. Storage Efficiency
- 10× to 100× smaller files
- Cheaper cloud storage costs
- Faster backups

### 2. Network Efficiency
- Faster uploads/downloads
- Better for collaboration (less data to sync)
- Better for auto-saves (smaller payloads)

### 3. Memory Efficiency
- Assets loaded once, cloned for instances
- Less RAM usage
- Faster scene loading

### 4. Version Control Friendly
- Smaller diffs when assets don't change
- Only instance transforms change
- Git-friendly JSON structure

---

## Implementation Notes

### Asset ID Generation

```typescript
// Generate consistent asset ID
function generateAssetId(asset: LibraryAsset): string {
  // Use checksum of file path + version
  return `lib_asset_${hash(asset.filePath + asset.version)}`;
}
```

### Asset Caching

```typescript
class AssetCache {
  private cache = new Map<string, LoadedAsset>();
  
  async get(assetId: string): Promise<LoadedAsset> {
    if (this.cache.has(assetId)) {
      return this.cache.get(assetId)!;
    }
    
    const asset = await this.loadAsset(assetId);
    this.cache.set(assetId, asset);
    return asset;
  }
}
```

### Instance Cloning

```typescript
// Clone asset for new instance
function createInstance(
  asset: LoadedAsset, 
  transform: Transform
): SceneObject {
  // Clone meshes (cheap - reference same geometry)
  const clone = asset.clone();
  
  // Apply instance-specific transform
  clone.position = transform.position;
  clone.rotation = transform.rotation;
  clone.scale = transform.scale;
  
  return clone;
}
```

---

## FAQ

**Q: What if the same asset has different versions?**  
A: Each version gets its own library entry with unique ID:
```
lib_asset_kr270_v1.0.0
lib_asset_kr270_v1.2.0
lib_asset_kr270_v2.0.0
```

**Q: What if I modify a mesh file?**  
A: The checksum changes, creating a new asset ID. Old instances still reference old asset.

**Q: Can I update all instances when the library asset changes?**  
A: Yes! Find all instances with matching assetId and reload them:
```typescript
scene.getAllInstances()
  .filter(inst => inst.assetId === updatedAssetId)
  .forEach(inst => inst.reload());
```

**Q: What about instance-specific overrides (like colors)?**  
A: Store in `customProperties`:
```typescript
{
  assetId: "lib_asset_kr270",
  customProperties: {
    overrideMaterial: true,
    baseColor: "#FF0000"
  }
}
```

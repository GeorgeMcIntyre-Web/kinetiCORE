# Auto Kinematics - Actual Workflow Analysis & Refactoring Plan

## Critical Misunderstanding in Documentation

### ❌ **What I Documented** (WRONG):
```
User loads tooling JSON → Parse → Create joints → Animate
```

### ✅ **What Actually Happens** (CORRECT):
```
1. User loads GLB → Identify fixed/moving nodes → Capture states → Run ICP
2. System GENERATES tooling JSON from ICP results
3. User can then use JSON for kinematic animation
```

---

## Actual Workflow (Step by Step)

### **Phase 1: Scene Analysis** (User-Driven)

```
Step 1: Load GLB file
  → Contains tooling fixture (e.g., 9X_110_GEO.glb)
  → Has multiple units (UNIT_118, UNIT_112, etc.)
  │
Step 2: ToolGraphAnalyzer.analyze(scene)
  → Identifies tool units by NAME matching
     Problem: Uses string heuristics (lines 99-102)
       - "unit", "gripper", "fixture", "clamp", "slide"
  → Classifies fixed vs moving by NAME (lines 120-133)
       Problem: "fixture" → fixed, parent hierarchy → fixed
  → Returns: ToolGraph with units marked as fixed/moving
  │
Step 3: User manually positions moving parts
  → Move clamp to "retracted" position → Capture state A
  → Move clamp to "extended" position → Capture state B
  │
Step 4: StateCapture.capture() for each state
  → Samples mesh vertices as point clouds
  → Returns: CapturedStateSnapshot {pointCloud: Vector3[]}
  │
Step 5: ICP.align(pointCloudA, pointCloudB)
  → Finds rigid transform between states
  → Returns: Transform matrix + RMS error
  │
Step 6: Extract joint parameters from ICP result
  → IF mostly translation → prismatic joint
  → IF mostly rotation → hinge joint
  → Extract axis, anchor, limits
  │
Step 7: Generate tooling JSON
  → Write 9X_110_GEO.json with fitted parameters
  → Includes RmsError for quality validation
```

### **Phase 2: Kinematic Playback** (System-Driven)

```
Step 8: Load tooling JSON (from Phase 1)
  → Parse with ToolingJsonAdapter
  │
Step 9: Create ValveBank with joints
  → Register each joint definition
  │
Step 10: Animate with timeline
  → ValveBank.runTimeline(events)
  → Visualize motion
```

---

## Problems Identified

### **Problem 1: String-Based Fixed/Moving Detection** ⚠️ CRITICAL

**Current Code** (ToolGraphAnalyzer.ts:99-133):
```typescript
// Line 101: Name matching
const nameMatch = ['tool', 'unit', 'gripper', 'fixture', 'clamp', 'slide'].some(s => name.includes(s));

// Line 122: Type from name
const type = classifyTypeByName(root.name, opts.nameHints);

// Line 127: Fixed if type === 'fixture'
if (type === 'fixture') isFixed = true;
```

**Why This is Bad**:
- ❌ Relies on CAD naming conventions (not guaranteed)
- ❌ Fails if moving part named "fixture_jaw_moving"
- ❌ Cannot detect duplicate geometry (copy of fixed part)
- ❌ No geometric analysis

**Your Suggestion** (CORRECT):
> "Identify nodes based on geometric data, keeping in mind cases where the moving part is not a copy of the fixed part causing point cloud mismatches."

---

### **Problem 2: No Pipeline Integration** ⚠️ HIGH

**Missing Components**:
1. ❌ No UI to trigger ToolGraphAnalyzer
2. ❌ No state capture UI ("Capture Retracted", "Capture Extended" buttons)
3. ❌ No ICP execution workflow
4. ❌ No JSON generation/export
5. ❌ No workflow orchestrator connecting the pieces

**Current State**:
- Individual modules exist (ToolGraphAnalyzer, StateCapture, ICP)
- No integration between them
- Demo scripts are synthetic (don't use real GLB data)

---

### **Problem 3: Incomplete ICP → Joint Extraction** ⚠️ HIGH

**What ICP Gives You**:
```typescript
ICPResult {
  transform: Matrix4x4,  // Rigid transform (R|t)
  rmsError: 0.0012,      // Fit quality
  iterations: 23,
  correspondences: 4523
}
```

**What You Need for Tooling JSON**:
```typescript
{
  Type: 0 or 1,              // prismatic vs hinge
  FromVector: {X, Y, Z},     // Anchor point
  ToVector: {X, Y, Z},       // Axis endpoint
  MinValue: 0.0,             // Lower limit
  MaxValue: 0.05,            // Upper limit (how to get this?)
  TransformationMatrix: [...]  // 4x4 as strings
}
```

**Missing Logic**:
```typescript
// ❌ NOT IMPLEMENTED
function transformToJoint(icpResult, stateA, stateB) {
  const T = icpResult.transform;

  // 1. Classify joint type
  const translation = extractTranslation(T);
  const rotation = extractRotation(T);

  if (translation.length() > 0.001 && rotation.angle < 0.01) {
    // PRISMATIC
    return {
      Type: 0,
      FromVector: stateA.anchor,
      ToVector: stateA.anchor + translation,
      MinValue: 0.0,
      MaxValue: translation.length(),
      TransformationMatrix: T.toStringArray()
    };
  } else if (rotation.angle > 0.01) {
    // HINGE
    return {
      Type: 1,
      FromVector: rotation.pivotPoint,
      ToVector: rotation.pivotPoint + rotation.axis,
      MinValue: 0,  // ??? How to determine limits?
      MaxValue: rotation.angle,  // ??? Just from this one sample?
      TransformationMatrix: T.toStringArray()
    };
  }
}
```

---

### **Problem 4: Missing Geometric Detection** ⚠️ HIGH

**What You Want**:
```typescript
class GeometricToolAnalyzer {
  /**
   * Detect fixed vs moving by geometric properties, not names.
   */
  analyzeByGeometry(scene: Scene): ToolGraph {
    const units = [];

    // Strategy 1: Bounding box stability
    //   - Fixed parts: Large bounding box, at origin/base
    //   - Moving parts: Smaller, offset from base

    // Strategy 2: Geometric similarity
    //   - Look for pairs of similar geometry (duplicate meshes)
    //   - Assumption: Moving part is copy of fixed part (sometimes)
    //   - BUT: Handle cases where they differ (your concern)

    // Strategy 3: Connection analysis
    //   - Fixed: Connected to many other parts
    //   - Moving: Connected to few parts (end effector)

    // Strategy 4: Center of mass
    //   - Fixed: Near world origin
    //   - Moving: Offset from origin

    // Strategy 5: Vertex density
    //   - Fixed: High vertex count (complex base)
    //   - Moving: Lower vertex count (simpler gripper)

    return {units, anchors};
  }
}
```

**Implementation Needed**:
```typescript
// Bounding box analysis
function analyzeBoundingBoxes(scene: Scene): {fixed: Node[], moving: Node[]} {
  const allMeshes = scene.meshes;
  const bounds = allMeshes.map(m => ({
    mesh: m,
    box: m.getBoundingInfo().boundingBox,
    volume: computeVolume(m.getBoundingInfo()),
    centroid: m.getBoundingInfo().boundingBox.center
  }));

  // Sort by volume (largest = likely fixed)
  bounds.sort((a, b) => b.volume - a.volume);

  const threshold = 0.7; // Top 70% by volume = fixed
  const cutoff = Math.floor(bounds.length * threshold);

  return {
    fixed: bounds.slice(0, cutoff).map(b => b.mesh),
    moving: bounds.slice(cutoff).map(b => b.mesh)
  };
}

// Geometric similarity detection
function findDuplicateGeometry(meshA: Mesh, meshB: Mesh): number {
  // Returns similarity score 0-1

  // Compare vertex count
  const vCountA = meshA.getTotalVertices();
  const vCountB = meshB.getTotalVertices();
  if (Math.abs(vCountA - vCountB) / Math.max(vCountA, vCountB) > 0.1) {
    return 0; // >10% difference = not similar
  }

  // Sample vertices and compare shapes
  const sampleA = sampleVertices(meshA, 100);
  const sampleB = sampleVertices(meshB, 100);

  // Align centroids
  const centroidA = computeCentroid(sampleA);
  const centroidB = computeCentroid(sampleB);
  const alignedB = sampleB.map(v => v.subtract(centroidB).add(centroidA));

  // Compute Hausdorff distance
  const dist = hausdorffDistance(sampleA, alignedB);

  // Similarity = 1 / (1 + distance)
  return 1 / (1 + dist);
}
```

---

## Refactoring Plan

### **Phase 1: Fix Detection Logic** (Critical)

#### **File**: `src/babylon/sceneAnalysis/GeometricToolAnalyzer.ts` (NEW)

```typescript
/**
 * Geometric-based tool unit detection.
 * Does NOT rely on naming conventions.
 */
export class GeometricToolAnalyzer {
  /**
   * Analyze scene using geometric properties.
   */
  analyze(scene: Scene, options: GeometricAnalyzeOptions): ToolGraph {
    // 1. Group meshes by spatial clustering
    const clusters = this.clusterBySpatialProximity(scene.meshes);

    // 2. Classify each cluster as fixed or moving
    for (const cluster of clusters) {
      const metrics = this.computeClusterMetrics(cluster);

      // Decision tree:
      if (metrics.volume > threshold && metrics.centroid.length() < 0.5) {
        cluster.type = 'fixed';  // Large, near origin
      } else if (metrics.connectivity < 3) {
        cluster.type = 'moving'; // Few connections = end effector
      } else {
        cluster.type = 'unknown'; // User must decide
      }
    }

    // 3. Find geometric duplicates
    for (const clusterA of clusters) {
      for (const clusterB of clusters) {
        if (clusterA === clusterB) continue;
        const similarity = this.computeSimilarity(clusterA, clusterB);
        if (similarity > 0.8) {
          // Likely one is moving copy of fixed
          // Heuristic: smaller one is moving
          if (clusterA.volume < clusterB.volume) {
            clusterA.type = 'moving';
            clusterB.type = 'fixed';
          } else {
            clusterA.type = 'fixed';
            clusterB.type = 'moving';
          }
        }
      }
    }

    return this.toToolGraph(clusters);
  }

  private clusterBySpatialProximity(meshes: Mesh[]): MeshCluster[] {
    // Use k-means or DBSCAN on mesh centroids
  }

  private computeClusterMetrics(cluster: MeshCluster): Metrics {
    return {
      volume: totalVolume(cluster.meshes),
      centroid: averagePosition(cluster.meshes),
      connectivity: countNeighbors(cluster),
      vertexCount: totalVertices(cluster.meshes)
    };
  }

  private computeSimilarity(clusterA, clusterB): number {
    // Hausdorff distance on sampled vertices
  }
}
```

---

### **Phase 2: Build Complete Pipeline** (High Priority)

#### **File**: `src/babylon/pipeline/KinematicExtractionPipeline.ts` (NEW)

```typescript
/**
 * Orchestrates the complete workflow:
 * Scene → Analysis → State Capture → ICP → JSON Export
 */
export class KinematicExtractionPipeline {
  /**
   * Step 1: Analyze scene and identify tool units.
   */
  async analyzeScene(scene: Scene): Promise<ToolGraph> {
    const analyzer = new GeometricToolAnalyzer();
    return analyzer.analyze(scene, {/* options */});
  }

  /**
   * Step 2: Capture state snapshots (user positions moving parts).
   *
   * @param unitId - Tool unit to capture
   * @param stateName - 'retracted' or 'extended'
   */
  async captureState(
    scene: Scene,
    unitId: string,
    stateName: 'retracted' | 'extended'
  ): Promise<CapturedStateSnapshot> {
    const capture = new StateCapture();
    const unit = this.toolGraph.units.find(u => u.id === unitId);

    return capture.capture(scene, unitId, stateName, {
      kind: 'nodes',
      nodeIds: unit.nodes
    }, {
      samplePoints: true,
      stride: 5,  // Every 5th vertex
      maxPoints: 10000
    });
  }

  /**
   * Step 3: Run ICP to find transform between states.
   */
  async fitJoint(
    retractedState: CapturedStateSnapshot,
    extendedState: CapturedStateSnapshot
  ): Promise<JointFitResult> {
    const icp = new ICP();
    const result = icp.align(
      retractedState.pointCloud,
      extendedState.pointCloud,
      {
        maxIterations: 50,
        tolerance: 1e-5,
        trimFraction: 0.8,
        rejectThreshold: 0.05
      }
    );

    // Extract joint parameters
    return this.extractJointFromTransform(result);
  }

  /**
   * Step 4: Convert ICP transform to joint definition.
   */
  private extractJointFromTransform(icpResult: ICPResult): JointFitResult {
    const T = icpResult.transform;

    // Decompose into translation + rotation
    const {translation, rotation, pivot} = this.decomposeTransform(T);

    // Classify type
    const transLen = translation.length();
    const rotAngle = rotation.angle;

    if (transLen > 0.001 && rotAngle < 0.05) {
      // PRISMATIC
      return {
        type: 'prismatic',
        axis: translation.normalize(),
        anchor: pivot,  // Or centroid of point cloud
        limits: {lower: 0, upper: transLen},
        rmsError: icpResult.rmsError,
        transformMatrix: T
      };
    } else if (rotAngle > 0.05) {
      // HINGE
      return {
        type: 'hinge',
        axis: rotation.axis,
        anchor: pivot,
        limits: {lower: 0, upper: rotAngle},  // ⚠️ Only from this sample!
        rmsError: icpResult.rmsError,
        transformMatrix: T
      };
    } else {
      throw new Error('Could not determine joint type - insufficient motion');
    }
  }

  /**
   * Step 5: Export to tooling JSON format.
   */
  exportToJSON(joints: JointFitResult[]): ToolingFileJson {
    return joints.map(j => ({
      UnitName: j.unitId,
      Joints: [{
        Name: j.name,
        ElectricalName: j.name.toUpperCase(),
        NodeId: j.childNodePath,
        Type: j.type === 'prismatic' ? 0 : 1,
        MinValue: j.limits.lower,
        MaxValue: j.limits.upper,
        FromVector: toJSONVector(j.anchor),
        ToVector: toJSONVector(j.anchor.add(j.axis)),
        TransformationMatrix: matrixToStringArray(j.transformMatrix),
        RmsError: j.rmsError,
        MaxError: j.maxError
      }]
    }));
  }

  /**
   * Complete workflow (all steps).
   */
  async runComplete(scene: Scene): Promise<ToolingFileJson> {
    // 1. Analyze
    this.toolGraph = await this.analyzeScene(scene);
    console.log(`Found ${this.toolGraph.units.length} units`);

    // 2. For each moving unit, capture states
    const joints = [];
    for (const unit of this.toolGraph.units.filter(u => !u.isFixed)) {
      console.log(`Capturing states for ${unit.name}...`);

      // User manually positions → capture
      const retracted = await this.captureState(scene, unit.id, 'retracted');
      // ... (wait for user to reposition)
      const extended = await this.captureState(scene, unit.id, 'extended');

      // 3. Fit joint
      const joint = await this.fitJoint(retracted, extended);
      joints.push(joint);
    }

    // 4. Export
    return this.exportToJSON(joints);
  }
}
```

---

### **Phase 3: UI Integration** (Medium Priority)

#### **New Panel**: `src/ui/components/KinematicExtractionPanel.tsx`

```typescript
/**
 * UI for kinematic extraction workflow.
 */
export const KinematicExtractionPanel = () => {
  const [step, setStep] = useState<'analyze' | 'capture' | 'fit'>('analyze');
  const [toolGraph, setToolGraph] = useState<ToolGraph | null>(null);
  const [selectedUnit, setSelectedUnit] = useState<string | null>(null);

  const pipeline = useMemo(() => new KinematicExtractionPipeline(), []);

  const handleAnalyze = async () => {
    const graph = await pipeline.analyzeScene(scene);
    setToolGraph(graph);
    setStep('capture');
  };

  const handleCaptureRetracted = async () => {
    const snapshot = await pipeline.captureState(scene, selectedUnit, 'retracted');
    setState({retracted: snapshot});
  };

  const handleCaptureExtended = async () => {
    const snapshot = await pipeline.captureState(scene, selectedUnit, 'extended');
    setState({extended: snapshot});
    setStep('fit');
  };

  const handleFit = async () => {
    const joint = await pipeline.fitJoint(state.retracted, state.extended);
    // Show results: type, axis, limits, RMS error
    setJoint(joint);
  };

  const handleExport = () => {
    const json = pipeline.exportToJSON([joint]);
    downloadJSON('9X_110_GEO.json', json);
  };

  return (
    <FloatingPanel title="Kinematic Extraction">
      {step === 'analyze' && (
        <>
          <Button onClick={handleAnalyze}>1. Analyze Scene</Button>
          <p>Detect fixed and moving tool units</p>
        </>
      )}

      {step === 'capture' && (
        <>
          <Select value={selectedUnit} onChange={setSelectedUnit}>
            {toolGraph?.units.filter(u => !u.isFixed).map(u => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </Select>

          <Button onClick={handleCaptureRetracted}>
            2a. Capture Retracted Position
          </Button>
          <Button onClick={handleCaptureExtended}>
            2b. Capture Extended Position
          </Button>
          <p>Manually position moving part between captures</p>
        </>
      )}

      {step === 'fit' && (
        <>
          <Button onClick={handleFit}>3. Fit Joint with ICP</Button>
          <Button onClick={handleExport}>4. Export JSON</Button>

          {joint && (
            <div>
              <p>Type: {joint.type}</p>
              <p>RMS Error: {joint.rmsError.toFixed(4)}m</p>
              <p>Limits: [{joint.limits.lower}, {joint.limits.upper}]</p>
            </div>
          )}
        </>
      )}
    </FloatingPanel>
  );
};
```

---

## Summary of Issues

| Issue | Severity | Status | Solution |
|-------|----------|--------|----------|
| String-based fixed/moving detection | 🔴 Critical | ❌ Not addressed | GeometricToolAnalyzer |
| No pipeline integration | 🟠 High | ❌ Missing | KinematicExtractionPipeline |
| Incomplete ICP→Joint conversion | 🟠 High | ❌ Missing | extractJointFromTransform() |
| No UI for workflow | 🟡 Medium | ❌ Missing | KinematicExtractionPanel |
| Documentation assumes wrong workflow | 🟡 Medium | ❌ Needs rewrite | Update user guide |
| No handling of geometric mismatches | 🟠 High | ❌ Not addressed | Robust ICP with outlier rejection |

---

## Next Steps (Priority Order)

### **Immediate** (This PR):
1. ✅ Create this analysis document
2. ⏳ Implement `GeometricToolAnalyzer` with bounding box + similarity
3. ⏳ Implement `KinematicExtractionPipeline` orchestrator
4. ⏳ Add `extractJointFromTransform()` logic
5. ⏳ Update user guide with CORRECT workflow

### **Short Term** (Next PR):
6. Build `KinematicExtractionPanel` UI
7. Integrate with existing actuator panel
8. Add joint limit refinement (multiple samples)
9. Handle geometric mismatch cases (partial overlaps)

### **Long Term**:
10. ML-based tool unit classification
11. Automatic joint limit discovery (sweep through range)
12. Multi-state ICP (not just 2 poses)

---

**Conclusion**: The modules are well-designed, but there's a **missing middle layer** that connects them into a working pipeline. The documentation assumed a different workflow than what's actually implemented.

# FEA Architecture Draft (v1)

## 1. Scope (v1)

### Analysis Type
- **Linear static, elastic analysis only**
- No geometric nonlinearity, contact, or dynamics in v1
- Focus on engineering concept validation and design support

### Element Types (Roadmap)
- **Phase 1 (current):** 1D beam elements for frames and simple structures
- **Phase 2:** 2D shell elements (S8R target) for panels and BIW components
- **Phase 3:** 3D solid elements for complex geometries

### Output Metrics
- **Nodal displacements** (magnitude and components)
- **von Mises equivalent stress** (element-based)
- **Factor of Safety (FoS)** - optional, based on material yield strength
- **Strain energy** - for validation and convergence checks

### Use Case
- **Not certified CAE** - for concept/engineering support only
- Rapid structural feedback during design iteration
- Pre-simulation for identifying critical areas before full FEA in external tools
- Educational/training tool for understanding structural behavior

---

## 2. Compute Model (Three-Tier Architecture)

### Tier 0: In-Browser Demo Solver
**Purpose:** Educational, visualization experiments, tiny models (<100 DOF)

**Characteristics:**
- Pure TypeScript/JavaScript implementation
- Runs synchronously in browser main thread or web worker
- Limited to simple element types (beam, truss)
- No external dependencies
- Instant feedback, no network latency

**Use Cases:**
- Beam cantilever demos
- Simple truss structures
- API shape experimentation
- Visualization prototyping

**Limitations:**
- Small models only (performance)
- No advanced element formulations
- No mesh import capabilities

### Tier 1: Local Workstation Solver
**Purpose:** Production engineering work on powerful local machines

**Hardware Profile:**
- Intel i13 CPU (multi-core)
- 64 GB RAM
- RTX A4500 GPU (for visualization, future GPU-accelerated solvers)

**Software Stack:**
- HTTP service running locally (localhost:port)
- CalculiX ccx or similar open-source solver
- Gmsh for meshing
- Python FastAPI + Celery task queue

**Characteristics:**
- Handles medium models (up to ~500k DOF)
- Full element library (beams, shells, solids)
- Mesh import from STEP/STL
- Async job execution
- Results cached locally

**Use Cases:**
- Single-part stress analysis
- Small assembly analysis
- Rapid iteration during design
- Personal engineering workspace

### Tier 2: Central Server / Farm
**Purpose:** Large models, batch jobs, team collaboration

**Characteristics:**
- Same HTTP API contract as Tier 1
- Load-balanced workers
- Job prioritization and queuing
- Shared result storage
- Admin monitoring dashboard

**Use Cases:**
- Full BIW body analysis (1M+ DOF)
- Batch parametric studies
- Team shared resources
- Overnight/long-running jobs

**Routing Logic:**
- Estimated DOF count determines tier selection
- <10k DOF → Tier 0 (optional) or Tier 1
- 10k-500k DOF → Tier 1
- >500k DOF → Tier 2

---

## 3. Data Flow

### High-Level Pipeline

```
Scene Selection → FEA Model Builder → JSON Job Request → Solver (HTTP)
→ Result JSON → Visualization (Babylon.js)
```

### Detailed Steps

#### 3.1 Model Preparation (Browser)
1. User selects 3D objects in scene
2. Frontend extracts geometry (vertices, faces, topology)
3. User assigns materials via UI
4. User defines boundary conditions (fixed, constrained)
5. User defines loads (forces, pressures, gravity)

#### 3.2 Job Request Submission
Browser assembles JSON payload:

```json
{
  "meta": {
    "name": "BracketAnalysis_v3",
    "description": "Steel bracket with tip load",
    "estimatedDOFs": 12000,
    "modelType": "shell"
  },
  "geometry": {
    "nodes": [
      {"id": 1, "x": 0.0, "y": 0.0, "z": 0.0},
      {"id": 2, "x": 0.1, "y": 0.0, "z": 0.0}
    ],
    "elements": [
      {"id": 1, "type": "S8R", "nodeIds": [1, 2, 3, 4, 5, 6, 7, 8]}
    ]
  },
  "materials": [
    {
      "id": "steel_hsla",
      "name": "HSLA 350/450",
      "youngsModulus": 210e9,
      "poissonsRatio": 0.3,
      "density": 7850,
      "yieldStrength": 350e6
    }
  ],
  "boundaryConditions": [
    {
      "type": "fixed",
      "nodeIds": [1, 2, 3, 4],
      "dofs": ["ux", "uy", "uz", "rx", "ry", "rz"]
    }
  ],
  "loads": [
    {
      "type": "concentrated",
      "nodeIds": [99],
      "force": {"x": 0, "y": -1000, "z": 0}
    }
  ]
}
```

**POST** to `http://{solver-endpoint}/fea/jobs`

#### 3.3 Solver Execution (Backend)
1. Job queued in Celery/Redis
2. Worker picks up job
3. Mesh generated (Gmsh) if needed
4. CalculiX input file (.inp) generated
5. `ccx -i {jobname}` executed
6. Results parsed from .frd/.dat files
7. Result JSON assembled

#### 3.4 Result Polling (Browser)
- **GET** `/fea/jobs/{jobId}` → returns `{"status": "queued" | "running" | "completed" | "error"}`
- Poll every 1-2 seconds until `"completed"`
- **GET** `/fea/jobs/{jobId}/result` → returns result JSON

#### 3.5 Visualization (Browser)
1. Parse result JSON (displacements, stresses)
2. Apply displacement field to mesh (scale factor for visibility)
3. Color mesh by von Mises stress (gradient: blue=low, red=high)
4. Display max values, FoS in UI panel
5. Enable animation of deflected shape

---

## 4. Job Routing Strategy

### Routing Decision Logic

```typescript
function selectSolverTier(estimatedDOFs: number): SolverTier {
  if (estimatedDOFs < 1000) {
    return "tier0-browser"
  }

  if (estimatedDOFs < 100000) {
    return "tier1-local"
  }

  return "tier2-server"
}
```

### Configuration
- **Do not hard-code URLs in source**
- Use environment variables or runtime config:
  - `VITE_FEA_LOCAL_URL` (default: `http://localhost:8050`)
  - `VITE_FEA_SERVER_URL` (default: `https://fea.kinetic-core.com`)

### Failover
- If local solver unreachable, prompt user:
  - "Local solver not available. Send to central server?"
- If central server unreachable:
  - Queue job locally for retry
  - Notify user of delay

---

## 5. Roadmap

### Phase 1: Beam Demo + Local Solver Spike (Current)
**Goals:**
- ✅ In-browser beam cantilever demo (Tier 0)
- ✅ Architecture documentation
- ⬜ Local HTTP solver stub (FastAPI skeleton)
- ⬜ JSON request/response contracts defined
- ⬜ Visualization of displacement + stress fields

**Timeline:** 2-3 weeks

**Success Criteria:**
- Simple cantilever beam solves in <1s
- Displacement field displayed correctly
- Stress contour plot matches analytical solution

### Phase 2: Shell Support + BIW Subassemblies
**Goals:**
- Gmsh meshing from STEP files
- S8R shell elements in CalculiX
- Material library (HSLA steels)
- Boundary condition UI (fixed, symmetry, bolt-like constraints)
- Load application UI (forces, pressures, gravity)
- Small BIW component (door inner, floor panel)

**Timeline:** 6-8 weeks

**Success Criteria:**
- Kirsch plate hole benchmark matches theory (<5% error)
- Door inner panel analysis completes in <5 minutes
- von Mises stress visualization accurate

### Phase 3: Large Models + Central Server + Advanced Features
**Goals:**
- Central server deployment (Docker + Kubernetes)
- Job queue management UI
- Mesh refinement strategies (h-refinement)
- Advanced element types (solid elements, composites)
- Submodeling and cut boundary techniques
- Full BIW body analysis (1M+ DOF)

**Timeline:** 12-16 weeks

**Success Criteria:**
- Full BIW body solves in <30 minutes on server
- Multi-user job queue functional
- Convergence studies automated

---

## 6. Key Design Principles

### Thin Client Architecture
- **Browser = pre/post processor only**
- No heavy computation in JavaScript
- Keep browser memory usage <2 GB

### Solver Neutrality
- JSON API abstracted from specific solver
- Could swap CalculiX for Nastran, Abaqus, etc. with same contract
- Element type mapping handled by backend

### Asynchronous by Default
- All FEA jobs are async (even small ones)
- Consistent UX: submit → poll → visualize
- No blocking UI during solve

### Validation-First
- Every feature validated against analytical or reference solutions
- Automated regression tests on benchmarks
- Document validation results in repo

### Open Data Formats
- Prefer standard formats: STEP (geometry), .inp (solver), .frd (results)
- Avoid vendor lock-in
- Enable interop with other tools (Gmsh, ParaView, etc.)

---

## 7. Technology Stack Summary

### Frontend (Browser)
- **React + TypeScript** - UI and state management
- **Babylon.js** - 3D rendering and scene management
- **Zustand** - State management for FEA jobs
- **Fetch API** - HTTP client for solver communication

### Backend (Solver Service)
- **FastAPI** - HTTP API server (Python)
- **Celery + Redis** - Async job queue
- **Gmsh** - Mesh generation (Python API)
- **CalculiX ccx** - FEA solver (subprocess)
- **meshio** - Result file parsing (Python)

### Infrastructure
- **Docker** - Containerization for local/server deployment
- **nginx** - Reverse proxy for production
- **Redis** - Job queue broker + result cache
- **PostgreSQL** (future) - Job history and metadata storage

---

## 8. Security & Safety Considerations

### Input Validation
- Strict JSON schema validation on all requests
- Geometry bounds checking (prevent huge models DOS)
- Material property range validation (physical limits)

### Resource Limits
- Max DOF limits per tier
- Job timeout enforcement (kill runaway solves)
- Disk quota per user/job (prevent storage abuse)

### Results Disclaimer
- **Watermark all results:** "For concept evaluation only. Not for production certification."
- Require user acknowledgment before first FEA run
- Log all jobs for audit trail

### Solver Sandboxing
- Run solver in isolated process/container
- No access to system files outside job workspace
- Timeout + memory limits enforced by OS

---

## 9. Testing Strategy

### Unit Tests
- JSON serialization/deserialization
- Material property validation
- Boundary condition logic

### Integration Tests
- Full pipeline: submit job → solve → parse results
- API contract validation (request/response schemas)
- Error handling (bad geometry, solver failure)

### Validation Benchmarks
- **Cantilever beam** - analytical solution for tip deflection
- **Kirsch plate** - stress concentration around hole
- **Cook's membrane** - shear locking test for shell elements
- **Scordelis-Lo roof** - curved shell benchmark

### Performance Tests
- Solve time vs. DOF scaling
- Memory usage vs. model size
- Concurrent job throughput (server tier)

---

## 10. Open Questions / Future Research

### Meshing Strategy
- Automatic vs. user-controlled mesh density?
- Adaptive refinement based on stress gradients?
- Hex-dominant vs. tet meshing for solids?

### Nonlinear Extensions
- Geometric nonlinearity (large deformations)?
- Material nonlinearity (plasticity)?
- Contact (self-contact for BIW crash)?

### GPU Acceleration
- CalculiX is CPU-only. Investigate GPU solvers (e.g., AmgX, CUDA-based)?
- Trade-offs: setup time, accuracy, licensing?

### Cloud Cost Optimization
- Spot instances for batch jobs?
- Solver licensing for commercial tools?
- Result storage costs (S3 vs. local cache)?

---

## References

- **CalculiX Documentation:** http://www.dhondt.de/
- **Gmsh Documentation:** https://gmsh.info/doc/texinfo/gmsh.html
- **Thin-Client FEA Research:** (internal spec document, see repo)
- **BIW Meshing Best Practices:** (internal CAE team notes)

---

**Document Status:** Draft v1.0
**Last Updated:** 2025-01-19
**Owner:** George (Agent 1, Claude Code)
**Review:** Pending (Cole, Edwin)

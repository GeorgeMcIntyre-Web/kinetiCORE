## Inverse Kinematics (IK) – Current Status and WIP

### Scope
- Robot: Motoman MH5 (URDF-imported)
- IK methods: Jacobian Transpose (primary), CCD (fallback), FABRIK (optional path)
- Frame conventions:
  - User space: Z-up, mm
  - Engine (Babylon): Y-up, meters
  - TCP movements are specified in the TCP local frame (null TCP), then transformed to world

### Fixes Implemented
- Jacobian cross product order fixed (r × axis) in `src/kinematics/ForwardKinematicsSolver.ts`.
- `moveTCP()`/`rotateTCP()` now compute current pose using FK, not a stale scene read.
- Step-size bug fixed (removed double multiplication; adaptive step uses position error magnitude).
- Parameter tuning (Jacobian): maxIterations 1000, tolerance 0.005m, stepSize 0.1, damping 0.2.
- TCP local-frame jog mapping corrected in `src/ui/components/RobotJoggingPanelWithGizmo.tsx`:
  - Build local delta in TCP frame (meters), rotate by TCP world rotation → world delta.
- Debug overlay and gating added:
  - Axes at TCP (RGB), intended world delta (cyan), error vector (magenta)
  - Modes Off | Summary | Verbose; persisted in `localStorage.ikDebugMode`
  - Per-jog summary lines (one-liners) for quick triage
- IK method priority: Jacobian first, CCD as fallback

### Instrumentation Added
- Per-jog log bundle:
  - Current TCP world position/rotation
  - TCP local delta, world delta, target position
  - Actual final position and scalar error
- TCP local X-axis direction (world) is logged to confirm local→world mapping.
- Overlay draws axes and intended delta; error vector drawn post-solve.

### Current Behavior (as of 2025-10-28)
- X+/Z+ motions: follow TCP local axes and generate correct world deltas (confirmed by logs and overlay).
- At zero TCP rotation (R≈I), world delta for X+ equals (Δx, 0, 0) in Babylon Y-up, as expected.
- With TCP rotated about Z (e.g., Rz≈+15.9°), the world delta aligns with TCP local X-axis direction (e.g., (0.962, 0.274, 0)).
- Residual error after solve is typically ≈ 4.7–5.0 mm (within current 5 mm tolerance) for 10 mm jogs.

### Known Issues / Open Questions
- Occasional mismatch between FK-reported current pose and mesh world pose in some logs:
  - Root cause: mixing sources (FK vs mesh world transform) in different stages can cause transient differences.
  - Resolution taken: keep Jacobian iterations on FK world pose for consistency; use mesh pose for overlay/initial read.
- Jog Y± and rotary (Rx/Ry/Rz) need full pass with the new overlay and logging.
- At some poses, user perceives X+ motion as drifting “toward base and up”: overlay shows intended vector is correct; need to confirm if visual perception is due to camera or base-frame expectations. Follow-up testing planned.

### WIP / Next Steps
1) Validate all 12 jogs (X/Y/Z ±; Rx/Ry/Rz ±) with overlay and one-line summaries.
2) Tighten tolerance to 2–3 mm if convergence remains stable; otherwise consider minor step/damping tuning.
3) Add per-jog snapshot ring buffer (last 50) for deep dives (JSON export).
4) Evaluate external IK: TracIK (WASM) for fast, reliable 6-DOF IK; longer-term: backend MoveIt/PyBullet.
5) Diagram and document complete IK pipeline (FK → Jacobian → apply → scene update) with frame transforms.

### How to Test Quickly
1) Set debug mode via URL: `?ik=summary` (or use UI toggle). Persisted in `localStorage.ikDebugMode`.
2) Press TCP jog buttons. Expect per-jog block like:
   - Current pose, local delta, world delta, target, final pose, error
3) Visually confirm:
   - Red/Green/Blue axes at TCP match local frame
   - Cyan arrow (intended delta) matches the button pressed and TCP orientation
   - Magenta arrow (error) shrinks after solve

### Files Touched (high-signal)
- `src/kinematics/ForwardKinematicsSolver.ts`: Jacobian cross product fix
- `src/kinematics/InverseKinematicsSolver.ts`: target computation, parameter tuning, logging; FK vs mesh pose handling; iteration pose source restored to FK
- `src/ui/components/RobotJoggingPanelWithGizmo.tsx`: TCP local→world mapping fix; overlay; staged logging and modes; added TCP local X-axis (world) logging

### Quick Triage Tips
- If a jog “feels wrong”: check the per-jog line and overlay arrows; confirm TCP local axis direction line.
- If solver runs 1000 iterations with ≈ constant error: step too low or target unreachable/singular; try CCD fallback.
- If TCP delta seems to ignore orientation: confirm the logged TCP world rotation and local axis direction.

### Owner Notes
- Branch: `fix/tcp-jacobian-cross-product`
- Pending: run a comprehensive matrix (12 jog directions × multiple orientations), capture logs, and tune.



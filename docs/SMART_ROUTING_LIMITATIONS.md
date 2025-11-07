# Smart Routing — Known Limitations & Workarounds

This document lists current limitations and known areas for improvement, plus suggested workarounds.

## Pathfinding & Performance
- 3D grid graph can grow quickly with large scenes.
  - Workaround: reduce bounds or obstacle density; prefer localized routing.
  - Backlog: lazy neighbor generation; binary heap for A* open set; edge-level clearance checks.

## Edge Clearance
- Node-based clearance is implemented; edges may pass closer than desired to obstacles.
  - Workaround: increase clearance values; simplify obstacles.
  - Backlog: sample along edges or add segment–AABB distance checks.

## Path Smoothing
- Basic smoothing only removes near-colinear points; bends may not match fittings.
  - Workaround: manual edit using control points.
  - Backlog: spline-based smoothing with bend-radius constraints.

## Geometry Fidelity
- Cable tray/conduit are simplified for MVP.
  - Backlog: richer profiles, fittings, and supports per standard.

## Dynamic Obstacles
- Re-routing on moving obstacles is not automatic.
  - Workaround: manually recompute routes after major scene changes.
  - Backlog: event-driven revalidation and recomputation.

## Undo/Redo Coverage
- Route generation and edits are command-wrapped; bulk operations may need additional commands.
  - Backlog: extend command coverage for multi-route operations.

See also: docs/SMART_ROUTING_PR_AND_TEST_PLAN.md


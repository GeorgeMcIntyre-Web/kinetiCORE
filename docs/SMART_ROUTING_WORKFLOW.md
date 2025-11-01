# Smart Routing — Workflow Overview

This document explains the end-to-end routing workflow for reviewers and developers.

## Toolbar & Modes
- Add Connector: place new connection points in the scene.
- Route Between Points: select source and then destination to preview/create a route.
- Auto-Route All: attempts connections between compatible unconnected points (simplified).
- Edit Route: shows draggable control points for path refinement.

## Scene Integration
- Connection indicators render as colored spheres at connector locations.
- Route preview renders lines between waypoints, color-coded by validation state; violations render as small spheres.

## Inspector
- Shows route type, length, segment/support counts, validation status, and violations.
- Actions: Generate Geometry (per-type generator), Edit Segments (switch to edit mode), Delete (via command).

## Editing
- Control points are draggable; moving points updates waypoints/segments.
- Use undo/redo to revert/restore edits.

## Constraints & Validation
- Bend radius, clearance, support spacing, and optional max run length are validated.
- Violations are categorized by severity (error/warning/info).

## Notes
- Coordinate system: core uses Z-up, Babylon uses Y-up; conversions handled in UI/geometry.
- Utilities: default constraints, obstacle filtering, and ID generation are centralized.

See also: docs/SMART_ROUTING_QUICK_START.md, docs/SMART_ROUTING_LIMITATIONS.md


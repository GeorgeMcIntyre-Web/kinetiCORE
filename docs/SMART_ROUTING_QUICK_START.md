# Smart Routing — Quick Start

This guide shows how to enable the routing UI, place connectors, preview a route, generate geometry, and use undo/redo.

## Enable (feature‑gated)
- User level: set to Professional or Expert to reveal routing tools.
- Essential users: routing remains hidden by default.

## Workflow
1) Open the Routing toolbar
- With Professional/Expert level, the ribbon shows routing tools (Add Connector, Route, Auto‑Route, Edit).

2) Place connection points
- Click Add Connector, then click in the scene to place a connector.
- Repeat to create a compatible destination connector.

3) Preview a route
- Click Route Between Points, pick a source then a destination.
- A preview line renders; violations (clearance, bend radius, support spacing) show as markers.

4) Create a route
- Confirm selection to create the route via command (undoable).

5) Generate geometry
- In the Inspector, click Generate Geometry to create meshes per route type (pipe/electrical/cable_tray/conduit).
- Use undo/redo to remove/restore generated geometry and connections.

## Constraints & Obstacles
- Default constraints and obstacle filtering are centralized in the routing utilities.
- You can tweak minimum bend radius, support spacing, and clearances.

## Tips
- Use Edit mode to adjust routes with control points.
- Keep scenes performant by limiting large obstacle counts or reducing pathfinding bounds.

See also: docs/SMART_ROUTING_WORKFLOW.md, docs/SMART_ROUTING_LIMITATIONS.md, docs/SMART_ROUTING_PR_AND_TEST_PLAN.md


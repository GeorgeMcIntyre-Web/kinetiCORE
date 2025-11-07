# Smart Routing System Module

Intelligent infrastructure routing for pipes, electrical wiring, cable trays, and conduits.

## Overview

This module provides a fast and user-friendly system for creating 3D routing models that represent real-world infrastructure. The system intelligently understands connections between items, automatically calculates optimal paths, and allows users to fine-tune the results.

## Architecture

```
routing/
├── core/              # Core data structures and connection management
├── pathfinding/       # A* pathfinding with constraints
├── geometry/          # 3D mesh generation from routes
├── ui/                # React components for routing workflow
└── commands/          # Undo/redo commands
```

## Features

- **Smart Connection Detection** - Auto-detects connection points on devices
- **Automatic Path Optimization** - A* algorithm finds optimal routes
- **Real-world Constraints** - Respects bend radius, clearance, support spacing
- **Multiple Infrastructure Types** - Pipes, cables, cable trays, conduits
- **Visual Feedback** - Real-time preview with constraint validation
- **Easy Editing** - Drag-and-drop control points for path refinement

## Status

🚧 **In Development** - Phase 1: Foundation & Core Types

See [Implementation Plan](../../docs/SMART_ROUTING_IMPLEMENTATION_PLAN.md) for detailed progress.

## Quick Start

```typescript
import { ConnectionManager } from './core/ConnectionManager';
import { RouteOptimizer } from './pathfinding/RouteOptimizer';

// Create connection manager
const connectionManager = ConnectionManager.getInstance();

// Add connection point
const connector = connectionManager.addConnectionPoint({
  type: 'pipe',
  position: new Vector3(0, 0, 0),
  direction: new Vector3(0, 1, 0),
  specifications: { size: '3/4 inch' }
});

// Find optimal route
const optimizer = new RouteOptimizer();
const route = optimizer.findOptimalPath(
  sourceConnector,
  destConnector,
  constraints,
  obstacles
);
```

## Documentation

- [Feature Specification](../../docs/SMART_PIPING_WIRING_CABLE_TRAY_FEATURE.md)
- [Implementation Plan](../../docs/SMART_ROUTING_IMPLEMENTATION_PLAN.md)

## Related

- [Future Features](../../docs/FUTURE_FEATURES.md)
- [Feature Brainstorming](../../FEATURE_IDEAS_BRAINSTORM.md)


# Snapping System Visual Reference

## Overview

The kinetiCORE snapping system uses **smart snap selection** - automatically detecting and choosing the best snap type based on proximity and priority. Each snap type has a **distinct visual preview** (shape + color) so users can instantly identify what they're snapping to.

## Smart Snap Selector

### How It Works

1. **Tries all enabled snap types** when the user moves the mouse
2. **Filters out invalid candidates** (e.g., face snaps with 0.00mm distance - mouse is ON the face, not snapping TO it)
3. **Sorts by distance** (closest first)
4. **Uses priority for tiebreaker** when distances are within 1mm
5. **Shows preview** of the winning snap type

### Priority Order (Higher = Better)

When multiple snap types are equidistant, the system prefers more precise snaps:

1. **Vertex** (1) - Most precise: exact corner points
2. **Midpoint** (2) - Precise: exact middle of edge
3. **Center** (3) - Important: circle/arc centers
4. **Intersection** (4) - Precise: where edges cross
5. **Edge** (5) - Less precise: any point on edge
6. **BBox Corner** (6) - Useful: bounding box corners
7. **Face** (7) - Least precise: any point on surface
8. **Normal** (8) - Orientation-based
9. **Object** (9) - Object-level: entire object center

## Snap Type Visual Guide

### 1. Vertex Snap
- **Shape**: Diamond (45° rotated cube)
- **Color**: Gold/Yellow (`#FFD700`)
- **When Used**: Snapping to exact corner/vertex points of meshes
- **Example**: Corner of a box, vertex of a polyhedron
- **Preview**: Small yellow diamond at the vertex

### 2. Edge Snap
- **Shape**: Cylinder (short, flat)
- **Color**: Cyan (`#00FFFF`)
- **When Used**: Snapping to any point along an edge
- **Example**: Midway along the side of a box
- **Preview**: Cyan cylinder at the snap point

### 3. Face Snap
- **Shape**: Square (thin box)
- **Color**: Green (`#00FF00`)
- **When Used**: Snapping to points on flat surfaces
- **Example**: Center of a box face, point on a plane
- **Preview**: Thin green square at the snap point
- **Note**: Filtered out when distance is 0.00mm (mouse already on face)

### 4. Midpoint Snap
- **Shape**: Sphere + Line
- **Color**: Orange (`#FF8000`)
- **When Used**: Snapping to the exact middle of edges
- **Example**: Halfway along a box edge
- **Preview**: Orange sphere at midpoint + orange line showing the full edge

### 5. Center Snap
- **Shape**: Sphere + Ring
- **Color**: Orange (`#FF8000`)
- **When Used**: Snapping to centers of circular features
- **Example**: Center of a cylinder, center of a circular arc
- **Preview**: Orange sphere at center + orange ring around the detected circle perimeter

### 6. Intersection Snap
- **Shape**: X (two crossed bars)
- **Color**: Magenta (`#FF00FF`)
- **When Used**: Snapping to points where edges cross
- **Example**: Intersection of two diagonal edges
- **Preview**: Magenta X at the intersection point

### 7. Normal Snap
- **Shape**: Cone/Arrow (pointing up)
- **Color**: Blue (`#0080FF`)
- **When Used**: Snapping perpendicular to surface normals
- **Example**: Aligning objects perpendicular to a surface
- **Preview**: Blue cone at the snap point

### 8. BBox Corner Snap
- **Shape**: Cube
- **Color**: Light Gray/White (`#CCCCCC`)
- **When Used**: Snapping to bounding box corners
- **Example**: Corner of an object's invisible bounding box
- **Preview**: Light gray cube at the corner

### 9. Object Snap
- **Shape**: Sphere (larger than others)
- **Color**: Purple (`#CC00CC`)
- **When Used**: Snapping to the center of entire objects
- **Example**: Center of mass, object pivot point
- **Preview**: Large purple sphere at object center

### 10. Grid Snap *(Optional)*
- **When Used**: Snapping to regular grid points
- **Toggleable**: Can be enabled/disabled independently in settings
- **Note**: Works alongside smart selector

## Visual Summary Table

| Snap Type    | Shape            | Color        | Size   | Use Case                    |
|--------------|------------------|--------------|--------|-----------------------------|
| Vertex       | Diamond (cube)   | Yellow       | Normal | Exact corners/vertices      |
| Edge         | Cylinder         | Cyan         | Normal | Points along edges          |
| Face         | Square (thin)    | Green        | Normal | Points on surfaces          |
| Midpoint     | Sphere + Line    | Orange       | Normal | Exact edge midpoints        |
| Center       | Sphere + Ring    | Orange       | Normal | Circle centers              |
| Intersection | X (crossed bars) | Magenta      | Normal | Edge intersections          |
| Normal       | Cone/Arrow       | Blue         | Normal | Surface perpendiculars      |
| BBox Corner  | Cube             | Light Gray   | Normal | Bounding box corners        |
| Object       | Sphere           | Purple       | Large  | Object centers              |
| Default      | Sphere           | Gray         | Normal | Fallback (rare)             |

## User Workflow

### Quick Identification

Users can **instantly identify the snap type** by:
1. **Shape** - Each snap has a unique geometric form
2. **Color** - Color-coded for quick recognition
3. **Additional Elements** - Rings (center), lines (midpoint), X (intersection)

### No Manual Switching Required

The smart selector **automatically picks the best snap** based on:
- **Distance**: Closest snap wins
- **Priority**: Tie-breaker for equal distances (vertex > midpoint > center > ...)
- **Context**: Filters out invalid snaps (e.g., face with 0mm distance)

Users simply **move the mouse** and the system shows which snap will activate.

## Settings

### Minimal UI

The simplified settings panel shows:
- ✅ **Enable snapping** - Master toggle
- ✅ **Smart Snap Selector** - Explanation text (all snap types enabled automatically)
- ✅ **Enable grid snapping** - Optional grid toggle
- ✅ **Grid size** - Grid spacing (default: 100mm)

### Advanced (Hidden)

Power users can still disable individual snap types via the store if needed:
```typescript
const { setSnapToVertex, setSnapToEdge, ... } = useEditorStore();
```

But 99% of users will never need this - the smart selector handles everything.

## Technical Details

### Screen-Space vs World-Space

- **Preview Mode**: 12px screen-space threshold (consistent visual feedback at any zoom)
- **Actual Snap**: 0.1mm world-space threshold (CAD precision)

### Edge Deduplication

Shared edges (between faces) are detected once and deduplicated using:
```
Set<"meshId:minIdx-maxIdx">
```

~50% performance improvement by avoiding duplicate edge processing.

### Circle Fitting

Center snaps use MAX radius (not average) to ensure the ring encompasses all detected vertices.

### Glow Layer

All preview shapes use `BABYLON.GlowLayer` with:
- **Intensity 2.0**: Normal snaps
- **Intensity 3.0**: Snaps on selected meshes (brighter highlight)

## Testing Checklist

- [ ] **Vertex Snap**: Yellow diamond appears at box corners
- [ ] **Edge Snap**: Cyan cylinder appears along box edges (not at midpoint)
- [ ] **Face Snap**: Green square appears on box faces (only when near, not ON)
- [ ] **Midpoint Snap**: Orange sphere + line at edge midpoints
- [ ] **Center Snap**: Orange sphere + ring at cylinder centers
- [ ] **Intersection Snap**: Magenta X where edges cross
- [ ] **Normal Snap**: Blue cone for surface normals
- [ ] **BBox Corner Snap**: Light gray cube at bounding box corners
- [ ] **Object Snap**: Large purple sphere at object centers
- [ ] **Smart Selection**: Closest snap type wins automatically
- [ ] **Priority Tiebreaker**: Vertex preferred over edge when equidistant
- [ ] **Face Filtering**: Face snaps don't trigger when mouse is exactly on face
- [ ] **Glow Effect**: All previews have visible glow
- [ ] **Selected Mesh**: Brighter glow (intensity 3.0) on selected meshes

## Known Limitations

- **Advanced Snap Types** (perpendicular, tangent, surface, plane, axis, curve): Not yet implemented with screen-space support
- **Face Snap Filtering**: Currently filters out faces with <0.1mm distance - may need tuning
- **Performance**: With 50+ objects, snap detection may slow down (future optimization: spatial partitioning)

## Future Enhancements

- [ ] Snap history (remember last used snap type)
- [ ] Snap constraints (snap only to X/Y/Z aligned features)
- [ ] Multi-snap preview (show top 3 snap candidates)
- [ ] Snap tolerance adjustment (UI slider for snap distance)
- [ ] Per-object snap exclusion (ignore certain meshes)

---

**Last Updated**: 2025-11-08
**Owner**: George (Agent 1 - Claude Code)
**Related Files**:
- `src/manipulation/SnappingHelper.ts` - Core snapping logic
- `src/ui/components/FloatingSettingsPanel.tsx` - Settings UI
- `src/ui/store/editorStore.ts` - Snap state management

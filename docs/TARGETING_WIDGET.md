# Targeting Widget

Visual feedback system for object picking and point selection.

## Overview

The `TargetingWidget` provides animated visual feedback when users click on objects in the 3D scene. It displays a crosshair-style reticle with a pulse animation at the pick point, oriented to the surface normal.

## Features

- **Crosshair Reticle**: Four lines forming a targeting crosshair
- **Center Dot**: Small sphere at the exact pick point
- **Pulse Ring**: Animated torus that expands and fades out
- **Surface Alignment**: Automatically orients to surface normal
- **Auto-Dismiss**: Fades out after configurable duration (default 500ms)

## Visual Design

```
     |
  ---•---  <- Crosshair reticle
     |
   (( ))   <- Expanding pulse ring
```

- **Color**: Cyan (0, 1, 1) by default
- **Size**: 0.1 units (10cm) by default
- **Always on top**: Renders in group 3 to appear above other objects

## Usage

### Basic Usage

```typescript
import { SceneManager } from './scene/SceneManager';

const sceneManager = SceneManager.getInstance();

// Show at pick point
sceneManager.showTargetingWidget(pickPoint);

// Show with surface normal alignment
sceneManager.showTargetingWidget(pickPoint, surfaceNormal);
```

### Custom Configuration

```typescript
import { TargetingWidget } from './scene/TargetingWidget';

const widget = new TargetingWidget(scene, {
  size: 0.15,                              // Larger reticle
  color: new BABYLON.Color3(1, 0, 0),      // Red color
  duration: 1000,                           // 1 second animation
  showPulse: true                           // Enable pulse animation
});

widget.show(position, normal);
```

## Integration Points

The targeting widget is automatically shown when:

1. **Object Selection**: User clicks on any selectable object
2. **Point Pick Mode**: User picks a point in point pick mode
3. **Alignment Mode**: User clicks during alignment operations
4. **Frame Creation**: User picks points for custom frames

## Animation Details

### Timeline (500ms default)

- **0-350ms** (0-70%): Reticle visible, pulse ring expands
- **350-500ms** (70-100%): Fade out begins
- **500ms**: Widget auto-disposes

### Pulse Ring Animation

- Scale: 1x → 3x (expands)
- Alpha: 0.8 → 0 (fades out)

### Reticle Animation

- Scale: 1x (constant)
- Alpha: 1.0 → 0 (fades out after 70%)

## Performance

- **Non-pickable**: Does not interfere with raycasting
- **Rendering group 3**: Always renders on top
- **Auto-cleanup**: Disposes all resources when hidden
- **Lightweight**: Minimal polygon count (< 100 triangles)

## File Structure

```
src/scene/
├── TargetingWidget.ts          # Main widget class
└── SceneManager.ts             # Integration point
```

## API Reference

### TargetingWidget Class

#### Constructor

```typescript
constructor(scene: BABYLON.Scene, options?: TargetingWidgetOptions)
```

#### Methods

- `show(position: Vector3, normal?: Vector3)`: Display widget at position
- `hide()`: Hide and dispose widget
- `isVisible()`: Check if currently visible
- `dispose()`: Clean up all resources

#### Options

```typescript
interface TargetingWidgetOptions {
  size?: number;           // Default: 0.1
  color?: Color3;          // Default: cyan (0, 1, 1)
  duration?: number;       // Default: 500ms
  showPulse?: boolean;     // Default: true
}
```

## Future Enhancements

- [ ] Sound effect on pick
- [ ] Different styles (circle, square, diamond)
- [ ] Color based on pick result (success/fail)
- [ ] Configurable animation curves
- [ ] Multiple simultaneous targets
- [ ] Persistent targets with labels

## Examples

### Simple Pick Feedback

```typescript
scene.onPointerDown = (evt, pickResult) => {
  if (pickResult.hit && pickResult.pickedPoint) {
    sceneManager.showTargetingWidget(pickResult.pickedPoint);
  }
};
```

### With Normal Alignment

```typescript
if (pickResult.hit && pickResult.pickedPoint) {
  const normal = pickResult.getNormal(true);
  sceneManager.showTargetingWidget(pickResult.pickedPoint, normal);
}
```

### Custom Red Target

```typescript
const redTarget = new TargetingWidget(scene, {
  color: new BABYLON.Color3(1, 0, 0),
  size: 0.2,
  duration: 1000
});

redTarget.show(errorPosition);
```

## Notes

- Widget automatically disposes after animation completes
- Multiple show() calls will dispose previous widget
- Widget is non-interactive (isPickable = false)
- Rendering group 3 ensures visibility over all scene objects

## Owner

George (Claude Code)

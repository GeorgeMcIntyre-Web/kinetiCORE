# kinetiCORE Artifacts - 3D Viewer for Claude Antigravity

This directory contains standalone HTML artifacts that run 3D models in Claude's Artifacts (antigravity) Chrome environment.

## Files

### `standalone-3d-viewer.html`
A self-contained 3D viewer built with Babylon.js CDN. No build process required.

**Features:**
- ✅ Runs in Claude Artifacts / Chrome sandbox
- ✅ Babylon.js loaded from CDN (no local dependencies)
- ✅ Interactive 3D camera controls (orbit, zoom, pan)
- ✅ Built-in demo model (robot arm placeholder)
- ✅ Wireframe toggle
- ✅ Grid floor with industrial styling
- ✅ GLB/GLTF model loading capability

**Usage:**

1. **Open directly in browser:**
   ```bash
   # Navigate to the file
   start artifacts/standalone-3d-viewer.html
   ```

2. **Use in Claude Artifacts:**
   - Copy the entire HTML file content
   - Paste into Claude conversation
   - Ask Claude to render it as an artifact
   - The 3D viewer will load in the Artifacts preview pane

3. **Load your own models:**
   ```javascript
   // In browser console
   window.loadGLBModel('https://your-url.com/model.glb');
   ```

## Architecture Notes

### Why Standalone HTML?

Claude Artifacts / antigravity environment has these constraints:
- **No build process** - Must be pure HTML/CSS/JS
- **No Node.js modules** - Cannot use npm packages directly
- **No local file system** - Must use CDN or embedded code
- **Sandboxed Chrome** - Limited API access

### Solution: CDN-Based Approach

We use Babylon.js from CDN:
```html
<script src="https://cdn.babylonjs.com/babylon.js"></script>
<script src="https://cdn.babylonjs.com/loaders/babylonjs.loaders.min.js"></script>
<script src="https://cdn.babylonjs.com/materialsLibrary/babylonjs.materials.min.js"></script>
```

This gives us:
- ✅ Full Babylon.js 3D engine
- ✅ GLB/GLTF loader
- ✅ Material library (GridMaterial for floor)
- ✅ Zero dependencies
- ✅ Works in any Chrome environment

### Coordinate System

The artifact uses **Y-up** (Babylon.js default):
- X-axis: Right
- Y-axis: Up
- Z-axis: Forward
- Left-handed coordinate system

This matches kinetiCORE's standard (see `docs/COORDINATE_SYSTEM.md`).

## Development Workflow

### Testing Locally

```bash
# Serve with any HTTP server
npx http-server artifacts -p 8080

# Or use VS Code Live Server extension
# Right-click standalone-3d-viewer.html -> "Open with Live Server"
```

### Creating New Artifacts

1. Copy `standalone-3d-viewer.html` as template
2. Modify the demo model or add custom features
3. Keep all dependencies as CDN links
4. Test in regular Chrome first
5. Test in Claude Artifacts

### Adding External Models

**Public URLs:**
```javascript
window.loadGLBModel('https://example.com/model.glb');
```

**Embedded Models (Base64):**
For small models, you can embed them as data URLs:
```javascript
const dataUrl = 'data:model/gltf-binary;base64,AAAAAA...';
window.loadGLBModel(dataUrl);
```

## Integration with Main kinetiCORE App

The artifacts are **separate from** the main kinetiCORE application:

| Feature | Main App | Artifact |
|---------|----------|----------|
| Build process | Vite + TypeScript | None (pure HTML) |
| Dependencies | npm packages | CDN only |
| React | Yes | No |
| Physics | Rapier | Not included |
| Kinematics | Full system | Viewer only |
| Target | Production | Demos/Claude |

**Use cases for artifacts:**
- Quick 3D demos in Claude conversations
- Client presentations without deployment
- Educational examples
- Rapid prototyping
- Testing 3D concepts

**Use main app for:**
- Full kinematics simulation
- Physics integration
- Production workflows
- Asset management
- Advanced features

## Example: Claude Conversation

```
User: "Show me a 3D robot arm in an artifact"

Claude: "I'll create a 3D viewer with a robot arm using Babylon.js..."
[Generates artifact from standalone-3d-viewer.html]

User: "Can you make it spin?"

Claude: [Modifies script to add rotation animation]
```

## Troubleshooting

### Artifact doesn't load in Claude
- Ensure no external file references (everything must be inline or CDN)
- Check browser console for errors
- Verify CDN links are accessible

### Model doesn't appear
- Check browser console for loading errors
- Verify GLB URL is publicly accessible
- Check CORS headers on model server

### Poor performance
- Reduce model complexity
- Enable LOD (Level of Detail)
- Optimize textures
- Limit mesh count

## Future Enhancements

Potential additions:
- [ ] Texture upload support
- [ ] Animation playback
- [ ] Measurement tools
- [ ] Screenshot export
- [ ] VR/AR mode (WebXR)
- [ ] Collaboration features
- [ ] Cloud model hosting integration

## References

- **Babylon.js CDN Docs:** https://doc.babylonjs.com/setup/frameworkPackages/CDN
- **Claude Artifacts Guide:** https://support.anthropic.com/en/articles/9487310-what-are-artifacts-and-how-do-i-use-them
- **kinetiCORE Coordinate System:** `../docs/COORDINATE_SYSTEM.md`
- **Main App Architecture:** `../docs/architecture.md`

---

**Owner:** George (Claude Code Agent 1)
**Created:** 2025-11-28
**Last Updated:** 2025-11-28

# How to Use kinetiCORE 3D Viewer in Claude Artifacts

Quick guide for running kinetiCORE 3D models in Claude's antigravity environment.

## Method 1: Direct Copy-Paste (Easiest)

1. **Open the HTML file:**
   ```
   artifacts/standalone-3d-viewer.html
   ```

2. **Copy the entire file content** (Ctrl+A, Ctrl+C)

3. **In Claude conversation, say:**
   ```
   Create an artifact using this HTML code:
   [Paste the HTML here]
   ```

4. **Claude will render it** in the Artifacts preview pane

5. **Interact with the 3D viewer:**
   - Click "Load Demo" to see robot arm
   - Drag to rotate camera
   - Scroll to zoom
   - Right-click drag to pan

## Method 2: Ask Claude to Generate It

**Prompt Claude with:**

```
Create a 3D viewer artifact for kinetiCORE using Babylon.js from CDN.
It should have:
- A 3D canvas with orbit camera
- Grid floor
- Demo robot arm geometry
- Controls to load models, reset view, and toggle wireframe
- Modern dark UI with cyan accents
- Make it work in the antigravity Chrome sandbox
```

Claude will generate the artifact based on `standalone-3d-viewer.html` template.

## Method 3: Load External Models

Once the artifact is running, you can load your own GLB models:

**Public URL:**
```javascript
// In browser console or Claude can add this
window.loadGLBModel('https://example.com/your-model.glb');
```

**Example with kinetiCORE tooling fixtures:**
```javascript
// If you have a public URL to 9X_110_GEO.glb
window.loadGLBModel('https://your-server.com/9X_110_GEO.glb');
```

## Method 4: Embed in Claude Response

Ask Claude to create custom 3D demonstrations:

**Example prompts:**

1. **"Show me a 3D robot arm with 6 joints"**
   → Claude generates artifact with kinematic chain

2. **"Create a 3D tooling fixture viewer"**
   → Claude generates viewer with industrial styling

3. **"Animate a valve opening/closing"**
   → Claude adds animation loop to the artifact

## Customization Examples

### Change Colors

Ask Claude:
```
Modify the artifact to use orange accents instead of cyan,
and change the background to dark gray
```

### Add Animation

Ask Claude:
```
Make the robot arm rotate continuously around the base
```

### Load Multiple Models

Ask Claude:
```
Create buttons to switch between 3 different models:
- Robot arm
- Valve assembly
- Conveyor system
```

## Advanced: Integrating kinetiCORE Features

### Add Kinematics

```javascript
// Example: Simple FK solver in the artifact
function updateJoint(jointIndex, angle) {
    // Rotate specific mesh
    const joint = scene.getMeshByName(`joint_${jointIndex}`);
    if (joint) {
        joint.rotation.y = angle;
    }
}
```

### Add Measurements

```javascript
// Add distance measurement
function measureDistance(mesh1, mesh2) {
    const dist = BABYLON.Vector3.Distance(
        mesh1.position,
        mesh2.position
    );
    updateStatus(`Distance: ${dist.toFixed(2)}m`);
}
```

### Add Physics (Lightweight)

```javascript
// Simple collision detection (no Rapier needed)
scene.onPointerDown = (evt, pickResult) => {
    if (pickResult.hit) {
        updateStatus(`Clicked: ${pickResult.pickedMesh.name}`);
    }
};
```

## Limitations vs. Full kinetiCORE App

| Feature | Artifact | Main App |
|---------|----------|----------|
| 3D Rendering | ✅ Full | ✅ Full |
| Model Loading | ✅ GLB/GLTF | ✅ All formats |
| Camera Controls | ✅ Orbit | ✅ Multi-mode |
| Kinematics | ⚠️ Manual | ✅ Auto-detect |
| Physics | ❌ No Rapier | ✅ Full Rapier |
| React UI | ❌ Vanilla JS | ✅ React + Zustand |
| TypeScript | ❌ Plain JS | ✅ Strict mode |
| Build Process | ❌ None | ✅ Vite |
| File System | ❌ Limited | ✅ Full access |

## When to Use Each

**Use Artifacts for:**
- Quick demos in Claude conversations
- Client presentations
- Educational examples
- Proof of concepts
- Testing 3D ideas

**Use Main App for:**
- Production workflows
- Complex simulations
- Multi-user collaboration
- Asset management
- Full feature set

## Troubleshooting

### Artifact won't load
- **Check console** for errors (F12)
- **Verify CDN access** - antigravity might block some CDNs
- **Simplify code** - remove advanced features

### Performance issues
- **Reduce geometry** - demo model has ~100 vertices
- **Disable shadows** - comment out `ground.receiveShadows = true`
- **Lower resolution** - adjust canvas size

### Model won't load
- **Check CORS** - server must allow cross-origin requests
- **Verify URL** - must be publicly accessible
- **Test locally first** - open HTML file directly in Chrome

## Example Claude Conversation

```
User: "I want to demo a robot arm in 3D"

Claude: "I'll create a 3D viewer artifact for you..."
[Generates standalone-3d-viewer.html as artifact]

User: "Make the arm move"

Claude: [Modifies script to add rotation animation]

User: "Can I load my own GLB file?"

Claude: "Yes, use this in the browser console:
window.loadGLBModel('your-url-here.glb')"

User: "Perfect! Can you add measurement tools?"

Claude: [Adds distance measurement feature]
```

## Next Steps

1. **Test the artifact** - Open `standalone-3d-viewer.html` in Chrome
2. **Customize it** - Ask Claude to modify for your needs
3. **Share with team** - Send the HTML file or Claude link
4. **Integrate learnings** - Apply concepts back to main kinetiCORE app

## Resources

- **Babylon.js Playground:** https://playground.babylonjs.com
- **Claude Artifacts Docs:** https://support.anthropic.com/en/articles/9487310
- **kinetiCORE Docs:** `../docs/`
- **Main App:** https://kinetic-core.com

---

**Questions?** Ask Claude or check `artifacts/README.md` for technical details.

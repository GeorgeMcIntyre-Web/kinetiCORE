# Claude Artifacts - 3D Viewer Quickstart

Run kinetiCORE 3D models in Claude's Artifacts environment in under 2 minutes.

## What Are Artifacts?

Claude Artifacts (antigravity) is a sandboxed Chrome environment where Claude can render interactive HTML/CSS/JS directly in the conversation. Perfect for 3D demos and prototypes.

## Quick Start

### Option 1: Copy-Paste (30 seconds)

1. Open `artifacts/standalone-3d-viewer.html`
2. Copy all content (Ctrl+A, Ctrl+C)
3. In Claude chat: "Create an artifact with this code: [paste]"
4. Done! ✅

### Option 2: Ask Claude (1 minute)

**Prompt:**
```
Create a 3D viewer artifact using Babylon.js from CDN.
Include orbit camera, grid floor, and a demo robot arm.
Use the kinetiCORE dark theme with cyan accents.
```

Claude will generate the artifact for you.

### Option 3: Test Locally First

```bash
# Serve locally
cd artifacts
npx http-server -p 8080

# Open http://localhost:8080/standalone-3d-viewer.html
```

## Features

✅ **Interactive 3D camera** - Orbit, zoom, pan
✅ **Demo robot arm** - Click "Load Demo"
✅ **GLB model loading** - Load your own models
✅ **Wireframe mode** - Toggle for CAD view
✅ **Zero dependencies** - Uses Babylon.js CDN
✅ **Chrome sandbox safe** - Works in antigravity

## Load Your Models

Once running in artifact:

```javascript
// Browser console or ask Claude to add this
window.loadGLBModel('https://example.com/your-model.glb');
```

**Example with kinetiCORE fixtures:**
```javascript
// Load 9X-110 tooling fixture (if publicly hosted)
window.loadGLBModel('https://your-cdn.com/9X_110_GEO.glb');
```

## Common Use Cases

### 1. Client Demo
"Show me the tooling fixture in 3D"
→ Load GLB in artifact, rotate to show features

### 2. Education
"Explain how a robot arm works"
→ Generate animated artifact with labeled joints

### 3. Validation
"Verify this assembly looks correct"
→ Load model, inspect from all angles

### 4. Iteration
"Try different colors for the parts"
→ Claude modifies materials in real-time

## Example Conversation

```
You: Create a 3D viewer artifact for kinetiCORE

Claude: [Generates standalone-3d-viewer.html as artifact]

You: Load a robot arm and make it rotate

Claude: [Adds rotation animation]

You: Change the arm color to orange

Claude: [Modifies material.diffuseColor]

You: Perfect! Can I load my own GLB?

Claude: Yes, use: window.loadGLBModel('url')
```

## Customization Ideas

Ask Claude to:
- **Add animations:** "Make the arm wave"
- **Change colors:** "Use company brand colors"
- **Add measurements:** "Show distance between joints"
- **Multiple models:** "Add 3 models with tabs to switch"
- **Export screenshot:** "Add a download button"

## Artifacts vs. Main App

| Feature | Artifact | Main kinetiCORE |
|---------|----------|-----------------|
| Setup | Instant | `npm install` |
| Dependencies | CDN only | 87 packages |
| Build | None | Vite + TS |
| Kinematics | Manual | Auto-detect |
| Physics | No | Rapier 3D |
| Production | Demos only | Full workflows |

**Use artifacts for:** Quick demos, education, prototypes
**Use main app for:** Production, simulation, collaboration

## Troubleshooting

**Artifact won't load?**
- Check browser console (F12)
- Verify CDN access
- Try simpler version

**Poor performance?**
- Reduce model complexity
- Disable shadows
- Lower canvas resolution

**Model won't load?**
- Check CORS headers
- Verify public URL
- Test in main app first

## Files Reference

```
artifacts/
├── standalone-3d-viewer.html    # Main artifact (copy this)
├── README.md                     # Technical docs
└── CLAUDE_USAGE_GUIDE.md        # Detailed guide
```

## Next Steps

1. ✅ **Try it now** - Copy HTML to Claude
2. 📝 **Customize** - Ask Claude to modify
3. 🚀 **Share** - Send artifact link to team
4. 🔄 **Iterate** - Rapid 3D prototyping

## Resources

- **Artifacts Directory:** `artifacts/`
- **Usage Guide:** `artifacts/CLAUDE_USAGE_GUIDE.md`
- **Technical Docs:** `artifacts/README.md`
- **Babylon.js Docs:** https://doc.babylonjs.com
- **Claude Artifacts:** https://support.anthropic.com/en/articles/9487310

---

**Pro Tip:** Save useful artifact variations in `artifacts/` for quick reuse.

**Created:** 2025-11-28 | **Owner:** George (Agent 1)

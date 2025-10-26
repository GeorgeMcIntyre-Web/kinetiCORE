# kinetiCORE URL Parameters

This document lists all supported URL query parameters for kinetiCORE.

## Debug & Performance

### `?perf=true`
**Enable Performance Monitor**

Displays real-time performance metrics overlay including:
- FPS (frames per second)
- Frame time (ms)
- Memory usage (MB)
- Draw calls
- Entity count
- Physics bodies count
- Triangle count

**Usage:**
```
https://kinetic-core.com?perf=true
http://localhost:5173?perf=true
```

**UI Location:** Top-right corner of viewport

**Controls:**
- Click header to expand/collapse
- Click "Clear" to reset statistics
- Click "Export" to download performance data as JSON

---

### `?debug=true`
**Enable Debug Mode**

Enables all debug features including performance monitor and additional console logging.

**Usage:**
```
https://kinetic-core.com?debug=true
http://localhost:5173?debug=true
```

**Features Enabled:**
- Performance monitor (same as `?perf=true`)
- Verbose console logging
- Debug overlays

---

## Development

### Auto-Enabled in Dev Mode

The following features are automatically enabled when running `npm run dev`:
- Performance monitor
- Hot module replacement (HMR)
- Source maps
- Console logging

---

## Examples

### Production with Performance Monitor
```
https://kinetic-core.com?perf=true
```

### Production with Full Debug
```
https://kinetic-core.com?debug=true
```

### Multiple Parameters
```
https://kinetic-core.com?perf=true&debug=true
```

---

## Version Information

Version display is always visible in the bottom-right corner:
- **Format:** `kinetiCORE vX.Y.Z`
- **Location:** Bottom-right corner (footer)
- **Build Info:** Git commit hash and build timestamp (visible in source)

To view full build info programmatically:
```typescript
import { useVersion } from '@ui/components/VersionDisplay';

const { version, buildTime, gitCommit, isDev } = useVersion();
console.log(`Version: ${version}, Build: ${buildTime}, Commit: ${gitCommit}`);
```

---

## Future Parameters (Planned)

### `?theme=dark|light`
Switch between dark and light themes (not yet implemented)

### `?layout=essential|professional|expert`
Override default layout mode (not yet implemented)

### `?lang=en|es|fr|de|zh`
Set UI language (not yet implemented)

---

**Last Updated:** 2025-10-26
**Maintainer:** George McIntyre (Agent 1)

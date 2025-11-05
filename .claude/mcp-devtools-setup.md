# Chrome MCP DevTools - Persistent Setup

## Purpose
This configuration enables Claude Code to control Chrome DevTools programmatically for:
- Taking screenshots
- Running JavaScript in browser console
- Checking for errors
- Profiling performance

## Configuration Location

**Cursor Settings File:**
```
%APPDATA%\Cursor\User\settings.json
```

**Required Configuration:**
```json
{
  "mcpServers": {
    "chrome-devtools": {
      "command": "npx",
      "args": ["chrome-devtools-mcp@latest"]
    }
  }
}
```

## Usage Workflow

### Step 1: Start Chrome with Debugging
```bash
.\scripts\start-chrome-debug.bat
```

This launches Chrome with:
- Remote debugging on port 9222
- Temporary profile for safety
- Automatically opens http://localhost:5173

### Step 2: Start Dev Server (if not running)
```bash
npm run dev
```

### Step 3: Restart Cursor
After adding MCP configuration, restart Cursor to load the new settings.

### Step 4: Ask Claude Code to Use DevTools
Example prompts:
- "Take a screenshot of the warehouse"
- "Check the browser console for errors"
- "Run JavaScript to test the mezzanine columns"
- "Profile the warehouse performance"

## Standard Completion Workflow

**For Future Claude Code Sessions:**

1. ✅ **Always check** if Chrome debugging is needed for visual tasks
2. ✅ **Remind user** to run `.\scripts\start-chrome-debug.bat` if needed
3. ✅ **Use MCP DevTools** for:
   - Visual verification (screenshots)
   - Console error checking
   - Performance profiling
   - JavaScript debugging
4. ✅ **Document findings** with screenshots when applicable

## Security Notes

⚠️ **Important:**
- Only enable remote debugging during development
- Do not browse sensitive sites with debugging enabled
- Close Chrome when done testing
- Use temporary profile (automatic with script)

## Verification

**Check if MCP is working:**
1. Cursor should show MCP servers in settings
2. Ask Claude: "Take a screenshot"
3. Claude should be able to connect to Chrome on port 9222

**Check if Chrome debugging is active:**
```
http://localhost:9222/json
```
Should return JSON with Chrome tab information.

## Troubleshooting

**MCP not working:**
- Restart Cursor after adding configuration
- Verify JSON syntax in settings.json
- Check Cursor's MCP logs

**Chrome won't start:**
- Close all Chrome instances first
- Check if port 9222 is in use: `netstat -an | findstr 9222`
- Try different port: `--remote-debugging-port=9223`

**Connection fails:**
- Ensure Chrome is running with debugging enabled
- Verify dev server is running
- Check firewall settings

## References

- **Setup Guide:** `docs/MCP_CHROME_DEVTOOLS_SETUP.md`
- **Testing Guide:** `docs/TESTING_WITH_MCP_DEVTOOLS.md`
- **Launch Script:** `scripts/start-chrome-debug.bat`

---

**Last Updated:** 2025-11-04
**Status:** ✅ Configured and tested

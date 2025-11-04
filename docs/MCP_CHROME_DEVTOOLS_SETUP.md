# MCP Chrome DevTools Setup Guide

Complete setup instructions for configuring Chrome DevTools MCP server in Cursor IDE.

---

## 📋 Prerequisites

- **Node.js**: Version 20.19 or newer
- **Chrome Browser**: Latest stable version
- **npm**: Node package manager
- **Cursor IDE**: With MCP support enabled

---

## 🔧 Step-by-Step Setup

### Step 1: Configure MCP Server in Cursor

The MCP server configuration is stored in Cursor's settings file, **not in the repository**.

#### Option A: Edit Settings File Directly

**Windows:**
```
%APPDATA%\Cursor\User\settings.json
```

**macOS:**
```
~/Library/Application Support/Cursor/User/settings.json
```

**Linux:**
```
~/.config/Cursor/User/settings.json
```

Add this configuration to your settings file:

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

#### Option B: Use Cursor Settings UI

1. Open Cursor Settings (Ctrl+, or Cmd+,)
2. Search for "MCP Servers" or "Model Context Protocol"
3. Add a new MCP server:
   - **Name**: `chrome-devtools`
   - **Command**: `npx`
   - **Args**: `["chrome-devtools-mcp@latest"]`

### Step 2: Start Chrome with Remote Debugging

You must launch Chrome with the remote debugging port enabled. This allows the MCP server to connect to Chrome.

#### Windows

```bash
"C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222 --user-data-dir="%TEMP%\chrome-profile-stable"
```

#### macOS

```bash
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222 --user-data-dir=/tmp/chrome-profile-stable
```

#### Linux

```bash
/usr/bin/google-chrome --remote-debugging-port=9222 --user-data-dir=/tmp/chrome-profile-stable
```

#### Create a Startup Script (Optional)

You can create a script to make this easier:

**Windows** (`start-chrome-debug.bat`):
```batch
@echo off
start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222 --user-data-dir="%TEMP%\chrome-profile-stable"
```

**macOS/Linux** (`start-chrome-debug.sh`):
```bash
#!/bin/bash
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222 --user-data-dir=/tmp/chrome-profile-stable
```

Make it executable:
```bash
chmod +x start-chrome-debug.sh
```

### Step 3: Start Your Dev Server

```bash
npm run dev
```

Your application will be available at `http://localhost:5173`

### Step 4: Verify Setup

1. **Restart Cursor** after adding the MCP configuration
2. Open a chat with the AI assistant in Cursor
3. The MCP Chrome DevTools commands should now be available

You can test by asking the AI to:
- Take a screenshot of the current page
- Run JavaScript in the console
- Check network requests

---

## 🛠️ Available MCP Commands

Once configured, these commands are available in Cursor chat:

| Command | Description |
|---------|-------------|
| `mcp__chrome-devtools__console` | Run JavaScript in browser console |
| `mcp__chrome-devtools__screenshot` | Capture screenshots of the current page |
| `mcp__chrome-devtools__network` | Monitor and analyze network requests |
| `mcp__chrome-devtools__performance` | Profile performance and measure metrics |

---

## ⚙️ Advanced Configuration

### Custom Chrome Executable Path

If Chrome is installed in a non-standard location:

```json
{
  "mcpServers": {
    "chrome-devtools": {
      "command": "npx",
      "args": ["chrome-devtools-mcp@latest", "--executablePath", "/path/to/chrome"]
    }
  }
}
```

### Headless Mode

Run Chrome in headless mode (no GUI):

```json
{
  "mcpServers": {
    "chrome-devtools": {
      "command": "npx",
      "args": ["chrome-devtools-mcp@latest", "--headless"]
    }
  }
}
```

### Use Chrome Canary

Use Chrome Canary instead of stable:

```json
{
  "mcpServers": {
    "chrome-devtools": {
      "command": "npx",
      "args": ["chrome-devtools-mcp@latest", "--channel", "canary"]
    }
  }
}
```

### Isolated Profile

Use a temporary profile that's cleaned up after closing:

```json
{
  "mcpServers": {
    "chrome-devtools": {
      "command": "npx",
      "args": ["chrome-devtools-mcp@latest", "--isolated"]
    }
  }
}
```

### Port Forwarding

Connect to a remote Chrome instance:

```json
{
  "mcpServers": {
    "chrome-devtools": {
      "command": "npx",
      "args": ["chrome-devtools-mcp@latest", "--browserUrl", "http://localhost:9222"]
    }
  }
}
```

---

## 🔒 Security Considerations

⚠️ **Important Security Warning:**

Enabling the remote debugging port (`--remote-debugging-port=9222`) opens a debugging interface that **any application on your machine can connect to**. This means:

- **Do NOT browse sensitive websites** (banking, email, etc.) while remote debugging is enabled
- **Close Chrome** when you're done testing
- **Only enable remote debugging** when you need to use MCP DevTools
- Consider using a separate Chrome profile for debugging

---

## 🐛 Troubleshooting

### MCP Commands Not Available

1. **Restart Cursor** after adding MCP configuration
2. Check that Chrome is running with `--remote-debugging-port=9222`
3. Verify the settings file path is correct
4. Check Cursor's MCP logs for errors

### Chrome Won't Start with Remote Debugging

- Make sure Chrome is completely closed before starting
- Check if port 9222 is already in use: `netstat -an | grep 9222`
- Try a different port: `--remote-debugging-port=9223`

### MCP Server Connection Failed

- Verify Chrome is running with remote debugging enabled
- Check that the dev server is running (`npm run dev`)
- Try accessing `http://localhost:9222/json` in a browser to verify Chrome's debugging interface is active

### Permission Errors (macOS/Linux)

- Make sure the Chrome executable has execute permissions
- Try using the full path to Chrome

---

## 📚 Additional Resources

- **Official Chrome DevTools MCP**: https://github.com/ChromeDevTools/chrome-devtools-mcp
- **npm Package**: https://www.npmjs.com/package/chrome-devtools-mcp
- **Chrome DevTools Protocol**: https://chromedevtools.github.io/devtools-protocol/
- **Cursor MCP Documentation**: Check Cursor's official documentation for MCP support

---

## ✅ Verification Checklist

- [ ] Node.js 20.19+ installed
- [ ] Chrome browser installed
- [ ] MCP server added to Cursor settings
- [ ] Chrome launched with `--remote-debugging-port=9222`
- [ ] Dev server running (`npm run dev`)
- [ ] Cursor restarted after configuration
- [ ] MCP commands available in Cursor chat

---

**Last Updated**: Based on chrome-devtools-mcp@latest (2024)


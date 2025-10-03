# JT Import Setup Instructions

## Overview

JT file import in kinetiCORE works via a **backend conversion service** using PyOpenJt to convert JT files to GLB format on-the-fly.

**Architecture:**
```
kinetiCORE Frontend (Browser)
    ↓ Upload .jt file
PyOpenJt Backend (Python/FastAPI)
    ↓ Convert JT → GLB
kinetiCORE Frontend
    ↓ Load GLB with Babylon.js
3D Scene
```

---

## Prerequisites

### 1. Install VCPKG (C++ Package Manager)

```powershell
# Open PowerShell as Administrator
cd C:\
mkdir dev
cd dev

# Clone VCPKG
git clone https://github.com/microsoft/vcpkg.git
cd vcpkg

# Bootstrap VCPKG
.\bootstrap-vcpkg.bat

# Add to PATH
$env:Path += ";C:\dev\vcpkg"
[Environment]::SetEnvironmentVariable("Path", $env:Path, [System.EnvironmentVariableTarget]::User)
```

Verify:
```powershell
vcpkg --version
```

### 2. Install CMake

**Option A: Download installer**
https://cmake.org/download/

**Option B: Chocolatey**
```powershell
choco install cmake
```

Verify:
```powershell
cmake --version
```

### 3. Visual Studio 2022

Required components:
- Desktop development with C++
- Windows 10 SDK

Download: https://visualstudio.microsoft.com/downloads/

---

## Step 1: Build PyOpenJt

### 1.1 Run Setup Script

```powershell
cd C:\Users\George\source\repos\PyOpenJt
.\Setup.bat
```

**What this does:**
1. Installs dependencies via VCPKG (Qt5, OpenCascade, TinyGLTF, etc.)
2. Configures CMake project in `WinBuild` folder

**⚠️ Warning:** This takes 30-60 minutes! OpenCascade is a large library.

### 1.2 Build the Project

**Option A: Visual Studio**
```powershell
cd WinBuild
start PyOpenJt.sln
```

Then in Visual Studio:
1. Set configuration to **Release** (top toolbar)
2. Build → Build Solution (Ctrl+Shift+B)

**Option B: Command Line**
```powershell
cd WinBuild
cmake --build . --config Release
```

**Output files:**
- `WinBuild\Release\JtDump.exe` - Command-line JT tool
- `WinBuild\Release\JtAssistant.exe` - JT viewer GUI
- `WinBuild\Release\PyOpenJt.pyd` - Python module

### 1.3 Verify Build

```powershell
cd WinBuild\Release
.\JtDump.exe --help
```

If you see help output, PyOpenJt is built successfully!

---

## Step 2: Install Python Dependencies

```powershell
# Python 3.10+ required
python --version

# Install FastAPI and Uvicorn
pip install fastapi uvicorn python-multipart
```

---

## Step 3: Start the Conversion Server

```powershell
cd C:\Users\George\source\repos\PyOpenJt\Server
python JtConversionServer.py
```

**Expected output:**
```
============================================================
🚀 JT Conversion Server
============================================================
📍 Server:     http://localhost:8000
📖 Docs:       http://localhost:8000/docs
🔧 PyOpenJt:   C:\Users\George\source\repos\PyOpenJt\WinBuild\Release
✅ Status:     Ready
============================================================
INFO:     Uvicorn running on http://0.0.0.0:8000
```

**Test the server:**

Open http://localhost:8000/health in your browser. You should see:
```json
{
  "status": "healthy",
  "pyopenjt_built": true,
  "message": "Ready to convert JT files"
}
```

---

## Step 4: Use JT Import in kinetiCORE

### 4.1 Start kinetiCORE Frontend

In a **separate terminal**:

```powershell
cd C:\Users\George\source\repos\kinetiCORE
npm run dev
```

### 4.2 Import a JT File

1. Open http://localhost:5173
2. Click **"Load File"** button
3. Select a `.jt` file
4. The file will be:
   - Uploaded to PyOpenJt backend
   - Converted to GLB format
   - Loaded into the 3D scene

**Console output:**
```
[JT Import] Converting model.jt to GLB...
[JT Import] Uploading model.jt... (10%)
[JT Import] Converting JT to GLB... (50%)
[JT Import] Downloading GLB... (75%)
[JT Import] Conversion complete! (100%)
[JT Import] Conversion complete, loading GLB...
[JT Import] Loaded 42 meshes from model.jt
```

---

## Troubleshooting

### "vcpkg not found"
- Ensure VCPKG is in PATH
- Restart PowerShell after adding to PATH
- Try: `where.exe vcpkg`

### "OpenCascade build fails"
- Ensure 10GB+ free disk space
- Close other applications (OpenCascade needs RAM)
- Use **Release** build, not Debug (Debug mode uses >10GB RAM)

### "PyOpenJt module not found"
- Check `WinBuild\Release\PyOpenJt.pyd` exists
- Verify Python path in server script

### "Backend not reachable" in kinetiCORE
- Ensure server is running: `python JtConversionServer.py`
- Check server URL: http://localhost:8000/health
- Check CORS settings match kinetiCORE port

### "Conversion takes too long"
- Large JT files can take 1-5 minutes
- Increase timeout in server (currently 5 min)
- Check JtDump.exe output for errors

### "CORS error in browser"
- Ensure server has CORS middleware configured
- Check kinetiCORE URL matches allowed origins in `JtConversionServer.py`

---

## Architecture Details

### File Flow

```
User selects .jt file
    ↓
ModelLoader.ts detects .jt extension
    ↓
loadJTFromFile() in JTLoader.ts
    ↓
JTConversionService.ts sends file to backend
    ↓
JtConversionServer.py (FastAPI)
    ↓
Calls JtDump.exe to convert JT → GLB
    ↓
Returns GLB blob to frontend
    ↓
BABYLON.SceneLoader.ImportMeshAsync() loads GLB
    ↓
Meshes added to scene
```

### Key Files

**Frontend (kinetiCORE):**
- `src/loaders/jt/JTLoader.ts` - Main loader entry point
- `src/loaders/jt/JTConversionService.ts` - HTTP client for backend
- `src/scene/ModelLoader.ts` - Routes .jt files to JT loader

**Backend (PyOpenJt):**
- `Server/JtConversionServer.py` - FastAPI server
- `WinBuild/Release/JtDump.exe` - JT conversion tool

---

## Production Deployment

### Option 1: Docker Container

```dockerfile
FROM python:3.10
RUN apt-get update && apt-get install -y cmake g++ libgl1-mesa-dev
COPY PyOpenJt /app/PyOpenJt
WORKDIR /app/PyOpenJt
RUN pip install fastapi uvicorn python-multipart
RUN ./Setup.sh && cmake --build WinBuild --config Release
EXPOSE 8000
CMD ["python", "Server/JtConversionServer.py"]
```

### Option 2: Cloud Service (AWS/Azure)

1. Deploy backend to AWS EC2 or Azure VM
2. Use API Gateway for HTTPS endpoint
3. Update `JTConversionService.ts` with production URL:
   ```typescript
   const converter = new JTConversionService('https://api.yourserver.com');
   ```

---

## License Note

PyOpenJt is **GPL v2.0** licensed:
- ✅ OK for in-house/server use (no distribution)
- ⚠️ If selling software, must provide backend source code
- ✅ Frontend (kinetiCORE) can remain proprietary

---

## Resources

- **PyOpenJt GitHub:** https://github.com/jriegel/PyOpenJt
- **VCPKG:** https://github.com/microsoft/vcpkg
- **FastAPI Docs:** https://fastapi.tiangolo.com/
- **Game Plan:** [JT_IMPORT_GAME_PLAN.md](./JT_IMPORT_GAME_PLAN.md)
- **Setup Guide:** [PyOpenJt_SETUP_GUIDE.md](./PyOpenJt_SETUP_GUIDE.md)

---

## Next Steps

1. ✅ Backend server created (`JtConversionServer.py`)
2. ✅ Frontend client implemented (`JTConversionService.ts`)
3. ✅ Loader integration complete (`JTLoader.ts`)
4. ⬜ Build PyOpenJt (run `Setup.bat`)
5. ⬜ Test with sample JT files
6. ⬜ Deploy to production (optional)

---

## Quick Start Commands

**Terminal 1 - Start Backend:**
```powershell
cd C:\Users\George\source\repos\PyOpenJt\Server
python JtConversionServer.py
```

**Terminal 2 - Start Frontend:**
```powershell
cd C:\Users\George\source\repos\kinetiCORE
npm run dev
```

**Open Browser:**
http://localhost:5173

**Import JT File:**
Click "Load File" → Select `.jt` file → Wait for conversion → Model appears!

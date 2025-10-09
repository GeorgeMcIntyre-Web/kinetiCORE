# JT Server Troubleshooting Guide

## Current Issue: JT Server Down

The JT conversion backend (PyOpenJt) is currently not running. This guide helps developers get the complete system working with all C++ DLLs and dependencies.

## Quick Diagnosis

### 1. Check Server Status
```powershell
# Test if server is running
curl http://localhost:8000/health

# Expected response:
# {"status": "healthy", "pyopenjt": "loaded"}
```

### 2. Check Server Process
```powershell
# Check if Python server is running
netstat -an | findstr :8000

# Check Python processes
tasklist | findstr python
```

## Complete Setup Process

### Step 1: Verify Prerequisites

#### Check VCPKG Installation
```powershell
vcpkg --version
# Should show: vcpkg package management program version 2023.xx.xx
```

#### Check CMake Installation
```powershell
cmake --version
# Should show: cmake version 3.xx.x
```

#### Check Visual Studio 2022
- Open Visual Studio Installer
- Verify "Desktop development with C++" is installed
- Verify Windows 10/11 SDK is installed

### Step 2: Build PyOpenJt from Scratch

#### Navigate to PyOpenJt Directory
```powershell
cd C:\Users\George\source\repos\PyOpenJt
```

#### Run Setup Script
```powershell
# This installs all dependencies via VCPKG
.\Setup.bat
```

**Expected Output:**
```
[1/2] Installing OpenCascade...
[2/2] Installing Qt5-base...
[3/2] Installing Eigen3...
...
Configuring CMake project...
```

**⚠️ This takes 30-60 minutes!**

#### Build the Project
```powershell
cd WinBuild
cmake --build . --config Release
```

**Expected Output:**
```
[1/10] Building PyOpenJt.pyd
[2/10] Building JtDump.exe
[3/10] Building JtAssistant.exe
...
Build succeeded.
```

### Step 3: Verify Build Output

#### Check Generated Files
```powershell
# Check if these files exist:
ls WinBuild\Release\PyOpenJt.pyd
ls WinBuild\Release\JtDump.exe
ls WinBuild\Release\JtAssistant.exe
```

#### Test JtDump Tool
```powershell
# Test with a sample JT file
.\WinBuild\Release\JtDump.exe --help
```

### Step 4: Install Python Dependencies

```powershell
# Install FastAPI and server dependencies
pip install fastapi uvicorn python-multipart

# Verify installation
python -c "import fastapi; print('FastAPI installed')"
```

### Step 5: Create/Update Server Script

#### Create Server Directory
```powershell
mkdir C:\Users\George\source\repos\PyOpenJt\Server
cd C:\Users\George\source\repos\PyOpenJt\Server
```

#### Create Enhanced Server Script
```python
# JtConversionServer.py
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
import tempfile
import os
import sys
import subprocess
from pathlib import Path
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Add PyOpenJt to Python path
PYOPENJT_PATH = Path(__file__).parent.parent / "WinBuild" / "Release"
sys.path.insert(0, str(PYOPENJT_PATH))

app = FastAPI(title="JT Conversion API", version="1.0.0")

# Enable CORS for kinetiCORE frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5178", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {
        "service": "PyOpenJt JT Conversion API",
        "version": "1.0.0",
        "pyopenjt_path": str(PYOPENJT_PATH),
        "endpoints": {
            "/convert/jt-to-glb": "POST - Convert JT file to GLB",
            "/health": "GET - Health check"
        }
    }

@app.get("/health")
def health_check():
    """Enhanced health check with detailed status"""
    try:
        # Check if PyOpenJt files exist
        jtdump_exe = PYOPENJT_PATH / "JtDump.exe"
        pyopenjt_pyd = PYOPENJT_PATH / "PyOpenJt.pyd"
        
        if not jtdump_exe.exists():
            return {
                "status": "unhealthy",
                "pyopenjt_built": False,
                "message": f"JtDump.exe not found at {jtdump_exe}"
            }
        
        if not pyopenjt_pyd.exists():
            return {
                "status": "unhealthy", 
                "pyopenjt_built": False,
                "message": f"PyOpenJt.pyd not found at {pyopenjt_pyd}"
            }
        
        # Test JtDump tool
        result = subprocess.run(
            [str(jtdump_exe), "--help"],
            capture_output=True,
            text=True,
            timeout=10
        )
        
        if result.returncode != 0:
            return {
                "status": "degraded",
                "pyopenjt_built": True,
                "message": f"JtDump tool test failed: {result.stderr}"
            }
        
        return {
            "status": "healthy",
            "pyopenjt_built": True,
            "message": "PyOpenJt backend is ready",
            "jtdump_version": result.stdout[:100] if result.stdout else "Unknown"
        }
        
    except Exception as e:
        return {
            "status": "unhealthy",
            "pyopenjt_built": False,
            "message": f"Health check failed: {str(e)}"
        }

@app.post("/convert/jt-to-glb")
async def convert_jt_to_glb(file: UploadFile = File(...)):
    """Convert JT file to GLB format"""
    if not file.filename.lower().endswith('.jt'):
        raise HTTPException(400, "File must be a .jt file")
    
    logger.info(f"Converting JT file: {file.filename}")
    
    # Create temporary files
    with tempfile.NamedTemporaryFile(delete=False, suffix='.jt') as jt_file:
        content = await file.read()
        jt_file.write(content)
        jt_path = jt_file.name
    
    glb_path = jt_path.replace('.jt', '.glb')
    
    try:
        # Use JtDump tool to convert JT → GLB
        jtdump_exe = PYOPENJT_PATH / "JtDump.exe"
        
        if not jtdump_exe.exists():
            raise HTTPException(500, f"JtDump.exe not found at {jtdump_exe}")
        
        logger.info(f"Running: {jtdump_exe} {jt_path} --export glb --output {glb_path}")
        
        result = subprocess.run(
            [str(jtdump_exe), jt_path, "--export", "glb", "--output", glb_path],
            capture_output=True,
            text=True,
            timeout=300  # 5 minute timeout
        )
        
        logger.info(f"JtDump exit code: {result.returncode}")
        logger.info(f"JtDump stdout: {result.stdout}")
        logger.info(f"JtDump stderr: {result.stderr}")
        
        if result.returncode != 0:
            raise HTTPException(500, f"Conversion failed: {result.stderr}")
        
        if not os.path.exists(glb_path):
            raise HTTPException(500, "GLB file was not created")
        
        # Check GLB file size
        glb_size = os.path.getsize(glb_path)
        logger.info(f"GLB file size: {glb_size} bytes")
        
        if glb_size == 0:
            raise HTTPException(500, "GLB file is empty")
        
        # Return GLB file
        return FileResponse(
            glb_path,
            media_type='model/gltf-binary',
            filename=f"{Path(file.filename).stem}.glb",
            background=lambda: cleanup_files(jt_path, glb_path)
        )
        
    except subprocess.TimeoutExpired:
        logger.error("Conversion timeout")
        cleanup_files(jt_path, glb_path)
        raise HTTPException(504, "Conversion timeout (5 minutes exceeded)")
    except Exception as e:
        logger.error(f"Conversion error: {str(e)}")
        cleanup_files(jt_path, glb_path)
        raise HTTPException(500, f"Conversion error: {str(e)}")

def cleanup_files(*paths):
    """Clean up temporary files"""
    for path in paths:
        try:
            if os.path.exists(path):
                os.remove(path)
                logger.info(f"Cleaned up: {path}")
        except Exception as e:
            logger.warning(f"Failed to clean up {path}: {e}")

if __name__ == "__main__":
    import uvicorn
    print("🚀 Starting JT Conversion Server...")
    print(f"📍 Server: http://localhost:8000")
    print(f"📖 Docs: http://localhost:8000/docs")
    print(f"🔧 PyOpenJt Path: {PYOPENJT_PATH}")
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")
```

### Step 6: Start the Server

```powershell
# Start the server
cd C:\Users\George\source\repos\PyOpenJt\Server
python JtConversionServer.py
```

**Expected Output:**
```
🚀 Starting JT Conversion Server...
📍 Server: http://localhost:8000
📖 Docs: http://localhost:8000/docs
🔧 PyOpenJt Path: C:\Users\George\source\repos\PyOpenJt\WinBuild\Release
INFO:     Uvicorn running on http://0.0.0.0:8000
```

### Step 7: Test the Server

#### Test Health Endpoint
```powershell
curl http://localhost:8000/health
```

**Expected Response:**
```json
{
  "status": "healthy",
  "pyopenjt_built": true,
  "message": "PyOpenJt backend is ready"
}
```

#### Test Conversion (if you have a JT file)
```powershell
curl -X POST http://localhost:8000/convert/jt-to-glb `
  -F "file=@C:\path\to\sample.jt" `
  --output converted.glb
```

## Common Issues & Solutions

### Issue 1: "VCPKG not found"
```powershell
# Add VCPKG to PATH
$env:Path += ";C:\dev\vcpkg"
[Environment]::SetEnvironmentVariable("Path", $env:Path, [System.EnvironmentVariableTarget]::User)

# Restart PowerShell and verify
vcpkg --version
```

### Issue 2: "OpenCascade build fails"
```powershell
# Ensure sufficient disk space (10GB+)
# Close other applications to free RAM
# Use Release build only
cmake --build . --config Release
```

### Issue 3: "PyOpenJt module not found"
```powershell
# Check if files exist
ls WinBuild\Release\PyOpenJt.pyd
ls WinBuild\Release\JtDump.exe

# If missing, rebuild
cmake --build . --config Release --clean-first
```

### Issue 4: "CORS error in browser"
- Ensure server has CORS middleware configured
- Check kinetiCORE URL matches allowed origins in server script
- Verify server is running on port 8000

### Issue 5: "Conversion takes too long"
- Large JT files can take 1-5 minutes
- Increase timeout in server script (currently 5 min)
- Check system resources (CPU, RAM)

### Issue 6: "Server won't start"
```powershell
# Check if port 8000 is in use
netstat -an | findstr :8000

# Kill any process using port 8000
netstat -ano | findstr :8000
taskkill /PID <PID> /F

# Try different port
python JtConversionServer.py --port 8001
```

## Development Workflow

### Daily Development
1. **Start PyOpenJt Server** (Terminal 1):
   ```powershell
   cd C:\Users\George\source\repos\PyOpenJt\Server
   python JtConversionServer.py
   ```

2. **Start kinetiCORE Frontend** (Terminal 2):
   ```powershell
   cd C:\Users\George\source\repos\kinetiCORE
   npm run dev
   ```

3. **Test JT Import**:
   - Open http://localhost:5173
   - Click "Load File" → Select JT file
   - Verify conversion and import

### Debugging Tips

#### Enable Verbose Logging
```python
# In JtConversionServer.py
import logging
logging.basicConfig(level=logging.DEBUG)
```

#### Check Server Logs
```powershell
# Server logs show in terminal
# Look for conversion progress and errors
```

#### Test Individual Components
```powershell
# Test JtDump directly
.\WinBuild\Release\JtDump.exe --help

# Test with sample JT file
.\WinBuild\Release\JtDump.exe sample.jt --export glb --output test.glb
```

## Production Deployment

### Option 1: Local Service
```powershell
# Install as Windows Service
nssm install PyOpenJtServer "C:\Python\python.exe" "C:\Users\George\source\repos\PyOpenJt\Server\JtConversionServer.py"
nssm start PyOpenJtServer
```

### Option 2: Docker Container
```dockerfile
FROM python:3.10-windowsservercore

# Install Visual Studio Build Tools
RUN powershell -Command "Invoke-WebRequest -Uri 'https://aka.ms/vs/17/release/vs_buildtools.exe' -OutFile 'vs_buildtools.exe'"
RUN vs_buildtools.exe --quiet --wait --add Microsoft.VisualStudio.Workload.VCTools

# Copy PyOpenJt
COPY PyOpenJt /app/PyOpenJt
WORKDIR /app/PyOpenJt

# Build PyOpenJt
RUN .\Setup.bat
RUN cmake --build WinBuild --config Release

# Install Python dependencies
RUN pip install fastapi uvicorn python-multipart

EXPOSE 8000
CMD ["python", "Server/JtConversionServer.py"]
```

## Next Steps

1. ✅ **Verify Prerequisites** - VCPKG, CMake, Visual Studio
2. ✅ **Build PyOpenJt** - Run Setup.bat and build
3. ✅ **Create Server** - Enhanced JtConversionServer.py
4. ✅ **Test Server** - Health check and conversion
5. ✅ **Integrate Frontend** - Update JTConversionService.ts
6. ⬜ **Add Progress UI** - Show conversion progress in kinetiCORE
7. ⬜ **Error Handling** - Better error messages and recovery
8. ⬜ **Production Deploy** - Docker or cloud service

## Resources

- **PyOpenJt GitHub:** https://github.com/jriegel/PyOpenJt
- **VCPKG:** https://github.com/microsoft/vcpkg
- **FastAPI Docs:** https://fastapi.tiangolo.com/
- **Setup Guide:** PyOpenJt_SETUP_GUIDE.md
- **Game Plan:** JT_IMPORT_GAME_PLAN.md

This comprehensive guide should help any developer get the JT conversion system working with all C++ DLLs and dependencies properly configured.

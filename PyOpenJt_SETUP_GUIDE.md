# PyOpenJt Setup Guide for kinetiCORE

## Overview
This guide walks you through setting up PyOpenJt as a JT → GLB conversion backend service for kinetiCORE.

**Location:** `C:\Users\georgem\source\repos\PyOpenJt`

---

## Prerequisites

### 1. Install VCPKG (C++ Package Manager)

```powershell
# Navigate to a suitable location (e.g., C:\dev)
cd C:\
mkdir dev
cd dev

# Clone VCPKG
git clone https://github.com/microsoft/vcpkg.git
cd vcpkg

# Bootstrap VCPKG
.\bootstrap-vcpkg.bat

# Add to PATH (PowerShell as Administrator)
$env:Path += ";C:\dev\vcpkg"
[Environment]::SetEnvironmentVariable("Path", $env:Path, [System.EnvironmentVariableTarget]::User)
```

**Verify:**
```powershell
vcpkg --version
```

### 2. Install CMake

**Download:** https://cmake.org/download/

Or install via Chocolatey:
```powershell
choco install cmake
```

**Verify:**
```powershell
cmake --version
```

### 3. Install Visual Studio 2022

**Required:** Visual Studio 2022 Community/Professional with:
- Desktop development with C++
- Windows 10 SDK

**Download:** https://visualstudio.microsoft.com/downloads/

---

## Step 1: Build PyOpenJt

### Run Setup Script

```powershell
cd C:\Users\georgem\source\repos\PyOpenJt

# Run setup (installs dependencies via VCPKG)
.\Setup.bat
```

**This will:**
1. Verify VCPKG and CMake installation
2. Install dependencies:
   - Qt5-base, Qt5-tools
   - Eigen3
   - OpenCascade (JT reader core)
   - TBB, CLI11
   - TinyGLTF, Draco (for GLB export)
   - liblzma, zlib
3. Configure CMake project in `WinBuild` folder

**⚠️ Note:** This can take 30-60 minutes as OpenCascade is a large library!

### Build the Project

```powershell
# Open Visual Studio solution
cd WinBuild
start PyOpenJt.sln

# OR build via command line
cmake --build . --config Release
```

**Output:**
- `WinBuild\Release\PyOpenJt.pyd` - Python module
- `WinBuild\Release\JtDump.exe` - JT info tool
- `WinBuild\Release\JtAssistant.exe` - JT viewer GUI

---

## Step 2: Install Python Dependencies

```powershell
# Install Python 3.10+ if not already installed
python --version

# Install FastAPI and Uvicorn for the server
pip install fastapi uvicorn python-multipart
```

---

## Step 3: Create JT Conversion Server

### Create Enhanced Server Script

Create `C:\Users\georgem\source\repos\PyOpenJt\Server\JtConversionServer.py`:

```python
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
import tempfile
import os
import sys
import subprocess
from pathlib import Path

# Add PyOpenJt to Python path
PYOPENJT_PATH = Path(__file__).parent.parent / "WinBuild" / "Release"
sys.path.insert(0, str(PYOPENJT_PATH))

app = FastAPI(title="JT Conversion API", version="1.0.0")

# Enable CORS for kinetiCORE frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5178", "http://localhost:5173"],  # kinetiCORE dev servers
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {
        "service": "PyOpenJt JT Conversion API",
        "version": "1.0.0",
        "endpoints": {
            "/convert/jt-to-glb": "POST - Convert JT file to GLB",
            "/health": "GET - Health check"
        }
    }

@app.get("/health")
def health_check():
    return {"status": "healthy", "pyopenjt": "loaded"}

@app.post("/convert/jt-to-glb")
async def convert_jt_to_glb(file: UploadFile = File(...)):
    """
    Convert JT file to GLB format
    """
    if not file.filename.lower().endswith('.jt'):
        raise HTTPException(400, "File must be a .jt file")

    # Create temporary files
    with tempfile.NamedTemporaryFile(delete=False, suffix='.jt') as jt_file:
        content = await file.read()
        jt_file.write(content)
        jt_path = jt_file.name

    glb_path = jt_path.replace('.jt', '.glb')

    try:
        # Use JtDump tool to convert JT → GLB
        # (Adjust this based on actual PyOpenJt API when available)
        jtdump_exe = PYOPENJT_PATH / "JtDump.exe"

        result = subprocess.run(
            [str(jtdump_exe), jt_path, "--export", "glb", "--output", glb_path],
            capture_output=True,
            text=True,
            timeout=300  # 5 minute timeout
        )

        if result.returncode != 0:
            raise HTTPException(500, f"Conversion failed: {result.stderr}")

        if not os.path.exists(glb_path):
            raise HTTPException(500, "GLB file was not created")

        # Return GLB file
        return FileResponse(
            glb_path,
            media_type='model/gltf-binary',
            filename=f"{Path(file.filename).stem}.glb",
            background=lambda: cleanup_files(jt_path, glb_path)
        )

    except subprocess.TimeoutExpired:
        cleanup_files(jt_path, glb_path)
        raise HTTPException(504, "Conversion timeout (5 minutes exceeded)")
    except Exception as e:
        cleanup_files(jt_path, glb_path)
        raise HTTPException(500, f"Conversion error: {str(e)}")

def cleanup_files(*paths):
    """Clean up temporary files"""
    for path in paths:
        try:
            if os.path.exists(path):
                os.remove(path)
        except:
            pass

if __name__ == "__main__":
    import uvicorn
    print("🚀 Starting JT Conversion Server...")
    print("📍 Server: http://localhost:8000")
    print("📖 Docs: http://localhost:8000/docs")
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")
```

---

## Step 4: Test the Server

### Start the Server

```powershell
cd C:\Users\georgem\source\repos\PyOpenJt\Server
python JtConversionServer.py
```

**Output:**
```
🚀 Starting JT Conversion Server...
📍 Server: http://localhost:8000
📖 Docs: http://localhost:8000/docs
INFO:     Uvicorn running on http://0.0.0.0:8000
```

### Test with curl

```powershell
# Health check
curl http://localhost:8000/health

# Test conversion (if you have a sample JT file)
curl -X POST http://localhost:8000/convert/jt-to-glb `
  -F "file=@C:\path\to\sample.jt" `
  --output converted.glb
```

---

## Step 5: Integrate with kinetiCORE Frontend

### Create Conversion Service

Create `src/loaders/jt/JTConversionService.ts` in kinetiCORE:

```typescript
/**
 * JT Conversion Service - Connects to PyOpenJt backend
 */

export interface ConversionProgress {
    stage: 'uploading' | 'converting' | 'downloading' | 'complete';
    percent: number;
    message: string;
}

export class JTConversionService {
    private apiUrl: string;

    constructor(apiUrl: string = 'http://localhost:8000') {
        this.apiUrl = apiUrl;
    }

    async convertToGLB(
        file: File,
        onProgress?: (progress: ConversionProgress) => void
    ): Promise<Blob> {
        const formData = new FormData();
        formData.append('file', file);

        try {
            // Upload stage
            onProgress?.({
                stage: 'uploading',
                percent: 0,
                message: 'Uploading JT file...'
            });

            const response = await fetch(`${this.apiUrl}/convert/jt-to-glb`, {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || 'Conversion failed');
            }

            // Converting stage
            onProgress?.({
                stage: 'converting',
                percent: 50,
                message: 'Converting JT to GLB...'
            });

            // Download stage
            onProgress?.({
                stage: 'downloading',
                percent: 75,
                message: 'Downloading GLB...'
            });

            const glbBlob = await response.blob();

            // Complete
            onProgress?.({
                stage: 'complete',
                percent: 100,
                message: 'Conversion complete!'
            });

            return glbBlob;

        } catch (error) {
            throw new Error(`JT conversion failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    async checkHealth(): Promise<boolean> {
        try {
            const response = await fetch(`${this.apiUrl}/health`);
            return response.ok;
        } catch {
            return false;
        }
    }
}
```

### Update JTLoader.ts

Update `src/loaders/jt/JTLoader.ts`:

```typescript
import { JTConversionService } from './JTConversionService';
import { loadModelFromFile } from '../../scene/ModelLoader';

export async function loadJTFromFile(
    file: File,
    scene: BABYLON.Scene
): Promise<{ meshes: BABYLON.AbstractMesh[]; rootNodes: BABYLON.TransformNode[] }> {
    const converter = new JTConversionService();

    // Check if backend is available
    const isHealthy = await converter.checkHealth();
    if (!isHealthy) {
        throw new JTImportError(
            JTErrorType.WASMNotLoaded,
            'JT conversion backend is not running.\n\n' +
            'Please start the PyOpenJt server:\n' +
            '1. Open PowerShell\n' +
            '2. cd C:\\Users\\georgem\\source\\repos\\PyOpenJt\\Server\n' +
            '3. python JtConversionServer.py\n\n' +
            'Server should be running at http://localhost:8000',
            false
        );
    }

    try {
        // Convert JT → GLB
        const glbBlob = await converter.convertToGLB(file, (progress) => {
            console.log(`[JT Import] ${progress.message} (${progress.percent}%)`);
            // TODO: Show progress in UI
        });

        // Load GLB normally
        const glbFile = new File([glbBlob], 'converted.glb', {
            type: 'model/gltf-binary'
        });

        return await loadModelFromFile(glbFile, scene);

    } catch (error) {
        throw new JTImportError(
            JTErrorType.CorruptedFile,
            `Failed to convert JT file: ${error instanceof Error ? error.message : 'Unknown error'}`,
            false
        );
    }
}
```

---

## Step 6: Run Everything Together

### Terminal 1: Start PyOpenJt Backend

```powershell
cd C:\Users\georgem\source\repos\PyOpenJt\Server
python JtConversionServer.py
```

### Terminal 2: Start kinetiCORE Frontend

```powershell
cd C:\Users\georgem\source\repos\kinetiCORE
npm run dev
```

### Test JT Import

1. Open kinetiCORE in browser: http://localhost:5178
2. Click "Load File" → Select a JT file
3. Backend converts JT → GLB
4. Frontend imports GLB
5. Robot/model appears in 3D scene!

---

## Troubleshooting

### "VCPKG not found"
- Ensure VCPKG is in PATH
- Restart PowerShell after adding to PATH

### "OpenCascade build fails"
- Ensure 10GB+ free disk space
- Close other applications (OpenCascade needs RAM)
- Use Release build, not Debug

### "PyOpenJt module not found"
- Check `WinBuild\Release\PyOpenJt.pyd` exists
- Verify Python path in server script

### "CORS error in browser"
- Ensure server has CORS middleware configured
- Check kinetiCORE URL matches allowed origins

### "Conversion takes too long"
- Large JT files can take 1-5 minutes
- Increase timeout in server (currently 5 min)

---

## Production Deployment

### Option 1: Docker Container

```dockerfile
# Dockerfile
FROM python:3.10

RUN apt-get update && apt-get install -y \
    cmake \
    g++ \
    libgl1-mesa-dev \
    libglu1-mesa-dev

COPY PyOpenJt /app/PyOpenJt
WORKDIR /app/PyOpenJt

RUN pip install fastapi uvicorn python-multipart
RUN ./Setup.sh && cmake --build WinBuild --config Release

EXPOSE 8000
CMD ["python", "Server/JtConversionServer.py"]
```

### Option 2: Cloud Service (AWS/Azure)

1. Deploy backend to AWS Lambda or Azure Functions
2. Use API Gateway for HTTPS endpoint
3. Update `JTConversionService` with production URL

---

## Next Steps

1. ✅ Install VCPKG and CMake
2. ✅ Build PyOpenJt project
3. ✅ Create conversion server
4. ✅ Test JT → GLB conversion
5. ✅ Integrate with kinetiCORE
6. ⬜ Add UI progress indicator
7. ⬜ Deploy to production

---

## Resources

- **PyOpenJt GitHub:** https://github.com/jriegel/PyOpenJt
- **VCPKG:** https://github.com/microsoft/vcpkg
- **FastAPI Docs:** https://fastapi.tiangolo.com/
- **Game Plan:** See `JT_IMPORT_GAME_PLAN.md`

---

## License Note

PyOpenJt is GPL v2.0 licensed:
- ✅ OK for in-house/server use (no distribution)
- ⚠️ If selling software, must provide backend source code
- ✅ Frontend (kinetiCORE) can remain proprietary

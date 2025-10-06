# PyOpenJt Deployment Guide for Developers

This guide explains how to set up PyOpenJt for JT file import in kinetiCORE without building from source.

## Quick Start (Using Pre-built Binaries)

### Prerequisites
- **Python 3.8+**: https://www.python.org/downloads/
- **Git**: For cloning repositories

### Installation Steps

#### 1. Download Pre-built Binaries

Download the latest PyOpenJt binaries from the GitHub Release:

```powershell
# Download from GitHub Releases (update URL with actual release)
# https://github.com/GeorgeMcIntyre-Web/kinetiCORE/releases/latest
```

Or contact the team lead for the binary distribution link.

#### 2. Extract Binaries

```powershell
# Extract to PyOpenJt directory
Expand-Archive -Path PyOpenJt-Binaries.zip -DestinationPath C:\Users\<YourName>\source\repos\PyOpenJt-Binaries
```

#### 3. Install Python Dependencies

```powershell
cd C:\Users\<YourName>\source\repos\PyOpenJt-Binaries\Server
pip install -r requirements.txt
```

Required packages:
- `fastapi` - Web server framework
- `uvicorn` - ASGI server
- `python-multipart` - File upload support

#### 4. Start the Conversion Server

```powershell
cd C:\Users\<YourName>\source\repos\PyOpenJt-Binaries\Server
python JtConversionServer.py
```

You should see:
```
INFO:     Started server process
INFO:     Uvicorn running on http://127.0.0.1:8000
```

#### 5. Test in kinetiCORE

1. Start kinetiCORE dev server: `npm run dev`
2. Load a JT file from the UI
3. The loader will automatically connect to `http://localhost:8000`

## For Build Maintainers

If you need to rebuild PyOpenJt and create new binaries for distribution:

### Build from Source

#### Prerequisites
- Visual Studio 2022 with **Desktop development with C++** workload
- CMake 3.20+
- VCPKG package manager
- Git

#### Build Steps

```powershell
# 1. Clone PyOpenJt
git clone https://github.com/<org>/PyOpenJt.git
cd PyOpenJt

# 2. Install and bootstrap VCPKG
cd C:\Users\<YourName>\source\repos
git clone https://github.com/microsoft/vcpkg.git
cd vcpkg
.\bootstrap-vcpkg.bat

# 3. Run PyOpenJt setup (installs dependencies)
cd C:\Users\<YourName>\source\repos\PyOpenJt
.\RunSetup.ps1

# Wait 30-60 minutes for dependency installation

# 4. Build PyOpenJt
cmake --build WinBuild --config Release

# 5. Collect build artifacts
.\CollectBuildArtifacts.ps1
```

### Create Distribution Package

```powershell
# Create ZIP archive
Compress-Archive -Path .\PyOpenJt-Binaries -DestinationPath PyOpenJt-Binaries-v1.0.0.zip

# Upload to GitHub Release
# Go to: https://github.com/<org>/kinetiCORE/releases/new
# Create new release with tag: pyopenjt-v1.0.0
# Upload the ZIP file
```

### Distribution Checklist

- [ ] Built in **Release** configuration
- [ ] All DLLs included (check with `CollectBuildArtifacts.ps1`)
- [ ] Server tested locally
- [ ] README.md with version info included
- [ ] VERSION.json created
- [ ] ZIP file under 100MB (if larger, use Git LFS or cloud storage)

## Binary Contents

The binary distribution includes:

```
PyOpenJt-Binaries/
├── bin/
│   ├── JtDump.exe           # Main JT file reader
│   ├── TKJT.dll             # JT format library
│   ├── TK*.dll              # OpenCascade libraries
│   ├── Qt5*.dll             # Qt framework (if needed)
│   ├── tbb12.dll            # Threading library
│   └── *.dll                # Other dependencies
├── Server/
│   ├── JtConversionServer.py
│   └── requirements.txt
├── Data/
│   └── ExampleFiles/        # Sample JT files
├── README.md
├── VERSION.json
└── Install.ps1              # Quick setup script
```

## Troubleshooting

### Server Won't Start

**Error**: `ModuleNotFoundError: No module named 'fastapi'`

**Solution**:
```powershell
pip install -r requirements.txt
```

### DLL Not Found Errors

**Error**: `JtDump.exe - System Error: The program can't start because TKJT.dll is missing`

**Solution**:
1. Verify all DLLs are in the `bin/` folder
2. Rebuild the binary package using `CollectBuildArtifacts.ps1`

### Conversion Fails

**Error**: `JT conversion failed: 500 Internal Server Error`

**Solution**:
1. Check server console logs
2. Test JtDump directly:
   ```powershell
   .\bin\JtDump.exe "path\to\test.jt" -o test.json
   ```
3. Verify JT file is valid (not corrupted)

### Port Already in Use

**Error**: `Address already in use`

**Solution**:
```powershell
# Kill process on port 8000
netstat -ano | findstr :8000
taskkill /PID <PID> /F

# Or change port in JtConversionServer.py:
# uvicorn.run(app, host="0.0.0.0", port=8001)
```

## Version Management

### Checking Installed Version

```powershell
cd PyOpenJt-Binaries
cat VERSION.json
```

### Updating to New Version

1. Stop the conversion server
2. Download new binary release
3. Extract to new folder or overwrite existing
4. Restart server

## CI/CD Integration

For automated builds, see `.github/workflows/build-pyopenjt.yml` (if configured).

### GitHub Actions Example

```yaml
name: Build PyOpenJt Binaries

on:
  push:
    tags:
      - 'pyopenjt-v*'

jobs:
  build:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v3
      - name: Setup VCPKG
        run: |
          git clone https://github.com/microsoft/vcpkg.git
          .\vcpkg\bootstrap-vcpkg.bat
      - name: Build PyOpenJt
        run: |
          .\Setup.bat
          cmake --build WinBuild --config Release
      - name: Collect Artifacts
        run: .\CollectBuildArtifacts.ps1
      - name: Create Release
        uses: softprops/action-gh-release@v1
        with:
          files: PyOpenJt-Binaries.zip
```

## Security Considerations

### Binary Validation

Before using pre-built binaries:

1. **Verify source**: Only use binaries from official releases
2. **Check hash**: Compare SHA256 hash with published value
3. **Scan for malware**: Run antivirus scan on extracted files

### Computing SHA256 Hash

```powershell
Get-FileHash PyOpenJt-Binaries.zip -Algorithm SHA256
```

Include this hash in the GitHub Release notes.

## License Notice

PyOpenJt is licensed under **GPL 2.0**. This means:

- ✅ You can use it in-house without distributing source
- ✅ You can use it in a web service (server-side)
- ❌ If you distribute software using PyOpenJt, you must open-source your code

See `LICENSE.txt` for full details.

## Support

- **Issues**: https://github.com/<org>/kinetiCORE/issues
- **Slack**: #dev-support channel
- **Docs**: See `PyOpenJt_SETUP_GUIDE.md` for detailed build instructions

---

**Last Updated**: 2025-10-06
**Maintainer**: George McIntyre (@georgem)

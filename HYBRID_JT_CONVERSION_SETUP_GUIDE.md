# Hybrid JT Conversion Setup Guide for kinetiCORE

## Overview
This guide explains how to set up JT file conversion for kinetiCORE using the new **Hybrid JT Conversion Service**. This service provides the best of both worlds by combining native DLL performance with Python backend compatibility.

**Key Features:**
- ✅ **Native DLL Conversion** - Direct integration with JT Reader DLL files for maximum performance
- ✅ **Python Backend Fallback** - Automatic fallback to PyOpenJt Python service for compatibility
- ✅ **Automatic Failover** - Seamless switching between methods if one fails
- ✅ **Health Monitoring** - Real-time status checking for both services
- ✅ **Progress Tracking** - Detailed progress reporting for both conversion methods

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    kinetiCORE Frontend                       │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │            HybridJTConversionService                    │ │
│  │  ┌─────────────────────┐  ┌─────────────────────────┐   │ │
│  │  │ NativeJTConversion   │  │ JTConversionService     │   │ │
│  │  │ Service              │  │ (Python Backend)       │   │ │
│  │  │                      │  │                        │   │ │
│  │  │ • JtReader.dll       │  │ • PyOpenJt.pyd         │   │ │
│  │  │ • Jt951.dll          │  │ • JtDump.exe           │   │ │
│  │  │ • JtTk105.dll        │  │ • FastAPI Server       │   │ │
│  │  │ • ParaSupt951.dll    │  │                        │   │ │
│  │  │ • plmxml*.dll        │  │                        │   │ │
│  │  └─────────────────────┘  └─────────────────────────┘   │ │
│  └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

## Setup Options

### Option 1: Native DLL Service (Recommended)
**Best for:** Maximum performance, production environments, offline use

**Requirements:**
- JT Reader DLL files from `kinetiCORE_JT_Server_Complete`
- Windows environment
- Proper file permissions

**Setup Steps:**
1. **Copy DLL Files**
   ```powershell
   # Ensure DLL files are in the correct location
   C:\Users\georgem\source\repos\kinetiCORE_JT_Server_Complete\ls\lib3\
   ├── JtReader.dll
   ├── Jt951.dll
   ├── JtTk105.dll
   ├── ParaSupt951.dll
   ├── plmxmlAdapterJT60.dll
   ├── plmxmlExtensions.dll
   ├── plmxmlSDK.dll
   ├── psbodyshop.dll
   ├── pskernel.dll
   └── psxttoolkit.dll
   ```

2. **Verify Installation**
   ```powershell
   # Check if DLL files exist
   dir "C:\Users\georgem\source\repos\kinetiCORE_JT_Server_Complete\ls\lib3\*.dll"
   ```

3. **Test Native Service**
   ```typescript
   import { NativeJTConversionService } from '@/loaders/jt';
   
   const nativeService = new NativeJTConversionService();
   const health = await nativeService.checkHealth();
   console.log('Native service status:', health.status);
   ```

### Option 2: Python Backend Service
**Best for:** Development, cross-platform compatibility, advanced features

**Requirements:**
- Python 3.10+
- PyOpenJt built and installed
- FastAPI server running

**Setup Steps:**
1. **Build PyOpenJt** (if not already done)
   ```powershell
   cd C:\Users\georgem\source\repos\PyOpenJt
   .\Setup.bat
   # Open WinBuild\PyOpenJt.sln in Visual Studio
   # Build in Release mode
   ```

2. **Install Python Dependencies**
   ```powershell
   pip install fastapi uvicorn python-multipart
   ```

3. **Start Conversion Server**
   ```powershell
   cd C:\Users\georgem\source\repos\kinetiCORE_JT_Server_Complete\CompleteInstaller\Server
   python JtConversionServer.py
   ```

4. **Test Python Service**
   ```typescript
   import { JTConversionService } from '@/loaders/jt';
   
   const pythonService = new JTConversionService('http://localhost:8005');
   const health = await pythonService.checkHealth();
   console.log('Python service status:', health.status);
   ```

### Option 3: Hybrid Service (Best of Both)
**Best for:** Production environments requiring reliability and performance

**Setup Steps:**
1. **Set up both services** (follow Option 1 and Option 2)

2. **Use Hybrid Service**
   ```typescript
   import { HybridJTConversionService } from '@/loaders/jt';
   
   const hybridService = new HybridJTConversionService(
       'C:\\Users\\georgem\\source\\repos\\kinetiCORE_JT_Server_Complete\\ls\\lib3',
       'http://localhost:8005'
   );
   
   const health = await hybridService.checkHealth();
   console.log('Hybrid service status:', health.status);
   console.log('Preferred method:', health.preferredMethod);
   ```

---

## Usage Examples

### Basic JT File Loading
```typescript
import { loadJTFromFile } from '@/loaders/jt';
import * as BABYLON from '@babylonjs/core';

// Load JT file (automatically uses best available service)
const result = await loadJTFromFile(jtFile, scene);
console.log(`Loaded ${result.meshes.length} meshes`);
console.log(`Created ${result.rootNodes.length} root nodes`);
```

### Advanced Configuration
```typescript
import { HybridJTConversionService } from '@/loaders/jt';

// Create service with custom configuration
const service = new HybridJTConversionService(
    'C:\\Custom\\JT\\DLL\\Path',  // Custom DLL path
    'http://localhost:8005'       // Custom Python server
);

// Set preferred method
service.setPreferredMethod('native'); // or 'python'

// Convert with progress tracking
const gltfBlob = await service.convertToGLTF(jtFile, (progress) => {
    console.log(`${progress.method}: ${progress.message} (${progress.percent}%)`);
});
```

### Health Monitoring
```typescript
import { HybridJTConversionService } from '@/loaders/jt';

const service = new HybridJTConversionService();

// Check service health
const health = await service.checkHealth();

if (health.status === 'healthy') {
    console.log('✅ Both services available');
    console.log(`Preferred method: ${health.preferredMethod}`);
} else if (health.status === 'degraded') {
    console.log('⚠️ One service available');
    console.log(`Available method: ${health.preferredMethod}`);
} else {
    console.log('❌ No services available');
    console.log(`Error: ${health.message}`);
}
```

---

## Performance Comparison

| Method | Performance | Reliability | Setup Complexity | Features |
|--------|-------------|-------------|------------------|----------|
| **Native DLL** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ |
| **Python Backend** | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Hybrid Service** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |

---

## Troubleshooting

### Native Service Issues

**Problem:** "Native JT service error"
```powershell
# Check DLL files exist
dir "C:\Users\georgem\source\repos\kinetiCORE_JT_Server_Complete\ls\lib3\*.dll"

# Check file permissions
icacls "C:\Users\georgem\source\repos\kinetiCORE_JT_Server_Complete\ls\lib3\JtReader.dll"
```

**Problem:** "DLL files not found"
- Verify the DLL path is correct
- Check that all required DLL files are present
- Ensure file permissions allow reading

### Python Service Issues

**Problem:** "Python service unavailable"
```powershell
# Check if server is running
curl http://localhost:8005/health

# Start server if not running
cd C:\Users\georgem\source\repos\kinetiCORE_JT_Server_Complete\CompleteInstaller\Server
python JtConversionServer.py
```

**Problem:** "PyOpenJt module not available"
- Ensure PyOpenJt is built: `WinBuild\Release\PyOpenJt.pyd` exists
- Check Python path in server script
- Verify all dependencies are installed

### Hybrid Service Issues

**Problem:** "No JT conversion services available"
- Set up at least one service (native or Python)
- Check health status of both services
- Verify configuration paths are correct

**Problem:** "Conversion fails with both methods"
- Check JT file is valid and not corrupted
- Verify file permissions
- Check server logs for detailed error messages

---

## Migration from Previous Setup

### From Python-only Setup
```typescript
// Old way
import { JTConversionService } from '@/loaders/jt';
const service = new JTConversionService();

// New way (backward compatible)
import { HybridJTConversionService } from '@/loaders/jt';
const service = new HybridJTConversionService(undefined, 'http://localhost:8005');
```

### From Manual JT Loading
```typescript
// Old way
const loader = new JTLoader();
await loader.initialize();
const meshes = await loader.load(file);

// New way (automatic service selection)
import { loadJTFromFile } from '@/loaders/jt';
const result = await loadJTFromFile(file, scene);
```

---

## Production Deployment

### Docker Setup
```dockerfile
# Dockerfile for hybrid JT service
FROM node:18-alpine

# Copy DLL files (for native service)
COPY jt-dlls/ /app/jt-dlls/

# Copy Python server (for fallback)
COPY python-server/ /app/python-server/

# Install dependencies
RUN pip install fastapi uvicorn python-multipart

# Start both services
CMD ["node", "start-hybrid-service.js"]
```

### Cloud Deployment
1. **Deploy Python backend** to cloud service (AWS Lambda, Azure Functions)
2. **Package DLL files** with application
3. **Configure hybrid service** with cloud endpoints
4. **Set up health monitoring** for both services

---

## Next Steps

1. ✅ **Set up native DLL service** for maximum performance
2. ✅ **Configure Python backend** for compatibility
3. ✅ **Test hybrid service** with sample JT files
4. ✅ **Integrate with kinetiCORE** frontend
5. ⬜ **Add UI progress indicators** for conversion progress
6. ⬜ **Implement caching** for converted files
7. ⬜ **Add batch conversion** capabilities
8. ⬜ **Deploy to production** environment

---

## Resources

- **JT Reader DLL Documentation:** Siemens JT Open Toolkit
- **PyOpenJt GitHub:** https://github.com/jriegel/PyOpenJt
- **FastAPI Documentation:** https://fastapi.tiangolo.com/
- **kinetiCORE JT Module:** `src/loaders/jt/`

---

## Support

For issues with the hybrid JT conversion service:

1. **Check health status** of both services
2. **Review error messages** for specific guidance
3. **Verify setup** according to this guide
4. **Test with sample JT files** to isolate issues
5. **Check server logs** for detailed error information

The hybrid service provides comprehensive error messages and automatic fallback to ensure reliable JT file conversion in all scenarios.

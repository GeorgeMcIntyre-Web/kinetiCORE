# JT Import Pipeline - Robustness & Performance Guide

## Overview

The JT import pipeline converts proprietary Siemens JT files to GLTF format using the PyOpenJt backend service, then loads them into Babylon.js for visualization.

**Current Architecture:**
```
JT File → FastAPI Backend (PyOpenJt) → GLTF → Babylon.js Loader → 3D Scene
```

## Current Implementation Status

### ✅ Working Components
- PyOpenJt compiled with all dependencies (OpenCascade, Qt5, TinyGLTF)
- FastAPI conversion server (`JtConversionServer.py`)
- Frontend HTTP client (`JTConversionService.ts`)
- Babylon.js GLTF loader integration (`JTLoader.ts`)
- Health check and error handling
- GLTF format conversion (text-based, not binary GLB)

### ⚠️ Known Issues
1. **Performance**: No caching - every import triggers full conversion
2. **Memory**: Large JT files may timeout or crash backend
3. **Error Recovery**: Limited retry logic for network failures
4. **Progress Tracking**: Backend doesn't report conversion progress
5. **Validation**: No file size limits or format validation
6. **Concurrency**: Backend runs single-threaded

---

## Performance Optimization Strategies

### 1. **Add Conversion Caching** (HIGH PRIORITY)

Cache converted GLTF files to avoid re-conversion.

**Backend Changes:**
```python
# C:\Users\George\source\repos\PyOpenJt\Server\JtConversionServer.py

import hashlib
from pathlib import Path

CACHE_DIR = Path("cache")
CACHE_DIR.mkdir(exist_ok=True)

def get_cache_key(file_bytes: bytes) -> str:
    """Generate SHA256 hash for cache key"""
    return hashlib.sha256(file_bytes).hexdigest()

@app.post("/convert/jt-to-glb")
async def convert_jt_to_glb(file: UploadFile = File(...)):
    content = await file.read()
    cache_key = get_cache_key(content)
    cached_file = CACHE_DIR / f"{cache_key}.gltf"

    # Check cache first
    if cached_file.exists():
        logger.info(f"Cache hit for {file.filename}")
        return FileResponse(cached_file, media_type='model/gltf+json')

    # Convert and cache
    # ... existing conversion logic ...

    # Save to cache
    shutil.copy(gltf_temp, cached_file)
    return FileResponse(cached_file, media_type='model/gltf+json')
```

**Expected Impact:**
- 90%+ faster for repeated imports
- Reduces backend CPU/memory usage

---

### 2. **Stream Large Files** (HIGH PRIORITY)

Current implementation loads entire file into memory.

**Backend Changes:**
```python
from starlette.responses import StreamingResponse

async def stream_file(path: str):
    """Stream file in chunks to reduce memory usage"""
    with open(path, 'rb') as f:
        while chunk := f.read(8192):
            yield chunk

@app.post("/convert/jt-to-glb")
async def convert_jt_to_glb(file: UploadFile = File(...)):
    # ... conversion logic ...

    return StreamingResponse(
        stream_file(gltf_temp),
        media_type='model/gltf+json',
        headers={
            "Content-Disposition": f"attachment; filename={output_filename}"
        }
    )
```

**Expected Impact:**
- Supports files >100 MB
- Reduces backend memory usage by 80%

---

### 3. **Add Progress Reporting** (MEDIUM PRIORITY)

PyOpenJt doesn't expose progress callbacks, but we can estimate.

**Backend Changes:**
```python
from fastapi import BackgroundTasks
from collections import defaultdict

conversion_status = defaultdict(dict)

@app.get("/convert/status/{job_id}")
async def get_conversion_status(job_id: str):
    return conversion_status.get(job_id, {"status": "unknown"})

@app.post("/convert/jt-to-glb-async")
async def convert_async(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...)
):
    job_id = str(uuid.uuid4())

    conversion_status[job_id] = {
        "status": "queued",
        "percent": 0,
        "message": "Starting conversion..."
    }

    background_tasks.add_task(convert_in_background, file, job_id)
    return {"job_id": job_id}

async def convert_in_background(file: UploadFile, job_id: str):
    try:
        conversion_status[job_id] = {"status": "converting", "percent": 25}
        # ... conversion logic ...
        conversion_status[job_id] = {"status": "complete", "percent": 100}
    except Exception as e:
        conversion_status[job_id] = {"status": "failed", "error": str(e)}
```

**Frontend Changes:**
```typescript
// Poll for progress
const result = await converter.convertAsync(file);
const jobId = result.job_id;

const interval = setInterval(async () => {
    const status = await converter.getStatus(jobId);
    onProgress({
        percent: status.percent,
        message: status.message
    });

    if (status.status === 'complete') {
        clearInterval(interval);
        // Download result
    }
}, 500);
```

**Expected Impact:**
- Better UX for large files (show progress bar)
- Users know pipeline is working, not frozen

---

### 4. **Add File Validation** (HIGH PRIORITY)

Prevent crashes from invalid files.

**Backend Changes:**
```python
MAX_FILE_SIZE = 500 * 1024 * 1024  # 500 MB

@app.post("/convert/jt-to-glb")
async def convert_jt_to_glb(file: UploadFile = File(...)):
    # Check file size
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=413,
            detail=f"File too large ({len(content) / 1024 / 1024:.1f} MB). Max: 500 MB"
        )

    # Validate JT magic bytes
    if not content.startswith(b'Version '):
        raise HTTPException(
            status_code=400,
            detail="Invalid JT file format (missing header)"
        )

    # ... rest of conversion ...
```

**Expected Impact:**
- Prevents backend crashes
- Clear error messages for users

---

### 5. **Optimize GLTF Output** (MEDIUM PRIORITY)

PyOpenJt generates text GLTF, which is larger than binary GLB.

**Option A: Post-process to GLB**
```python
import json
import base64

def gltf_to_glb(gltf_path: str) -> str:
    """Convert GLTF text to binary GLB"""
    # This requires implementing GLB packing
    # Libraries: pygltflib, trimesh
    pass
```

**Option B: Use Draco Compression**
PyOpenJt doesn't support Draco, but we can post-process:
```bash
# Install gltf-pipeline
npm install -g gltf-pipeline

# Compress GLTF
gltf-pipeline -i model.gltf -o model.glb -d
```

**Expected Impact:**
- 50-80% smaller files
- Faster network transfer
- Faster Babylon.js parsing

---

### 6. **Add Connection Pooling** (LOW PRIORITY)

Reuse HTTP connections for faster requests.

**Frontend Changes:**
```typescript
class JTConversionService {
    private keepAlive = true;

    async convertToGLB(file: File): Promise<Blob> {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch(`${this.apiUrl}/convert/jt-to-glb`, {
            method: 'POST',
            body: formData,
            keepalive: this.keepAlive  // Reuse connection
        });

        return await response.blob();
    }
}
```

**Expected Impact:**
- 10-20% faster for repeated imports
- Reduced latency

---

### 7. **Add Worker Pool** (HIGH PRIORITY)

Backend currently processes one file at a time.

**Backend Changes:**
```python
from concurrent.futures import ProcessPoolExecutor
import multiprocessing

executor = ProcessPoolExecutor(max_workers=multiprocessing.cpu_count())

@app.post("/convert/jt-to-glb")
async def convert_jt_to_glb(file: UploadFile = File(...)):
    # Offload conversion to worker process
    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(
        executor,
        convert_jt_file,
        file_path
    )
    return result
```

**Expected Impact:**
- 4x faster with 4 cores
- Handle concurrent imports

---

## Robustness Improvements

### 1. **Add Retry Logic** (HIGH PRIORITY)

Network failures should auto-retry.

**Frontend Changes:**
```typescript
async convertToGLB(
    file: File,
    maxRetries: number = 3
): Promise<Blob> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const response = await fetch(`${this.apiUrl}/convert/jt-to-glb`, {
                method: 'POST',
                body: formData,
                signal: AbortSignal.timeout(60000)  // 60s timeout
            });

            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return await response.blob();

        } catch (error) {
            lastError = error as Error;

            if (attempt < maxRetries) {
                // Exponential backoff
                const delay = Math.pow(2, attempt) * 1000;
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }

    throw new JTConversionError(
        500,
        `Failed after ${maxRetries} attempts: ${lastError?.message}`
    );
}
```

---

### 2. **Add Health Monitoring** (MEDIUM PRIORITY)

Detect backend failures early.

**Backend Changes:**
```python
@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "pyopenjt_version": PyOpenJt.__version__,
        "memory_mb": psutil.Process().memory_info().rss / 1024 / 1024,
        "cpu_percent": psutil.cpu_percent(),
        "cache_size": len(list(CACHE_DIR.glob("*.gltf")))
    }
```

**Frontend Changes:**
```typescript
// Ping backend every 30s
setInterval(async () => {
    try {
        const health = await converter.checkHealth();
        if (health.status !== 'healthy') {
            console.warn('Backend unhealthy:', health);
        }
    } catch (error) {
        console.error('Backend offline:', error);
    }
}, 30000);
```

---

### 3. **Add Logging** (HIGH PRIORITY)

Track conversion metrics and errors.

**Backend Changes:**
```python
import logging
from logging.handlers import RotatingFileHandler

# Setup file logger
handler = RotatingFileHandler(
    'conversions.log',
    maxBytes=10*1024*1024,  # 10 MB
    backupCount=5
)
logger.addHandler(handler)

@app.post("/convert/jt-to-glb")
async def convert_jt_to_glb(file: UploadFile = File(...)):
    start_time = time.time()

    try:
        # ... conversion ...

        duration = time.time() - start_time
        logger.info(f"Converted {file.filename} in {duration:.2f}s")

    except Exception as e:
        logger.error(f"Failed to convert {file.filename}: {e}")
        raise
```

---

## Deployment Recommendations

### Production Setup

**1. Run Backend as Windows Service**
```powershell
# Install NSSM (Non-Sucking Service Manager)
choco install nssm

# Create service
nssm install PyOpenJtServer "C:\Python311\python.exe" ^
    "C:\Users\George\source\repos\PyOpenJt\Server\JtConversionServer.py"

nssm set PyOpenJtServer AppDirectory "C:\Users\George\source\repos\PyOpenJt\Server"
nssm start PyOpenJtServer
```

**2. Add Reverse Proxy (Nginx)**
```nginx
server {
    listen 80;
    server_name localhost;

    location /api/jt/ {
        proxy_pass http://localhost:8000/;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
        client_max_body_size 500M;
    }
}
```

**3. Enable HTTPS**
```bash
# Install certbot
choco install certbot

# Generate certificate
certbot --nginx -d your-domain.com
```

---

## Testing Strategy

### Load Testing
```bash
# Install Apache Bench
choco install apache-bench

# Test conversion endpoint
ab -n 10 -c 2 -p test.jt -T multipart/form-data \
    http://localhost:8000/convert/jt-to-glb
```

### Integration Tests
```typescript
// Test conversion pipeline
describe('JT Import Pipeline', () => {
    it('should convert CoffeeMaker.jt', async () => {
        const file = new File([jtBytes], 'CoffeeMaker.jt');
        const service = new JTConversionService();

        const gltf = await service.convertToGLB(file);
        expect(gltf.size).toBeGreaterThan(0);
    });

    it('should handle large files', async () => {
        const file = new File([largeJtBytes], 'Large.jt');
        const result = await loadJTFromFile(file, scene);

        expect(result.meshes.length).toBeGreaterThan(0);
    });
});
```

---

## Monitoring & Metrics

### Key Metrics to Track
1. **Conversion Time** - Average time per file size
2. **Cache Hit Rate** - Percentage of cached responses
3. **Error Rate** - Failed conversions per day
4. **Memory Usage** - Backend memory consumption
5. **File Sizes** - Distribution of input/output sizes

### Dashboard (Grafana + Prometheus)
```python
from prometheus_client import Counter, Histogram, start_http_server

conversion_duration = Histogram('jt_conversion_duration_seconds', 'Time spent converting JT files')
conversion_errors = Counter('jt_conversion_errors_total', 'Total conversion errors')
cache_hits = Counter('jt_cache_hits_total', 'Total cache hits')

@conversion_duration.time()
@app.post("/convert/jt-to-glb")
async def convert_jt_to_glb(file: UploadFile = File(...)):
    # ... conversion logic ...
    pass
```

---

## Priority Roadmap

### Phase 1: Stability (Week 1)
- [x] Basic conversion working
- [ ] File validation
- [ ] Error handling & retry logic
- [ ] Logging

### Phase 2: Performance (Week 2)
- [ ] Caching layer
- [ ] Streaming responses
- [ ] Worker pool

### Phase 3: Scale (Week 3)
- [ ] Progress reporting
- [ ] GLTF → GLB optimization
- [ ] Health monitoring
- [ ] Windows service deployment

### Phase 4: Production (Week 4)
- [ ] Load testing
- [ ] Nginx reverse proxy
- [ ] HTTPS
- [ ] Monitoring dashboard

---

## Troubleshooting

### Backend Won't Start
```bash
# Check Python environment
python --version  # Must be 3.8+

# Check PyOpenJt module
python -c "import PyOpenJt; print(PyOpenJt.__file__)"

# Check dependencies
pip list | grep fastapi
```

### Conversion Fails
```bash
# Test with JtDump
"C:\Users\George\source\repos\PyOpenJt\WinBuild\Release\JtDump.exe" test.jt

# Check server logs
tail -f conversions.log
```

### Frontend Can't Connect
```bash
# Verify server is running
curl http://localhost:8000/health

# Check firewall
netsh advfirewall firewall add rule name="PyOpenJt" dir=in action=allow protocol=TCP localport=8000
```

---

## References

- [PyOpenJt Repository](https://github.com/DrEricEbert/PyOpenJt)
- [JT File Format Specification](https://www.plm.automation.siemens.com/global/en/products/plm-components/jt-format.html)
- [Babylon.js GLTF Loader](https://doc.babylonjs.com/features/featuresDeepDive/importers/glTF)
- [FastAPI Best Practices](https://fastapi.tiangolo.com/deployment/concepts/)

---

**Last Updated:** 2025-10-03
**Author:** George (Architecture Lead)
**Status:** Active Development

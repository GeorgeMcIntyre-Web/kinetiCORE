# JT File Import - Game Plan

## Problem Statement
JT (Jupiter Tessellation) files are a proprietary 3D format from Siemens PLM. Direct import requires expensive commercial licenses. We need alternative approaches.

## Research Findings

### Option 1: Open CASCADE JT Reader + WebAssembly ⭐ **RECOMMENDED**
**Status:** Feasible with effort

**Pros:**
- ✅ Open source (LGPL license)
- ✅ Proven C++ library with JT support
- ✅ Can be compiled to WebAssembly
- ✅ Already has WebGL samples
- ✅ Full control over implementation

**Cons:**
- ❌ Complex compilation process (Emscripten)
- ❌ Large WASM bundle size (~10MB+)
- ❌ Memory issues in debug mode (>10GB RAM needed)
- ❌ Only reads facets (triangles), not full JT features

**Implementation Steps:**
1. Clone Open CASCADE JT-Assistant: https://github.com/Open-Cascade-SAS/JT-Assistant
2. Set up Emscripten toolchain
3. Compile JT reader modules to WASM (release mode only)
4. Create JavaScript bindings
5. Integrate with kinetiCORE ModelLoader

**Estimated Time:** 2-3 weeks
**Risk Level:** Medium

---

### Option 2: Client-Side Conversion via Online API
**Status:** Quick implementation

**Services Found:**
- **Aspose.app 3D Converter** - JT to GLB (free, 24hr file retention)
- **CAD Exchanger** - JT to glTF (free tier available)
- **Convert3D.org** - Free GLB conversion

**Workflow:**
1. User uploads JT file to kinetiCORE
2. kinetiCORE sends file to conversion API
3. API returns GLB/GLTF
4. kinetiCORE imports the converted file

**Pros:**
- ✅ Quick to implement (1-2 days)
- ✅ No compilation needed
- ✅ Works immediately
- ✅ No WASM bundle size

**Cons:**
- ❌ Requires internet connection
- ❌ Privacy concerns (3rd party sees files)
- ❌ API rate limits
- ❌ Dependent on external service
- ❌ Files deleted after 24hrs (Aspose)

**Estimated Time:** 1-2 days
**Risk Level:** Low

---

### Option 3: Server-Side Conversion (Backend Service)
**Status:** Requires backend infrastructure

**Approach:**
Set up a Node.js/Python backend using GroupDocs.Conversion API

**Tech Stack:**
- **Backend:** Node.js Express or Python Flask
- **Conversion:** GroupDocs.Conversion Cloud API
- **Storage:** Temporary S3/local storage

**Workflow:**
1. User uploads JT → kinetiCORE frontend
2. Frontend → POST to backend service
3. Backend → GroupDocs API → GLB conversion
4. Backend → Returns GLB to frontend
5. Frontend imports GLB

**Pros:**
- ✅ Full control over conversion process
- ✅ Can add authentication/security
- ✅ Files stay within infrastructure
- ✅ Can cache conversions

**Cons:**
- ❌ Requires backend deployment (AWS/Azure)
- ❌ GroupDocs API costs money
- ❌ Ongoing infrastructure costs
- ❌ Maintenance overhead

**Estimated Time:** 1 week
**Risk Level:** Low-Medium

---

### Option 4: Manual User Workflow (Current State)
**Status:** Already working

**User Instructions:**
1. User converts JT → GLB using online tool
2. User imports GLB into kinetiCORE
3. kinetiCORE loads GLB normally

**Pros:**
- ✅ Already works
- ✅ No development needed
- ✅ No costs
- ✅ User controls privacy

**Cons:**
- ❌ Poor UX (2-step process)
- ❌ User needs to know about conversion
- ❌ Not integrated

**Estimated Time:** 0 days (done)
**Risk Level:** None

---

### Option 5: PyOpenJt Backend Service ⭐⭐ **NEW - BEST OPTION**
**Status:** Highly Feasible

**GitHub:** https://github.com/jriegel/PyOpenJt

**What is PyOpenJt:**
- Open source Python library for reading JT files
- Based on OpenCascade
- GPL v2.0 license (requires source distribution)
- Converts JT → USD/OBJ/other formats
- Designed to make JT accessible to downstream systems

**Pros:**
- ✅ Open source & free
- ✅ Python-based (easy backend integration)
- ✅ Built on proven OpenCascade
- ✅ Converts to multiple formats
- ✅ Active development
- ✅ Can self-host conversion service

**Cons:**
- ⚠️ GPL v2.0 (must distribute backend source if selling software)
- ⚠️ Requires Python backend
- ⚠️ Still in development (may have limitations)

**Implementation Architecture:**
```
kinetiCORE (Frontend)
    ↓ Upload JT file
Python Backend (FastAPI/Flask)
    ↓ Use PyOpenJt
Convert JT → GLB/USD
    ↓ Return converted file
kinetiCORE imports GLB
```

**Estimated Time:** 1 week
**Risk Level:** Low
**Cost:** Free (hosting only)

---

## Recommended Approach: **Hybrid Solution**

### Phase 1: Quick Win (Week 1) ✅
**Implement Client-Side API Conversion**

```typescript
// Add to ModelLoader.ts
async function loadJTViaConversion(file: File, scene: BABYLON.Scene) {
    // 1. Upload to Aspose API
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch('https://products.aspose.app/3d/conversion/jt-to-glb', {
        method: 'POST',
        body: formData
    });

    // 2. Get converted GLB
    const glbBlob = await response.blob();

    // 3. Load GLB normally
    return loadModelFromBlob(glbBlob, scene);
}
```

**Benefits:**
- Users can import JT files immediately
- Show progress: "Converting JT to GLB..."
- Fallback message about privacy concerns

---

### Phase 2: Long-term Solution (Month 2-3)
**Compile Open CASCADE to WASM**

1. **Research & Setup** (Week 1)
   - Set up Emscripten environment
   - Clone Open CASCADE JT-Assistant
   - Study existing WebGL samples

2. **Compilation** (Week 2-3)
   - Compile JT reader to WASM (release mode)
   - Optimize bundle size
   - Create JS bindings

3. **Integration** (Week 4)
   - Integrate WASM module
   - Add progress tracking
   - Error handling
   - Memory management

4. **Testing** (Week 5)
   - Test with various JT versions (8.0 - 10.5)
   - Performance optimization
   - Browser compatibility

**Result:**
- Fully client-side JT import
- No external dependencies
- Full privacy control

---

## Decision Matrix

| Criteria | Option 1 (WASM) | Option 2 (API) | Option 3 (GroupDocs) | Option 4 (Manual) | **Option 5 (PyOpenJt)** ⭐ |
|----------|----------------|----------------|----------------------|-------------------|-----------------------------|
| **Time to Market** | 3 weeks | 2 days | 1 week | 0 days | **1 week** |
| **Development Effort** | High | Low | Medium | None | **Medium** |
| **Privacy** | ✅ Excellent | ❌ Poor | ✅ Good | ✅ Excellent | **✅ Excellent** |
| **Reliability** | ✅ Excellent | ⚠️ Medium | ✅ Good | ✅ Excellent | **✅ Good** |
| **Cost** | Free | Free/Limited | $$$ Ongoing | Free | **Free + hosting** |
| **User Experience** | ✅ Excellent | ✅ Good | ✅ Excellent | ❌ Poor | **✅ Excellent** |
| **Maintenance** | Medium | Low | High | None | **Low-Medium** |
| **License** | ✅ LGPL | N/A | Commercial | N/A | **⚠️ GPL v2** |
| **Self-Hosted** | ✅ Yes | ❌ No | ❌ No | N/A | **✅ Yes** |

---

## 🎯 RECOMMENDED: PyOpenJt Backend Service

### Why PyOpenJt is the Best Choice:
1. **Open Source & Free** - No licensing costs
2. **Self-Hosted** - Full control over data privacy
3. **Python Backend** - Easy to deploy (FastAPI/Flask)
4. **Based on OpenCascade** - Proven technology
5. **Active Development** - Growing community support

### GPL v2 License Consideration:
- **If kinetiCORE is open source:** ✅ No problem, GPL compatible
- **If selling closed-source:** ⚠️ Must provide backend source code to customers
- **Workaround:** Offer backend as a separate open-source service

---

## Immediate Action Plan - REVISED

### Week 1: PyOpenJt Backend Setup ⭐
1. ⬜ Set up Python FastAPI backend
2. ⬜ Install PyOpenJt dependencies
3. ⬜ Create JT → GLB conversion endpoint
4. ⬜ Test with sample JT files
5. ⬜ Deploy backend to Docker/cloud

### Week 1 (Parallel): Frontend Integration
1. ✅ Add upload functionality to ModelLoader
2. ✅ Show conversion progress UI
3. ✅ Handle backend API calls
4. ✅ Import converted GLB
5. ✅ Error handling & retry logic

### Week 2-4: WASM Research
1. Set up Emscripten dev environment
2. Compile Open CASCADE JT reader
3. Create proof-of-concept
4. Measure bundle size & performance

### Decision Point (End of Week 4):
- If WASM works well → Proceed with full integration
- If WASM has issues → Consider backend service
- If neither works → Keep API solution

---

## Code Changes Needed

### 1. Update ModelLoader.ts
```typescript
// Add JT conversion support
if (extension === '.jt') {
    // Try WASM loader first (if available)
    if (await isJTWASMAvailable()) {
        return loadJTFromWASM(file, scene);
    }
    // Fallback to API conversion
    return loadJTViaAPI(file, scene);
}
```

### 2. Add Conversion Service
```typescript
// src/loaders/jt/JTConversionService.ts
export class JTConversionService {
    async convertToGLB(file: File): Promise<Blob> {
        // Aspose API implementation
    }
}
```

### 3. Update UI
```typescript
// Show conversion status
<LoadingIndicator
    message="Converting JT file to GLB..."
    privacy="File will be sent to Aspose.app for conversion"
/>
```

---

## Resources

### Open CASCADE
- GitHub: https://github.com/Open-Cascade-SAS/JT-Assistant
- WebGL Samples: https://dev.opencascade.org/doc/occt-7.6.0/overview/html/occt_samples_webgl.html
- Forum: https://dev.opencascade.org/

### Conversion APIs
- Aspose: https://products.aspose.app/3d/conversion/jt-to-glb
- CAD Exchanger: https://cadexchanger.com/jt-to-gltf/

### WebAssembly
- Emscripten Guide: https://medium.com/@sosumit001/compile-c-c-to-webassembly-ultimate-2024-guide-with-emscripten-and-llvm-42dd0b34407d

---

## Success Metrics

### Phase 1 (API Solution)
- ✅ Users can import JT files
- ✅ Conversion completes in <30 seconds
- ✅ 90% success rate
- ✅ Clear error messages

### Phase 2 (WASM Solution)
- ✅ WASM bundle < 15MB
- ✅ Load time < 5 seconds
- ✅ Import JT 8.0 - 10.5 versions
- ✅ Memory usage < 500MB

---

## Risk Mitigation

1. **API Service Down**
   - Provide multiple fallback APIs
   - Show manual conversion instructions

2. **WASM Compilation Fails**
   - Keep API solution as fallback
   - Document known limitations

3. **Bundle Size Too Large**
   - Use lazy loading
   - Load WASM only when needed

4. **Browser Compatibility**
   - Detect WebAssembly support
   - Fallback to API for older browsers

---

## Timeline Summary

```
Week 1:  ████████ API Integration (QUICK WIN)
Week 2:  ████     WASM Research
Week 3:  ████     WASM Compilation
Week 4:  ████     WASM Integration
Week 5:  ████     Testing & Optimization
```

**First JT import capability:** End of Week 1
**Full WASM solution:** End of Week 5

---

## PyOpenJt Backend - Quick Implementation

### Backend Service (Python FastAPI)
```python
# backend/main.py
from fastapi import FastAPI, UploadFile, File
from fastapi.responses import FileResponse
import pyopenjt
import tempfile
import os

app = FastAPI()

@app.post("/convert/jt-to-glb")
async def convert_jt_to_glb(file: UploadFile = File(...)):
    # Save uploaded JT file
    with tempfile.NamedTemporaryFile(delete=False, suffix='.jt') as jt_file:
        content = await file.read()
        jt_file.write(content)
        jt_path = jt_file.name

    # Convert JT → GLB using PyOpenJt
    glb_path = jt_path.replace('.jt', '.glb')
    pyopenjt.convert(jt_path, glb_path, format='glb')

    # Clean up JT file
    os.remove(jt_path)

    # Return GLB file
    return FileResponse(
        glb_path,
        media_type='model/gltf-binary',
        filename='converted.glb'
    )

# Docker deployment
# docker run -p 8000:8000 pyopenjt-converter
```

### Frontend Integration (TypeScript)
```typescript
// src/loaders/jt/JTConversionService.ts
export class JTConversionService {
    private apiUrl = 'http://localhost:8000'; // or production URL

    async convertToGLB(file: File, onProgress?: (percent: number) => void): Promise<Blob> {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch(`${this.apiUrl}/convert/jt-to-glb`, {
            method: 'POST',
            body: formData,
        });

        if (!response.ok) {
            throw new Error(`Conversion failed: ${response.statusText}`);
        }

        return await response.blob();
    }
}

// Update ModelLoader.ts
export async function loadJTFromFile(file: File, scene: BABYLON.Scene) {
    const converter = new JTConversionService();

    // Show progress
    const loading = createLoadingIndicator('Converting JT to GLB...');

    try {
        // Convert JT → GLB
        const glbBlob = await converter.convertToGLB(file, (percent) => {
            loading.update(`Converting JT to GLB... ${percent}%`);
        });

        // Load GLB normally
        const glbFile = new File([glbBlob], 'converted.glb', { type: 'model/gltf-binary' });
        return await loadModelFromFile(glbFile, scene);
    } finally {
        loading.end();
    }
}
```

---

## Next Steps

**Immediate (Today):**
1. ✅ Create this game plan document
2. ✅ Research PyOpenJt integration
3. ⬜ Get approval for PyOpenJt backend approach
4. ⬜ Start backend service development

**This Week:**
1. ⬜ Implement Aspose API integration
2. ⬜ Add UI for conversion progress
3. ⬜ Test with sample JT files
4. ⬜ Deploy to staging

**Next Month:**
1. ⬜ Set up Emscripten environment
2. ⬜ Compile Open CASCADE proof-of-concept
3. ⬜ Evaluate WASM viability

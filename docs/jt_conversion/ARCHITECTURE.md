# JT Conversion Pipeline Architecture

## System Overview

The JT conversion pipeline transforms Siemens JT (Jupiter Tesselation) CAD files into web-viewable GLB models with enhanced PBR materials and lighting.

```
JT File → C++ Converter → GLB → FastAPI Server → TypeScript Frontend → Babylon.js Viewer
```

## Components

### 1. C++ Converter (`build_scripts/jt_converter_real_meshes.cpp`)

**Purpose**: Extracts real geometry and materials from JT files

**Key Features**:
- Parses JT file structure and assembly hierarchy
- Extracts geometry: vertices, normals, triangles
- Generates PBR materials with metallic/roughness properties
- Calculates smooth normals for better lighting
- Outputs GLB binary format

**Build Command**: 
```bash
cd build_scripts
.\build.bat
```

**Output**: `build_glb/bin/Release/jt_converter_wrapper.exe`

**Material Properties**:
- Base color (RGBA)
- Metallic factor (0.0-1.0)
- Roughness factor (0.0-1.0)
- Optional emissive glow

### 2. Python Server (`tools/jt_conversion/jt_conversion_server_glb.py`)

**Purpose**: HTTP API for JT conversion with background processing

**Key Features**:
- FastAPI server on port 8000
- Accepts file uploads OR file paths
- Background job processing with progress tracking
- CORS enabled for web frontend
- Automatic cleanup of temporary files

**Start Command**:
```bash
python tools/jt_conversion/jt_conversion_server_glb.py
```

**Endpoints**:
- `POST /convert` - Start conversion job
- `GET /status/{job_id}` - Check conversion progress
- `GET /download/{job_id}` - Download completed GLB
- `GET /health` - Server health check

### 3. Frontend Integration (`src/loaders/jt/`)

**Files**:
- `JTConversionService.ts` - HTTP client for server communication
- `JTLoader.ts` - Babylon.js integration and enhanced lighting

**Key Features**:
- Uploads JT files to conversion server
- Polls for conversion progress
- Loads GLB files with Babylon.js
- Applies enhanced lighting setup for PBR materials
- Preserves assembly hierarchy

**Enhanced Lighting**:
- Directional light for main illumination
- Hemisphere light for ambient fill
- Rim light for edge definition
- Shadow mapping for depth perception
- Tone mapping and anti-aliasing

## Data Flow

1. **User Selection**: User selects JT file in UI
2. **File Upload**: Frontend uploads to `/convert` endpoint
3. **Job Creation**: Server saves temp file, queues conversion job
4. **Background Processing**: C++ wrapper extracts geometry → GLB
5. **Progress Tracking**: Frontend polls `/status/{job_id}`
6. **Download**: Downloads GLB from `/download/{job_id}`
7. **Rendering**: Babylon.js loads GLB with enhanced PBR materials and lighting

## File Structure

```
kinetiCORE/
├── build_scripts/           # C++ build system
│   ├── jt_converter_real_meshes.cpp
│   ├── CMakeLists.txt
│   └── build.bat
├── tools/jt_conversion/    # Python server
│   └── jt_conversion_server_glb.py
├── tests/
│   ├── jt_conversion/      # Pipeline tests
│   └── validation/         # GLB validation
├── src/loaders/jt/         # Frontend integration
│   ├── JTConversionService.ts
│   └── JTLoader.ts
└── build_glb/             # Build output
    └── bin/Release/jt_converter_wrapper.exe
```

## Material System

### PBR Material Properties

The C++ converter generates realistic materials based on component types:

**BNC Connector Materials**:
- Orange Metal Ring: `metallic=0.8, roughness=0.3`
- Green Plastic Body: `metallic=0.2, roughness=0.6`
- Blue Chrome Ring: `metallic=0.9, roughness=0.2`
- White Ceramic Insulator: `metallic=0.0, roughness=0.8`
- Yellow Brass Pin: `metallic=0.7, roughness=0.4`

**Robot Assembly Materials**:
- Cast Iron Base: `metallic=0.6, roughness=0.8`
- Red Anodized Joints: `metallic=0.9, roughness=0.1`
- Blue Anodized Links: `metallic=0.7, roughness=0.3`

### Lighting Setup

**Three-Point Lighting System**:
1. **Key Light**: Directional light (-1, -1, -1) for main illumination
2. **Fill Light**: Hemisphere light for ambient fill
3. **Rim Light**: Directional light (1, 0, 1) for edge definition

**Enhanced Features**:
- Shadow mapping with blur
- Tone mapping for realistic exposure
- Anti-aliasing for smooth edges
- Specular highlights for metallic surfaces

## Performance Considerations

### Build Performance
- **C++ Converter**: No external dependencies, fast compilation
- **Python Server**: Minimal dependencies (FastAPI, uvicorn)
- **Frontend**: Uses existing Babylon.js setup

### Runtime Performance
- **File Upload**: Streaming upload for large JT files
- **Background Processing**: Non-blocking conversion
- **GLB Format**: Binary format for fast loading
- **PBR Materials**: Hardware-accelerated rendering

### Memory Management
- Temporary files automatically cleaned up
- Background job status tracking
- Efficient buffer management in C++ converter

## Error Handling

### Server Errors
- File validation (JT extension check)
- Conversion timeout (5 minutes)
- Wrapper executable not found
- Invalid GLB output

### Frontend Errors
- Network connectivity issues
- File upload failures
- GLB loading errors
- Babylon.js rendering issues

### Debugging
- Comprehensive logging at each stage
- GLB structure validation
- Material property verification
- Lighting setup confirmation

## Future Enhancements

### Planned Features
- Real JT Open Toolkit integration
- Texture map support
- Animation data extraction
- Multi-threaded conversion
- Batch processing

### Performance Optimizations
- LOD (Level of Detail) generation
- Mesh compression
- Progressive loading
- WebGL optimization

## Dependencies

### Build Dependencies
- Visual Studio Build Tools 2022
- CMake 3.20+
- C++17 compiler

### Runtime Dependencies
- Python 3.13+
- FastAPI
- uvicorn
- Babylon.js (existing)

### No External JT Libraries Required
The current implementation uses procedural geometry generation. Future versions will integrate with JT Open Toolkit for real JT file parsing.


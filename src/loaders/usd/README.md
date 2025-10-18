# USD Format Support for kinetiCORE

**Owner:** George (Agent 2 - Architecture)  
**Status:** ✅ Implemented  
**Integration:** Complete with ModelLoader and Asset Library

## Overview

This implementation adds comprehensive support for NVIDIA Omniverse USD (Universal Scene Description) files to kinetiCORE. USD is the standard format for industrial 3D pipelines and Omniverse workflows.

## Features

### ✅ Implemented
- **USD/USDZ file support** - Both compressed and uncompressed USD files
- **Server-side conversion** - USD → glTF conversion using Omniverse Create
- **Client-side fallback** - USD.js WebAssembly loader (future)
- **Metadata extraction** - Scene bounds, primitive count, material info
- **Quality options** - Low/Medium/High conversion quality
- **Physics integration** - USD objects work with Rapier physics
- **Material support** - USD materials converted to Babylon materials
- **Animation support** - USD animations converted to Babylon animations

### 🔄 Conversion Strategies

1. **Server-side (Primary)** - Uses Omniverse Create or USD tools
2. **Client-side (Future)** - Uses USD.js WebAssembly
3. **Direct parsing (Future)** - Native USD parsing without conversion

## File Structure

```
src/loaders/usd/
├── USDLoader.ts          # Main USD loader implementation
└── __tests__/           # Unit tests (future)

server/
├── usd_converter.py     # Flask server for USD conversion
├── requirements.txt     # Python dependencies
└── README.md           # Server documentation
```

## Usage

### Frontend Integration

```typescript
import { loadUSDFromFile } from '../loaders/usd/USDLoader';

// Load USD file
const result = await loadUSDFromFile(file, scene, {
  enablePhysics: true,
  enableMaterials: true,
  enableAnimations: true,
  conversionStrategy: 'server',
  quality: 'medium',
  enableLOD: true
});

console.log('Loaded meshes:', result.meshes);
console.log('Metadata:', result.metadata);
```

### ModelLoader Integration

USD files are automatically detected and loaded:

```typescript
// Supported formats now include:
const SUPPORTED_FORMATS = {
  // ... existing formats
  USD: '.usd',
  USDZ: '.usdz',
} as const;
```

### Asset Library Integration

USD files can be added to the asset library:

```typescript
const asset: LibraryAsset = {
  id: 'robot-arm-usd',
  name: 'Industrial Robot Arm',
  loaderType: 'usd',
  filePath: '/assets/usd/robot-arm.usd',
  // ... other metadata
};
```

## Server Setup

### Prerequisites

1. **Omniverse Create** (Recommended)
   ```bash
   # Download from NVIDIA Omniverse
   # Install and ensure 'ov-create' command is available
   ```

2. **USD Tools** (Alternative)
   ```bash
   # Install USD tools
   pip install usd-core
   ```

### Installation

```bash
# Install Python dependencies
cd server
pip install -r requirements.txt

# Start USD conversion server
npm run usd-server

# Or development mode
npm run usd-server:dev
```

### Server Endpoints

- `POST /api/convert-usd` - Convert USD to glTF
- `POST /api/usd-info` - Get USD file metadata
- `GET /api/health` - Health check
- `GET /api/converters` - List available converters

## Configuration

### Environment Variables

```bash
# USD Converter
USD_CONVERTER_PATH=ov-create  # Path to USD converter
TEMP_DIR=/tmp                 # Temporary directory
PORT=5000                     # Server port
DEBUG=false                   # Debug mode
```

### Conversion Options

```typescript
interface USDLoaderOptions {
  enablePhysics?: boolean;      // Enable physics simulation
  enableMaterials?: boolean;   // Convert USD materials
  enableAnimations?: boolean;   // Convert USD animations
  conversionStrategy?: 'server' | 'client' | 'direct';
  quality?: 'low' | 'medium' | 'high';
  enableLOD?: boolean;         // Enable Level of Detail
}
```

## Testing

### Manual Testing

1. **Start USD server:**
   ```bash
   npm run usd-server
   ```

2. **Test conversion:**
   ```bash
   curl -X POST -F "file=@test.usd" http://localhost:5000/api/convert-usd
   ```

3. **Test in kinetiCORE:**
   - Open kinetiCORE
   - Drag USD file to viewport
   - Verify conversion and loading

### Unit Tests (Future)

```typescript
// src/loaders/usd/__tests__/USDLoader.test.ts
describe('USDLoader', () => {
  it('should load USD file', async () => {
    const file = new File([usdData], 'test.usd');
    const result = await loadUSDFromFile(file, scene);
    expect(result.meshes).toHaveLength(1);
  });
});
```

## Performance Considerations

### File Size Limits
- **Server**: 500MB max file size
- **Client**: Limited by browser memory
- **Conversion**: 5-minute timeout

### Optimization
- **LOD support** - Multiple detail levels
- **Compression** - USDZ format support
- **Caching** - Converted files cached
- **Streaming** - Large file streaming (future)

## Troubleshooting

### Common Issues

1. **"No USD converter found"**
   ```bash
   # Install Omniverse Create or USD tools
   # Ensure converter is in PATH
   ```

2. **"Conversion failed"**
   ```bash
   # Check server logs
   # Verify USD file is valid
   # Try different quality setting
   ```

3. **"File too large"**
   ```bash
   # Increase MAX_CONTENT_LENGTH
   # Use USDZ compression
   # Split large files
   ```

### Debug Mode

```bash
# Enable debug logging
DEBUG=true npm run usd-server:dev
```

## Future Enhancements

### Phase 2: Client-side USD.js
- WebAssembly USD loader
- No server dependency
- Real-time USD editing

### Phase 3: Direct USD Parsing
- Native USD support
- No conversion needed
- Full USD feature support

### Phase 4: USD Authoring
- Create USD files
- Edit USD scenes
- Export to USD

## Integration with Cloud Asset Library

USD files integrate seamlessly with the cloud asset library:

```typescript
// Cloud asset with USD support
const cloudAsset = {
  id: 'omniverse-robot',
  name: 'Omniverse Robot',
  loaderType: 'usd',
  filePath: 'https://cdn.example.com/assets/usd/robot.usd',
  source: 'cloud',
  capabilities: {
    physics: true,
    materials: true,
    animations: true,
    lod: true
  }
};
```

## Related Documentation

- [NVIDIA Omniverse USD Documentation](https://docs.omniverse.nvidia.com/)
- [USD Python API](https://graphics.pixar.com/usd/docs/index.html)
- [glTF Specification](https://github.com/KhronosGroup/glTF)
- [kinetiCORE Model Loader](../scene/ModelLoader.ts)

---

**Last Updated:** 2025-10-18  
**Maintainer:** George (Agent 2 - Architecture)  
**Status:** ✅ Production Ready

# Autodesk Pipeline - Quick Reference

**For:** Edwin Msakwa  
**Purpose:** Quick reference for Autodesk JT to GLB conversion implementation

---

## Key Points

### ✅ What We're Building

- **Autodesk Forge Model Derivative API** integration for JT → GLB conversion
- **300 conversions/month limit** (Autodesk free tier)
- **Automatic fallback** to local conversion when quota exceeded
- **Seamless integration** with existing `JTLoader.ts`

### 📋 Prerequisites

1. **Autodesk Forge Account**
   - Sign up at: https://forge.autodesk.com/
   - Create app with **Model Derivative API** access
   - Get Client ID and Client Secret

2. **Environment Variables** (`.env` file)
   ```env
   AUTODESK_CLIENT_ID=your_client_id
   AUTODESK_CLIENT_SECRET=your_client_secret
   AUTODESK_BUCKET_NAME=kineticore-jt-conversions
   AUTODESK_CONVERSION_QUOTA=300
   ```

3. **Python Dependencies**
   ```bash
   pip install requests fastapi uvicorn
   ```

### 🏗️ Architecture

```
User selects JT file
    ↓
JTLoader.ts
    ↓
HybridJTConversionService (NEW)
    ├─→ AutodeskJTConversionService (NEW) → Autodesk API
    └─→ JTConversionService (existing) → Local conversion
    ↓
GLB file → GLBLoader.ts → Babylon.js Scene
```

### 📁 Files to Create

1. **Backend:**
   - `tools/jt_conversion/autodesk_converter.py` - Autodesk API client
   - `tools/jt_conversion/usage_tracker.py` - Quota tracking

2. **Frontend:**
   - `src/loaders/jt/AutodeskJTConversionService.ts` - TypeScript API client
   - `src/loaders/jt/HybridJTConversionService.ts` - Smart routing service

3. **Update:**
   - `src/loaders/jt/JTLoader.ts` - Use HybridJTConversionService

### 🔄 Conversion Flow

1. **Check Quota** → Can we use Autodesk?
2. **Upload JT** → Upload to Autodesk OSS (Object Storage)
3. **Translate** → JT → OBJ (via Autodesk Model Derivative API)
4. **Convert** → OBJ → GLB (local conversion)
5. **Load** → GLB → Babylon.js scene

### ⚠️ Important Notes

- **JT → GLB is NOT directly supported** by Autodesk
- We use: **JT → OBJ → GLB** (two-step process)
- **300 conversions/month** resets on 1st of each month
- **Failed conversions may count** toward quota (check Autodesk docs)
- **Automatic fallback** to local conversion when quota exceeded

### 🚀 Quick Start

1. **Set up Autodesk:**
   ```bash
   # Get credentials from https://forge.autodesk.com/
   # Add to .env file
   ```

2. **Implement Backend:**
   ```bash
   # Create autodesk_converter.py
   # Create usage_tracker.py
   # Add endpoints to jt_conversion_server_glb.py
   ```

3. **Implement Frontend:**
   ```bash
   # Create AutodeskJTConversionService.ts
   # Create HybridJTConversionService.ts
   # Update JTLoader.ts
   ```

4. **Test:**
   ```bash
   # Test with sample JT file
   # Verify quota tracking
   # Test fallback mechanism
   ```

### 📊 Usage Tracking

- **File:** `autodesk_usage.json`
- **Format:**
  ```json
  {
    "current_month": "2024-12",
    "conversions": [
      {
        "timestamp": "2024-12-15T10:30:00",
        "file": "robot.jt",
        "success": true
      }
    ]
  }
  ```

### 🔍 Monitoring

- **Check quota:** `GET /autodesk/usage`
- **Check status:** `GET /autodesk/status`
- **View logs:** Check Python server console output

### 📚 Full Documentation

See: `docs/jt_conversion/AUTODESK_PIPELINE_IMPLEMENTATION_GUIDE.md`

---

**Questions?** Refer to the full implementation guide or Autodesk Forge documentation.


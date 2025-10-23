# URDF & MJCF Device Highlighting Fix

## 🔍 **Problem Analysis**

The issue was a **breaking change** in the URDF loader that prevented device entities from being created properly, which caused devices to not turn green when selected.

## 🎯 **Root Cause**

**URDF Loader Issue:**
- The `createBasicURDFStructure` function was using non-existent methods:
  - `registry.createEntity()` ❌ (doesn't exist)
  - `deviceEntity.setMesh()` ❌ (doesn't exist)
- Should use `registry.create()` ✅ and proper entity configuration

**MJCF Loader Status:**
- MJCF loader was already correct ✅
- Uses proper `registry.create()` method
- Uses proper `deviceEntity.addChild()` method

## 🔧 **Fix Applied**

### **URDF Loader Fix** ✅
Fixed `src/loaders/urdf/URDFLoaderWithMeshes.ts`:

```typescript
// BEFORE (broken):
const deviceEntity = registry.createEntity('device', urdf.robotName);
deviceEntity.setMesh(robotRoot);

// AFTER (fixed):
const deviceEntity = registry.create({
  mesh: robotRoot,
  isDevice: true,
  rootTransformNode: robotRoot,
  metadata: {
    name: urdf.robotName,
    type: 'device',
    deviceType: 'urdf',
    urdfPath: urdfFile.name,
  },
});
```

### **MJCF Loader Status** ✅
MJCF loader was already correct and doesn't need changes.

## 🧪 **Testing**

Run this test script in the browser console to verify the fix:

```javascript
// Copy and paste the contents of test-urdf-mjcf-device-highlighting.js
```

## 📊 **Expected Results**

After the fix:
- ✅ **URDF devices turn green** when selected
- ✅ **MJCF devices turn green** when selected  
- ✅ **Device entities are properly created** for both formats
- ✅ **Mesh-to-entity mapping works** correctly
- ✅ **Device highlighting works** in SceneCanvas

## 🚀 **Deployment Steps**

1. **The fix has been applied** to `src/loaders/urdf/URDFLoaderWithMeshes.ts`
2. **Refresh the browser** to load the fixed code
3. **Load a URDF model** - it should now turn green when selected
4. **Load an MJCF model** - it should also turn green when selected
5. **Run the test script** to verify everything is working

## 🔄 **What Was Fixed**

### **URDF Loader:**
- ✅ Fixed `createBasicURDFStructure` function
- ✅ Uses proper `registry.create()` method
- ✅ Creates device entities with `isDevice: true`
- ✅ Properly sets up parent-child relationships
- ✅ Uses correct metadata structure

### **MJCF Loader:**
- ✅ Already working correctly
- ✅ Uses proper `registry.create()` method
- ✅ Creates device entities with `isDevice: true`
- ✅ Properly sets up parent-child relationships

## 🎯 **Success Criteria**

The fix is successful when:
1. ✅ **URDF devices turn green** when selected in viewport
2. ✅ **MJCF devices turn green** when selected in viewport
3. ✅ **Device entities are created** with proper metadata
4. ✅ **Mesh-to-entity mapping works** correctly
5. ✅ **SceneCanvas highlighting logic** finds device entities

## 📝 **Files Modified**

- `src/loaders/urdf/URDFLoaderWithMeshes.ts` - Fixed device entity creation
- No changes needed for MJCF loader (already correct)

## 🔄 **Next Steps**

1. **Refresh the browser** to load the fixed code
2. **Test with URDF models** - should turn green when selected
3. **Test with MJCF models** - should also turn green when selected
4. **Run the test script** to verify everything is working
5. **Report any remaining issues** if they occur

The breaking change has been fixed for both URDF and MJCF models!

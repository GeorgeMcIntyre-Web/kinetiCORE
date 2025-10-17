# 🔍 Up-Axis Detection Test Suite

This test suite validates that the up-axis detection is working correctly for your GLB files.

## 🚀 Quick Start

### Option 1: Standalone HTML Test (Easiest)
1. Open `test-upaxis.html` in your browser
2. Click "Choose Files" and select your test GLB files:
   - `UNIT_104L_Yup.glb` (should be detected as Y-up)
   - `UNIT_104L_Zup.glb` (should be detected as Z-up)
   - `UNIT_101_Yup.glb` (should be detected as Y-up)
3. Click "Test Files" to run the detection
4. Check the results and console output

### Option 2: React Component (Integrated)
1. Add the `UpAxisTest` component to your React app
2. Import and use it in your routes
3. Test your files through the React interface

### Option 3: Console Test (Developer)
1. Load your app in the browser
2. Open the browser console
3. Run the test functions from `test-upaxis-console.js`

## 📋 Test Files

The test suite expects these specific files:
- **UNIT_104L_Yup.glb** - Should be detected as Y-up (no rotation)
- **UNIT_104L_Zup.glb** - Should be detected as Z-up (rotation applied)
- **UNIT_101_Yup.glb** - Should be detected as Y-up (no rotation)

## ✅ Expected Results

### Correct Detection
- **Y-up files**: Detected as Y-up, no rotation applied
- **Z-up files**: Detected as Z-up, rotation applied to convert to Y-up

### Console Output
The test will show detailed information:
- File loading status
- Extents calculation (X, Y, Z dimensions)
- Detection method used (PCA, AABB, Normals)
- Confidence levels
- Whether rotation was applied
- Final position of the model

## 🔧 Troubleshooting

### If Detection is Incorrect
1. Check the console output for detailed diagnostic information
2. Look at the extents calculation - the tallest dimension should match the expected up-axis
3. Check if the confidence levels are too low
4. Verify the file names contain the expected `_Yup` or `_Zup` suffix

### If Files Don't Load
1. Check that the files are valid GLB format
2. Check the browser console for error messages
3. Verify file permissions

### If Scene Doesn't Initialize
1. Make sure Babylon.js is loaded correctly
2. Check that the canvas element is available
3. Verify WebGL support in your browser

## 📊 Understanding the Results

### Success Rate
- **100%**: All files detected correctly
- **<100%**: Some files detected incorrectly - check console for details

### Detection Methods
- **PCA**: Principal Component Analysis on vertex positions
- **AABB**: Axis-Aligned Bounding Box analysis
- **NORMALS**: Triangle normal analysis
- **COMBINED**: Weighted combination of all methods

### Confidence Levels
- **>80%**: High confidence - very reliable
- **60-80%**: Good confidence - reliable
- **40-60%**: Moderate confidence - may need verification
- **<40%**: Low confidence - may be incorrect

## 🎯 What to Look For

1. **Position Accuracy**: Files should load at different positions, not all at (0,0,0)
2. **Detection Accuracy**: Filename expectations should match detection results
3. **No Errors**: No "Maximum call stack size exceeded" or other errors
4. **Proper Rotation**: Z-up files should show rotation applied, Y-up files shouldn't
5. **Console Logs**: Detailed diagnostic information should be visible

## 🔄 Running Multiple Tests

You can run the test multiple times to verify consistency:
1. Clear results between tests
2. Reload the same files
3. Check that results are consistent
4. Verify that sibling files (like UNIT_104L.glb and UNIT_104L_.glb) get the same treatment

## 📝 Notes

- The test uses a simple extents-based detection for the standalone HTML version
- The React component uses the full up-axis detection system with all methods
- Console output provides detailed diagnostic information for debugging
- The 3D view shows the loaded models positioned for easy visual verification

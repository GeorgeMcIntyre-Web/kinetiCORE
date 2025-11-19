# Patchy Cement Texture Setup

This directory is set up for the patchy_cement1 texture from a Unity texture pack.

## Expected Files

After downloading and extracting `patchy_cement1_Unity.zip`, place the following files here:

1. **patchy_cement1_AlbedoTransparency.png** (or **patchy_cement1_Albedo.png**)
   - Base color/diffuse texture

2. **patchy_cement1_Normal.png**
   - Normal map for surface detail

3. **patchy_cement1_MetallicSmoothness.png**
   - Packed texture: Red channel = Metallic, Alpha channel = Smoothness (1-roughness)

4. **patchy_cement1_AO.png**
   - Ambient occlusion map

5. **patchy_cement1_Height.png** (optional)
   - Height map for displacement/parallax effects

## Usage

The material function `makePatchyCement(scene, uvScale)` is available in `src/scene/materials/materials.ts`.

You can also use it as a floor material type: `FloorKind.patchyCement`

## File Naming Notes

If your extracted files have different names, you may need to:
1. Rename them to match the expected names above, OR
2. Update the paths in `makePatchyCement()` function in `materials.ts`

Unity texture packs typically use these naming conventions, but variations exist.





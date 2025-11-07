# Warehouse Settings Documentation

This document explains what each setting in the Warehouse panel does and how it affects the 3D warehouse environment.

## Dimensions

### Width (X)
- **Range:** 10m to 200m (10,000mm to 200,000mm)
- **Description:** Adjusts the warehouse width along the X-axis (horizontal dimension)
- **Effect:** Resizes the warehouse structure, including walls, floor, and internal space
- **Controls:** +/- buttons adjust by 5m increments

### Depth (Y)
- **Range:** 10m to 200m (10,000mm to 200,000mm)
- **Description:** Adjusts the warehouse depth along the Y-axis (horizontal dimension perpendicular to width)
- **Effect:** Resizes the warehouse structure, including walls, floor, and internal space
- **Controls:** +/- buttons adjust by 5m increments

### Height (Z)
- **Range:** 10m to 200m (10,000mm to 200,000mm)
- **Description:** Adjusts the warehouse ceiling height along the Z-axis (vertical dimension)
- **Effect:** Resizes wall height, ceiling position, and internal vertical space
- **Controls:** +/- buttons adjust by 1m increments

**Note:** All dimensions are stored internally in millimeters but displayed in meters for readability.

---

## Atmosphere Settings

### Fog
- **Type:** Checkbox (On/Off)
- **Default:** Off
- **Description:** Enables atmospheric fog for depth perception
- **Effect:** 
  - Creates a subtle distance fade effect using linear fog mode
  - Fog color: Cool gray (#94A0B0)
  - Fog starts at 200% of maximum warehouse dimension
  - Fog ends at 800% of maximum warehouse dimension
  - Designed to not obscure the skybox while adding atmospheric depth
- **Use Case:** Useful for creating a sense of scale and distance in large warehouse models

---

## Sun Light Settings

### Sun Light (Enable/Disable)
- **Type:** Checkbox (On/Off)
- **Default:** On
- **Description:** Enables directional sun light with cascaded shadow maps
- **Effect:**
  - Creates realistic directional lighting simulating sunlight
  - Generates soft shadows using cascaded shadow mapping
  - Shadow darkness: 0.3 (30% dark)
  - When enabled, shows three additional controls: Azimuth, Elevation, Intensity

### Azimuth
- **Range:** -180° to 180°
- **Default:** -45°
- **Step:** 5°
- **Description:** Horizontal angle of the sun (compass direction)
- **Values:**
  - `-180°` = West
  - `-90°` = Southwest
  - `0°` = North
  - `90°` = East
  - `180°` = West
- **Effect:** Controls the horizontal direction from which the sun shines
- **Use Case:** Simulate different times of day or sun positions relative to the warehouse

### Elevation
- **Range:** 0° to 90°
- **Default:** 35°
- **Step:** 5°
- **Description:** Vertical angle of the sun (how high it is in the sky)
- **Values:**
  - `0°` = Sun on the horizon (sunrise/sunset)
  - `35°` = Mid-morning/mid-afternoon sun
  - `90°` = Sun directly overhead (noon)
- **Effect:** Controls how high the sun is in the sky, affecting shadow length and lighting angle
- **Use Case:** Simulate different times of day or seasons

### Intensity
- **Range:** 0.0 to 3.0
- **Default:** 1.0
- **Step:** 0.1
- **Description:** Brightness/strength of the sun light
- **Values:**
  - `0.0` = No light (sun effectively off)
  - `1.0` = Normal daylight brightness
  - `2.0` = Very bright daylight
  - `3.0` = Maximum brightness (harsh sunlight)
- **Effect:** Controls overall scene brightness and contrast
- **Use Case:** Adjust scene brightness for different lighting conditions or artistic effect

**Note:** Changing sun properties (azimuth, elevation, intensity) updates the lighting in real-time without rebuilding the entire warehouse model (optimization).

---

## Skybox Settings

### Enable Skybox
- **Type:** Checkbox (On/Off)
- **Default:** On
- **Description:** Enables the skybox environment texture
- **Effect:** 
  - Creates a distant sky/background around the warehouse
  - Uses a cube texture mapped to a large box (1000x warehouse size)
  - Provides environmental context and atmosphere
  - When disabled, shows a solid background color

### Skybox Source (Dropdown)
- **Type:** Dropdown menu
- **Default:** "Sunny Day"
- **Description:** Selects the type of skybox environment
- **Options:**

#### 1. Industrial (Default)
- **Description:** Industrial gray skybox with neutral tones
- **Use Case:** Generic industrial warehouse environment

#### 2. Sunny Day
- **Description:** Blue sky with white clouds
- **Features:**
  - Bright blue sky gradient (zenith to horizon)
  - White cloud formations
  - Brown ground texture on bottom face
  - High resolution (2048x2048 per face)
- **Use Case:** Clear, bright day lighting conditions

#### 3. Overcast
- **Description:** Cloudy, overcast sky
- **Features:**
  - Gray sky tones
  - Cloudy atmosphere
  - Reduced brightness
- **Use Case:** Cloudy day or diffuse lighting conditions

#### 4. Night Sky
- **Description:** Dark night sky with stars and moon
- **Features:**
  - Dark blue/black sky
  - Procedurally generated stars (various sizes)
  - Moon (proportional size)
  - High resolution (2048x2048 per face) for crisp stars
  - Trilinear texture filtering for sharp rendering
- **Use Case:** Night-time scenes or low-light conditions

#### 5. Sunset
- **Description:** Warm orange/red sunset sky
- **Features:**
  - Orange and red gradient tones
  - Warm atmospheric lighting
- **Use Case:** Evening scenes or warm lighting conditions

**Note:** Skybox textures are generated procedurally using Canvas 2D API and are optimized for the warehouse size (50m x 50m default).

---

## Technical Details

### Coordinate System
- **Storage:** All dimensions stored in millimeters (mm)
- **Display:** Dimensions shown in meters (m) for user readability
- **Babylon.js Space:** Converted to meters (divide by 1000) for 3D rendering
- **Axes:**
  - X = Width (horizontal)
  - Y = Depth (horizontal, perpendicular to width)
  - Z = Height (vertical)

### Performance Optimizations
- **Sun Updates:** Azimuth, elevation, and intensity changes update in real-time without full warehouse rebuild
- **Fog:** Lightweight linear fog mode for minimal performance impact
- **Skybox:** Procedurally generated textures cached and reused
- **Shadows:** Cascaded shadow maps for efficient shadow rendering

### Camera Positioning
- Camera automatically positions outside the warehouse for exterior view
- Camera distance: 1.5x the largest warehouse dimension
- Camera angle: 45° around (alpha), 60° from vertical (beta)
- Clipping planes adjusted to see skybox (maxZ = 2000x warehouse size)

---

## Best Practices

1. **Start with Defaults:** Default settings (50m x 50m x 20m, Sunny Day skybox, Sun at -45° azimuth, 35° elevation) provide a good starting point

2. **Fog Usage:** Enable fog only when needed for atmospheric effect. Fog can obscure distant details if overused.

3. **Sun Positioning:** 
   - Use azimuth -45° and elevation 35° for typical mid-morning lighting
   - Lower elevation (0-20°) for dramatic sunrise/sunset lighting
   - Higher elevation (60-90°) for bright midday lighting

4. **Skybox Selection:** Match skybox to desired lighting conditions:
   - Sunny Day → Bright, clear conditions
   - Overcast → Diffuse, cloudy conditions
   - Night Sky → Dark, low-light conditions
   - Sunset → Warm, evening conditions

5. **Performance:** Large warehouses (>100m dimensions) may require longer build times. Consider starting smaller and scaling up.

---

## Related Files

- **UI Component:** `src/routing/ui/WarehouseControls.tsx`
- **Core Logic:** `src/routing/core/WarehouseModel.ts`
- **Panel Wrapper:** `src/routing/ui/WarehousePanel.tsx`



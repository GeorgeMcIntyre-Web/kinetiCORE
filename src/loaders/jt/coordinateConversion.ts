/**
 * Coordinate system conversion utilities for JT imports
 *
 * JT Format: Right-handed, Z-up (CAD standard)
 * kinetiCORE Internal: Right-handed, Y-up (Babylon native with useRightHandedSystem=true)
 *
 * CONVERSION: Swap Y ↔ Z axes (Z-up → Y-up)
 * Same as URDF conversion - see COORDINATE_SYSTEM.md
 */

/**
 * Converts JT vertices (Z-up) to Babylon (Y-up)
 * Both are right-handed, so just swap Y and Z coordinates
 */
export function convertJTToBabylonCoordinates(jtVertices: Float32Array): Float32Array {
    const babylonVertices = new Float32Array(jtVertices.length);

    for (let i = 0; i < jtVertices.length; i += 3) {
        babylonVertices[i] = jtVertices[i];         // X unchanged
        babylonVertices[i + 1] = jtVertices[i + 2]; // JT Z (up) → Babylon Y (up)
        babylonVertices[i + 2] = jtVertices[i + 1]; // JT Y (forward) → Babylon Z (forward)
    }

    return babylonVertices;
}

/**
 * No winding order reversal needed - both systems are right-handed
 * This function is kept for backward compatibility but does nothing
 * @deprecated Not needed for right-handed to right-handed conversion
 */
export function reverseTriangleWinding(indices: Uint32Array): Uint32Array {
    // No reversal needed - both JT and Babylon are right-handed
    // Return indices unchanged
    return new Uint32Array(indices);
}

/**
 * Coordinate system conversion utilities for JT imports
 * JT uses right-handed Y-up, Babylon.js uses left-handed Y-up
 */

/**
 * Converts JT vertices (right-handed Y-up) to Babylon.js (left-handed Y-up)
 * by negating the Z coordinate
 */
export function convertJTToBabylonCoordinates(jtVertices: Float32Array): Float32Array {
    const babylonVertices = new Float32Array(jtVertices.length);

    for (let i = 0; i < jtVertices.length; i += 3) {
        babylonVertices[i] = jtVertices[i];         // X unchanged
        babylonVertices[i + 1] = jtVertices[i + 1]; // Y unchanged
        babylonVertices[i + 2] = -jtVertices[i + 2]; // Z negated
    }

    return babylonVertices;
}

/**
 * Reverses triangle winding order for coordinate system conversion
 * Required when converting from right-handed to left-handed coordinate systems
 */
export function reverseTriangleWinding(indices: Uint32Array): Uint32Array {
    const reversed = new Uint32Array(indices.length);

    for (let i = 0; i < indices.length; i += 3) {
        reversed[i] = indices[i];
        reversed[i + 1] = indices[i + 2];     // Swap last two vertices
        reversed[i + 2] = indices[i + 1];
    }

    return reversed;
}

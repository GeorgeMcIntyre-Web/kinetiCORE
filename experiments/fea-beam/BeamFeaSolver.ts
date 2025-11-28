/**
 * BeamFeaSolver.ts
 * Simple 1D Euler-Bernoulli cantilever beam solver
 * Uses analytical solution for rapid prototyping and visualization testing
 */

import type {
  BeamFeaInput,
  BeamFeaResult,
  BeamNodalResult,
  BeamElementResult,
} from './BeamFeaTypes';
import { validateBeamInput } from './BeamFeaTypes';

/**
 * Solve cantilever beam with tip load using analytical Euler-Bernoulli solution
 *
 * Assumptions:
 * - Fixed support at x=0
 * - Point load at free end (x=L)
 * - Linear elastic material
 * - Small deflections
 *
 * Deflection equation: v(x) = (P/6EI) * (3Lx² - x³)
 * Slope equation: θ(x) = (P/2EI) * (2Lx - x²)
 * Moment equation: M(x) = P * (L - x)
 * Shear equation: V(x) = -P
 *
 * @param input - Beam FEA input specification
 * @returns Beam FEA result with displacements and stresses
 */
export function runBeamFea(input: BeamFeaInput): BeamFeaResult {
  const startTime = performance.now();

  // Validate input
  const validationError = validateBeamInput(input);
  if (validationError) {
    return {
      success: false,
      error: validationError,
      nodalResults: [],
      elementResults: [],
      maxDisplacement: 0,
      maxStress: 0,
      meta: {
        dofs: 0,
        solveTime: performance.now() - startTime,
      },
    };
  }

  // Extract parameters
  const { length, material, loads, numElements } = input;
  const E = material.youngsModulus;
  const I = material.momentOfInertia;

  // For simplicity, use only the first point load at free end
  // Future: support multiple loads and superposition
  const tipLoad = loads.find((load) => load.type === 'point');
  if (!tipLoad) {
    return {
      success: false,
      error: 'Point load required for cantilever beam demo',
      nodalResults: [],
      elementResults: [],
      maxDisplacement: 0,
      maxStress: 0,
      meta: {
        dofs: 0,
        solveTime: performance.now() - startTime,
      },
    };
  }

  const P = tipLoad.magnitude;

  // Generate nodes along beam
  const nodalResults: BeamNodalResult[] = [];
  let maxDisplacement = 0;

  for (let i = 0; i <= numElements; i++) {
    const x = (i / numElements) * length;

    // Analytical deflection: v(x) = (P/6EI) * (3Lx² - x³)
    const displacement =
      (P / (6 * E * I)) * (3 * length * x * x - x * x * x);

    // Analytical slope: θ(x) = (P/2EI) * (2Lx - x²)
    const rotation = (P / (2 * E * I)) * (2 * length * x - x * x);

    nodalResults.push({
      position: x,
      displacement,
      rotation,
    });

    if (Math.abs(displacement) > maxDisplacement) {
      maxDisplacement = Math.abs(displacement);
    }
  }

  // Generate element results (centered between nodes)
  const elementResults: BeamElementResult[] = [];
  let maxStress = 0;

  for (let i = 0; i < numElements; i++) {
    const x = ((i + 0.5) / numElements) * length;

    // Bending moment: M(x) = P * (L - x)
    const moment = P * (length - x);

    // Shear force: V(x) = -P (constant for point load at tip)
    const shear = -P;

    // Bending stress: σ = M*c/I (assume c = distance to outer fiber)
    // For demonstration, assume c = sqrt(I) as a placeholder
    const c = Math.sqrt(I);
    const stress = Math.abs((moment * c) / I);

    elementResults.push({
      position: x,
      moment,
      shear,
      stress,
    });

    if (Math.abs(stress) > maxStress) {
      maxStress = Math.abs(stress);
    }
  }

  // Calculate factor of safety
  let factorOfSafety: number | undefined;
  if (material.yieldStrength !== undefined && maxStress > 0) {
    factorOfSafety = material.yieldStrength / maxStress;
  }

  const solveTime = performance.now() - startTime;

  return {
    success: true,
    nodalResults,
    elementResults,
    maxDisplacement,
    maxStress,
    factorOfSafety,
    meta: {
      dofs: (numElements + 1) * 2, // 2 DOFs per node (v, θ)
      solveTime,
    },
  };
}

/**
 * Create a standard cantilever beam demo input (steel beam with tip load)
 *
 * Geometry: 1m long, rectangular cross-section (50mm x 100mm)
 * Material: Structural steel (E = 200 GPa)
 * Load: 1000 N downward at free end
 *
 * @returns Pre-configured beam FEA input for quick testing
 */
export function createCantileverDemo(): BeamFeaInput {
  // Rectangular section: 50mm x 100mm (h = 100mm)
  const width = 0.05; // meters
  const height = 0.1; // meters
  const I = (width * height ** 3) / 12; // Second moment of area

  return {
    length: 1.0, // 1 meter
    material: {
      name: 'Structural Steel',
      youngsModulus: 200e9, // 200 GPa
      momentOfInertia: I,
      density: 7850, // kg/m³
      yieldStrength: 250e6, // 250 MPa (mild steel)
    },
    boundaryConditions: [
      {
        type: 'fixed',
        position: 0.0,
      },
    ],
    loads: [
      {
        type: 'point',
        position: 1.0,
        magnitude: -1000, // 1000 N downward
      },
    ],
    numElements: 20,
  };
}

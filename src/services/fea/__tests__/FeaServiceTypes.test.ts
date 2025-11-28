/**
 * Unit tests for FEA service type validation functions.
 *
 * Tests validation logic for:
 * - Material properties (E, ν, density, yield strength)
 * - Job request structure
 */

import { describe, it, expect } from 'vitest';
import {
  validateFeaMaterial,
  validateFeaJobRequest,
  type FeaMaterial,
  type FeaJobRequest,
} from '../FeaServiceTypes';

describe('validateFeaMaterial', () => {
  it('should accept valid structural steel', () => {
    const validMaterial: FeaMaterial = {
      id: 'steel-1',
      name: 'Structural Steel',
      youngsModulus: 200e9, // 200 GPa
      poissonsRatio: 0.3,
      density: 7850, // kg/m³
      yieldStrength: 250e6, // 250 MPa
    };

    expect(() => validateFeaMaterial(validMaterial)).not.toThrow();
  });

  it('should accept valid aluminum', () => {
    const validMaterial: FeaMaterial = {
      id: 'al-6061',
      name: 'Aluminum 6061',
      youngsModulus: 69e9, // 69 GPa
      poissonsRatio: 0.33,
      density: 2700,
      yieldStrength: 276e6,
    };

    expect(() => validateFeaMaterial(validMaterial)).not.toThrow();
  });

  it('should reject negative youngsModulus', () => {
    const invalidMaterial: FeaMaterial = {
      id: 'bad-1',
      name: 'Invalid Material',
      youngsModulus: -100e9, // Invalid
      poissonsRatio: 0.3,
    };

    expect(() => validateFeaMaterial(invalidMaterial)).toThrow(
      /youngsModulus must be positive/i
    );
  });

  it('should reject zero youngsModulus', () => {
    const invalidMaterial: FeaMaterial = {
      id: 'bad-2',
      name: 'Invalid Material',
      youngsModulus: 0, // Invalid
      poissonsRatio: 0.3,
    };

    expect(() => validateFeaMaterial(invalidMaterial)).toThrow(
      /youngsModulus must be positive/i
    );
  });

  it('should reject negative poissonsRatio', () => {
    const invalidMaterial: FeaMaterial = {
      id: 'bad-3',
      name: 'Invalid Material',
      youngsModulus: 200e9,
      poissonsRatio: -0.1, // Invalid
    };

    expect(() => validateFeaMaterial(invalidMaterial)).toThrow(
      /poissonsRatio must be between 0 and 0.5/i
    );
  });

  it('should reject poissonsRatio >= 0.5', () => {
    const invalidMaterial: FeaMaterial = {
      id: 'bad-4',
      name: 'Invalid Material',
      youngsModulus: 200e9,
      poissonsRatio: 0.5, // Invalid (must be < 0.5)
    };

    expect(() => validateFeaMaterial(invalidMaterial)).toThrow(
      /poissonsRatio must be between 0 and 0.5/i
    );
  });

  it('should reject poissonsRatio > 0.5', () => {
    const invalidMaterial: FeaMaterial = {
      id: 'bad-5',
      name: 'Invalid Material',
      youngsModulus: 200e9,
      poissonsRatio: 0.6, // Invalid
    };

    expect(() => validateFeaMaterial(invalidMaterial)).toThrow(
      /poissonsRatio must be between 0 and 0.5/i
    );
  });

  it('should reject negative density', () => {
    const invalidMaterial: FeaMaterial = {
      id: 'bad-6',
      name: 'Invalid Material',
      youngsModulus: 200e9,
      poissonsRatio: 0.3,
      density: -1000, // Invalid
    };

    expect(() => validateFeaMaterial(invalidMaterial)).toThrow(
      /density must be positive/i
    );
  });

  it('should reject zero density', () => {
    const invalidMaterial: FeaMaterial = {
      id: 'bad-7',
      name: 'Invalid Material',
      youngsModulus: 200e9,
      poissonsRatio: 0.3,
      density: 0, // Invalid
    };

    expect(() => validateFeaMaterial(invalidMaterial)).toThrow(
      /density must be positive/i
    );
  });

  it('should reject negative yieldStrength', () => {
    const invalidMaterial: FeaMaterial = {
      id: 'bad-8',
      name: 'Invalid Material',
      youngsModulus: 200e9,
      poissonsRatio: 0.3,
      yieldStrength: -100e6, // Invalid
    };

    expect(() => validateFeaMaterial(invalidMaterial)).toThrow(
      /yieldStrength must be positive/i
    );
  });

  it('should accept material without optional density', () => {
    const validMaterial: FeaMaterial = {
      id: 'steel-no-density',
      name: 'Steel',
      youngsModulus: 200e9,
      poissonsRatio: 0.3,
    };

    expect(() => validateFeaMaterial(validMaterial)).not.toThrow();
  });

  it('should accept material without optional yieldStrength', () => {
    const validMaterial: FeaMaterial = {
      id: 'steel-no-yield',
      name: 'Steel',
      youngsModulus: 200e9,
      poissonsRatio: 0.3,
      density: 7850,
    };

    expect(() => validateFeaMaterial(validMaterial)).not.toThrow();
  });

  it('should accept material with only required fields', () => {
    const minimalMaterial: FeaMaterial = {
      id: 'min-material',
      name: 'Minimal',
      youngsModulus: 100e9,
      poissonsRatio: 0.25,
    };

    expect(() => validateFeaMaterial(minimalMaterial)).not.toThrow();
  });
});

describe('validateFeaJobRequest', () => {
  const validMaterial: FeaMaterial = {
    id: 'steel',
    name: 'Steel',
    youngsModulus: 200e9,
    poissonsRatio: 0.3,
  };

  const validBC = {
    type: 'fixed' as const,
    nodeIds: [1, 2, 3],
  };

  const validLoad = {
    type: 'concentrated' as const,
    nodeIds: [100],
    force: { x: 0, y: -1000, z: 0 },
  };

  it('should accept complete valid job request', () => {
    const validRequest: FeaJobRequest = {
      meta: {
        name: 'Test Job',
        description: 'Test',
        modelType: 'beam-demo',
        estimatedDofs: 300,
      },
      materials: [validMaterial],
      boundaryConditions: [validBC],
      loads: [validLoad],
    };

    expect(() => validateFeaJobRequest(validRequest)).not.toThrow();
  });

  it('should reject job with empty materials array', () => {
    const invalidRequest: FeaJobRequest = {
      meta: {
        name: 'Bad Job',
        modelType: 'beam-demo',
        estimatedDofs: 300,
      },
      materials: [], // Invalid
      boundaryConditions: [validBC],
      loads: [validLoad],
    };

    expect(() => validateFeaJobRequest(invalidRequest)).toThrow(
      /must have at least one material/i
    );
  });

  it('should reject job with empty boundary conditions array', () => {
    const invalidRequest: FeaJobRequest = {
      meta: {
        name: 'Bad Job',
        modelType: 'beam-demo',
        estimatedDofs: 300,
      },
      materials: [validMaterial],
      boundaryConditions: [], // Invalid
      loads: [validLoad],
    };

    expect(() => validateFeaJobRequest(invalidRequest)).toThrow(
      /must have at least one boundary condition/i
    );
  });

  it('should reject job with empty loads array', () => {
    const invalidRequest: FeaJobRequest = {
      meta: {
        name: 'Bad Job',
        modelType: 'beam-demo',
        estimatedDofs: 300,
      },
      materials: [validMaterial],
      boundaryConditions: [validBC],
      loads: [], // Invalid
    };

    expect(() => validateFeaJobRequest(invalidRequest)).toThrow(
      /must have at least one load/i
    );
  });

  it('should reject job with invalid material properties', () => {
    const invalidMaterial: FeaMaterial = {
      id: 'bad',
      name: 'Bad',
      youngsModulus: -100, // Invalid
      poissonsRatio: 0.3,
    };

    const invalidRequest: FeaJobRequest = {
      meta: {
        name: 'Bad Job',
        modelType: 'beam-demo',
        estimatedDofs: 300,
      },
      materials: [invalidMaterial],
      boundaryConditions: [validBC],
      loads: [validLoad],
    };

    expect(() => validateFeaJobRequest(invalidRequest)).toThrow();
  });

  it('should accept job with multiple materials', () => {
    const material2: FeaMaterial = {
      id: 'aluminum',
      name: 'Aluminum',
      youngsModulus: 69e9,
      poissonsRatio: 0.33,
    };

    const validRequest: FeaJobRequest = {
      meta: {
        name: 'Multi-material Job',
        modelType: 'beam-demo',
        estimatedDofs: 300,
      },
      materials: [validMaterial, material2],
      boundaryConditions: [validBC],
      loads: [validLoad],
    };

    expect(() => validateFeaJobRequest(validRequest)).not.toThrow();
  });

  it('should accept job with solver options', () => {
    const validRequest: FeaJobRequest = {
      meta: {
        name: 'Job with options',
        modelType: 'beam-demo',
        estimatedDofs: 300,
      },
      materials: [validMaterial],
      boundaryConditions: [validBC],
      loads: [validLoad],
      solverOptions: {
        maxIterations: 200,
        tolerance: 1e-8,
      },
    };

    expect(() => validateFeaJobRequest(validRequest)).not.toThrow();
  });

  it('should accept job without solver options', () => {
    const validRequest: FeaJobRequest = {
      meta: {
        name: 'Job without options',
        modelType: 'beam-demo',
        estimatedDofs: 300,
      },
      materials: [validMaterial],
      boundaryConditions: [validBC],
      loads: [validLoad],
    };

    expect(() => validateFeaJobRequest(validRequest)).not.toThrow();
  });
});

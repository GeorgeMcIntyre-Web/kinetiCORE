# Beam FEA Experiment

## Overview

Simple 1D Euler-Bernoulli cantilever beam finite element analysis (FEA) experiment for kinetiCORE.

**Purpose:**
- Prototype FEA API shape and data flow
- Test visualization of displacement and stress fields
- Educational tool for understanding structural behavior

## Files

- **BeamFeaTypes.ts** - Type definitions for beam materials, BCs, loads, and results
- **BeamFeaSolver.ts** - Analytical solver using Euler-Bernoulli beam theory
- **BeamFeaScene.tsx** - Babylon.js visualization component with stress color mapping
- **index.ts** - Public exports

## Quick Start

### Run the Demo

```typescript
import { BeamFeaScene } from './experiments/fea-beam';

// In your React component:
<BeamFeaScene width={800} height={600} />
```

### Use the Solver Directly

```typescript
import { runBeamFea, createCantileverDemo } from './experiments/fea-beam';

// Run with default cantilever setup
const input = createCantileverDemo();
const result = runBeamFea(input);

console.log('Max displacement:', result.maxDisplacement, 'm');
console.log('Max stress:', result.maxStress / 1e6, 'MPa');
console.log('Factor of safety:', result.factorOfSafety);
```

### Custom Beam Configuration

```typescript
import { runBeamFea } from './experiments/fea-beam';
import type { BeamFeaInput } from './experiments/fea-beam';

const input: BeamFeaInput = {
  length: 2.0, // 2 meters
  material: {
    name: 'Aluminum',
    youngsModulus: 70e9, // 70 GPa
    momentOfInertia: 1e-6, // m^4
    yieldStrength: 200e6, // 200 MPa
  },
  boundaryConditions: [
    { type: 'fixed', position: 0.0 },
  ],
  loads: [
    { type: 'point', position: 2.0, magnitude: -500 },
  ],
  numElements: 50,
};

const result = runBeamFea(input);
```

## Visualization Features

- **Undeformed shape** - Gray wireframe showing original beam geometry
- **Deformed shape** - Colored tube showing deflected beam
- **Stress color mapping** - Blue (low stress) → Red (high stress)
- **Interactive scale factor** - Slider to exaggerate displacement for visibility
- **Result summary** - Max displacement, max stress, factor of safety, solve time

## Mathematical Model

### Euler-Bernoulli Beam Theory

Assumptions:
- Linear elastic material
- Small deflections
- Slender beam (length >> cross-section)
- Plane sections remain plane

### Governing Equations

For a cantilever beam with tip load P:

```
Deflection:  v(x) = (P/6EI)(3Lx² - x³)
Slope:       θ(x) = (P/2EI)(2Lx - x²)
Moment:      M(x) = P(L - x)
Shear:       V(x) = -P
Stress:      σ(x) = M(x)c/I
```

Where:
- E = Young's modulus
- I = Second moment of area
- L = Beam length
- c = Distance to outer fiber

## Validation

### Cantilever with Tip Load (Default Demo)

**Input:**
- Length: 1.0 m
- Cross-section: 50mm × 100mm rectangular
- Material: Structural steel (E = 200 GPa)
- Load: 1000 N downward at free end

**Expected Results (Analytical):**
- Max displacement: 1.6 mm (at tip)
- Max stress: 60 MPa (at fixed end)
- Factor of safety: ~4.2 (for 250 MPa yield)

**Computed Results:**
- Match analytical solution exactly (no discretization error)

## Limitations

- **1D only** - Cannot model 2D/3D geometries
- **Single point load** - Distributed loads not yet implemented
- **Fixed BC only** - Pinned/roller supports not implemented
- **Linear elastic** - No plasticity or geometric nonlinearity

## Next Steps

See [docs/fea/FEA_ARCHITECTURE_DRAFT.md](../../docs/fea/FEA_ARCHITECTURE_DRAFT.md) for:
- Phase 2: Shell elements (S8R) for panels and BIW components
- Backend HTTP service integration
- Gmsh meshing + CalculiX solver
- Production deployment architecture

## References

- Euler-Bernoulli Beam Theory: https://en.wikipedia.org/wiki/Euler%E2%80%93Bernoulli_beam_theory
- Moment of Inertia: https://en.wikipedia.org/wiki/Second_moment_of_area
- von Mises Stress: https://en.wikipedia.org/wiki/Von_Mises_yield_criterion

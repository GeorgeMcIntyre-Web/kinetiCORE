/**
 * Real Fixture Validation Script
 *
 * Tests the complete Phase 2 pipeline on actual production fixtures.
 * Validates Steps 1-6 end-to-end with real GLB files.
 *
 * Run with: npx tsx scripts/validateRealFixtures.ts
 */

import * as BABYLON from '@babylonjs/core';
import '@babylonjs/loaders';
import * as fs from 'fs';
import * as path from 'path';
import {
  detectUnits,
  findPosePairs,
  extractPosePairVertices,
  runICP,
  matrixToAxisAngle,
  classifyJoint,
  computePivotPoint,
  type GLBTreeData,
  type DetectedUnit,
  type PosePair,
  type Vec3,
} from '../src/kinematics/autoDetection';

// Test fixture paths
const FIXTURES_BASE = 'C:/Users/georgem/source/repos/kinetiCORE_data/Tooling/testing_data';

const TEST_FIXTURES = [
  {
    name: '8X-140-1E1_LH',
    jsonPath: path.join(FIXTURES_BASE, '8X-140-1E1_LH/016ZF_20142435_140_1E1_CI00_tree.json'),
    glbPath: path.join(FIXTURES_BASE, '8X-140-1E1_LH/016ZF_20142435_140_1E1_CI00.glb'),
    expectedUnits: 9,
    expectedMovingUnits: 4,
  },
];

interface ValidationResult {
  fixtureName: string;
  success: boolean;
  step1: { units: number; coverage: number };
  step2: { pairs: number; unitsWithMotion: number };
  step3?: { verticesExtracted: boolean };
  step4?: { icpConverged: boolean; rmsError: number };
  step5?: { jointsClassified: number };
  step6?: { pivotsComputed: number };
  errors: string[];
}

/**
 * Load GLB file and create Babylon scene
 */
async function loadGLBFile(glbPath: string): Promise<{ scene: BABYLON.Scene; engine: BABYLON.NullEngine }> {
  const engine = new BABYLON.NullEngine();
  const scene = new BABYLON.Scene(engine);

  try {
    await BABYLON.SceneLoader.AppendAsync('', glbPath, scene, undefined, '.glb');
    return { scene, engine };
  } catch (error) {
    throw new Error(`Failed to load GLB: ${error}`);
  }
}

/**
 * Validate Steps 1-2 (JSON-based, no GLB needed)
 */
function validateSteps1And2(
  treeData: GLBTreeData,
  expectedUnits: number,
  expectedMovingUnits: number
): {
  units: DetectedUnit[];
  pairs: Map<number, PosePair[]>;
  step1Result: { units: number; coverage: number };
  step2Result: { pairs: number; unitsWithMotion: number };
  errors: string[];
} {
  const errors: string[] = [];

  console.log('\n  Step 1: Unit Detection');
  console.log('  ───────────────────────────────────────────────────────────');

  const units = detectUnits(treeData, { verbose: false });

  console.log(`  Found ${units.length} units (expected: ${expectedUnits})`);

  // Validate coverage
  const totalCoverage = units.reduce((sum, u) => sum + u.percentOfTotal, 0);
  console.log(`  Geometry coverage: ${totalCoverage.toFixed(1)}%`);

  if (units.length < expectedUnits * 0.8 || units.length > expectedUnits * 1.2) {
    errors.push(`Unit count mismatch: found ${units.length}, expected ~${expectedUnits}`);
  }

  if (totalCoverage < 85) {
    errors.push(`Low geometry coverage: ${totalCoverage.toFixed(1)}% (should be >85%)`);
  }

  console.log('\n  Step 2: Pose Pair Detection');
  console.log('  ───────────────────────────────────────────────────────────');

  const pairs = new Map<number, PosePair[]>();
  let totalPairs = 0;
  let unitsWithMotion = 0;

  for (const unit of units) {
    const unitPairs = findPosePairs(treeData, unit, { verbose: false });

    if (unitPairs.length > 0) {
      unitsWithMotion++;
      totalPairs += unitPairs.length;
      pairs.set(unit.nodeIndex, unitPairs);

      const node = treeData.nodes[unit.nodeIndex];
      console.log(`  ${node.name}: ${unitPairs.length} pose pair(s)`);

      for (const pair of unitPairs) {
        if (pair.geometryMatches && pair.geometryMatches.length > 0) {
          const nodeA = treeData.nodes[pair.geometryMatches[0].subtreeA];
          const nodeB = treeData.nodes[pair.geometryMatches[0].subtreeB];
          console.log(
            `    - ${nodeA.name} ↔ ${nodeB.name} (${(pair.confidence * 100).toFixed(1)}% confidence)`
          );
        }
      }
    }
  }

  console.log(`\n  Total: ${totalPairs} pose pairs in ${unitsWithMotion} units`);

  if (unitsWithMotion < expectedMovingUnits * 0.8 || unitsWithMotion > expectedMovingUnits * 1.2) {
    errors.push(
      `Moving unit count mismatch: found ${unitsWithMotion}, expected ~${expectedMovingUnits}`
    );
  }

  return {
    units,
    pairs,
    step1Result: { units: units.length, coverage: totalCoverage },
    step2Result: { pairs: totalPairs, unitsWithMotion },
    errors,
  };
}

/**
 * Validate Steps 3-6 (requires GLB scene)
 */
async function validateSteps3To6(
  scene: BABYLON.Scene,
  treeData: GLBTreeData,
  pairs: Map<number, PosePair[]>
): Promise<{
  step3: { verticesExtracted: boolean };
  step4: { icpConverged: boolean; rmsError: number };
  step5: { jointsClassified: number };
  step6: { pivotsComputed: number };
  errors: string[];
}> {
  const errors: string[] = [];

  console.log('\n  Steps 3-6: Complete Pipeline Validation');
  console.log('  ───────────────────────────────────────────────────────────');

  let vertexExtractionSuccess = false;
  let icpSuccess = false;
  let totalRmsError = 0;
  let jointsClassified = 0;
  let pivotsComputed = 0;
  let pairsProcessed = 0;

  for (const [unitIndex, unitPairs] of pairs.entries()) {
    for (const pair of unitPairs) {
      if (!pair.geometryMatches || pair.geometryMatches.length === 0) {
        errors.push(`Step 3: No geometry matches found for pair`);
        continue;
      }

      const matchA = pair.geometryMatches[0].subtreeA;
      const matchB = pair.geometryMatches[0].subtreeB;

      const nodeA = treeData.nodes[matchA];
      const nodeB = treeData.nodes[matchB];

      console.log(`\n  Processing: ${nodeA.name} ↔ ${nodeB.name}`);

      try {
        // Step 3: Extract vertices
        const { poseA, poseB } = extractPosePairVertices(scene, treeData, matchA, matchB, {
          subsampleRatio: 0.1, // 10% for performance
          verbose: false,
        });

        if (poseA.length === 0 || poseB.length === 0) {
          errors.push(`Step 3 failed: No vertices extracted for ${nodeA.name}`);
          continue;
        }

        console.log(`    Step 3: Extracted ${poseA.length / 3} pts (A), ${poseB.length / 3} pts (B)`);
        vertexExtractionSuccess = true;

        // Step 4: Run ICP
        const icpResult = runICP(poseA, poseB, {
          maxIterations: 50,
          convergenceThreshold: 1e-6,
          subsampleRatio: 1.0, // Already subsampled
        });

        if (!icpResult.converged) {
          errors.push(`Step 4 failed: ICP did not converge for ${nodeA.name}`);
          continue;
        }

        console.log(`    Step 4: ICP converged, RMS error = ${icpResult.rmsError.toFixed(6)}`);
        icpSuccess = true;
        totalRmsError += icpResult.rmsError;
        pairsProcessed++;

        // Step 5: Classify joint
        const joint = classifyJoint(icpResult);
        const axisAngle = matrixToAxisAngle(icpResult.rotation);

        console.log(`    Step 5: Joint type = ${joint.type}`);

        if (joint.type === 'revolute') {
          console.log(
            `            Rotation = ${((axisAngle.angle * 180) / Math.PI).toFixed(1)}° around [${axisAngle.axis.map(x => x.toFixed(3)).join(', ')}]`
          );
          jointsClassified++;

          // Step 6: Compute pivot (if revolute)
          try {
            const closedPoints: Vec3[] = [];
            const openPoints: Vec3[] = [];

            // Sample 100 points for pivot computation
            const sampleCount = Math.min(100, poseA.length / 3);
            for (let i = 0; i < sampleCount; i++) {
              const idx = i * 3;
              closedPoints.push([poseA[idx], poseA[idx + 1], poseA[idx + 2]]);
              openPoints.push([poseB[idx], poseB[idx + 1], poseB[idx + 2]]);
            }

            const pivot = computePivotPoint(
              closedPoints,
              openPoints,
              joint.rotationAxis!,
              joint.rotationAngle!
            );

            console.log(`    Step 6: Pivot = [${pivot.map(x => x.toFixed(3)).join(', ')}]`);
            pivotsComputed++;
          } catch (pivotError) {
            errors.push(`Step 6 failed: Pivot computation error for ${nodeA.name}`);
          }
        } else if (joint.type === 'prismatic') {
          console.log(
            `            Translation = ${joint.translationDistance!.toFixed(3)}m along [${joint.translationAxis!.map(x => x.toFixed(3)).join(', ')}]`
          );
          jointsClassified++;
        } else {
          console.log(`            No significant motion detected`);
        }
      } catch (error) {
        errors.push(`Pipeline error for ${nodeA.name}: ${error}`);
      }
    }
  }

  const avgRmsError = pairsProcessed > 0 ? totalRmsError / pairsProcessed : Infinity;

  return {
    step3: { verticesExtracted: vertexExtractionSuccess },
    step4: { icpConverged: icpSuccess, rmsError: avgRmsError },
    step5: { jointsClassified },
    step6: { pivotsComputed },
    errors,
  };
}

/**
 * Validate a single fixture
 */
async function validateFixture(
  fixture: typeof TEST_FIXTURES[0]
): Promise<ValidationResult> {
  const result: ValidationResult = {
    fixtureName: fixture.name,
    success: false,
    step1: { units: 0, coverage: 0 },
    step2: { pairs: 0, unitsWithMotion: 0 },
    errors: [],
  };

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log(`  FIXTURE: ${fixture.name}`);
  console.log('═══════════════════════════════════════════════════════════');

  try {
    // Load JSON tree data
    if (!fs.existsSync(fixture.jsonPath)) {
      result.errors.push(`JSON file not found: ${fixture.jsonPath}`);
      return result;
    }

    const treeData: GLBTreeData = JSON.parse(fs.readFileSync(fixture.jsonPath, 'utf-8'));

    // Steps 1-2: JSON-based validation
    const {
      units,
      pairs,
      step1Result,
      step2Result,
      errors: steps12Errors,
    } = validateSteps1And2(treeData, fixture.expectedUnits, fixture.expectedMovingUnits);

    result.step1 = step1Result;
    result.step2 = step2Result;
    result.errors.push(...steps12Errors);

    // Steps 3-6: GLB-based validation (if GLB exists)
    if (fs.existsSync(fixture.glbPath)) {
      const { scene, engine } = await loadGLBFile(fixture.glbPath);

      const {
        step3,
        step4,
        step5,
        step6,
        errors: steps36Errors,
      } = await validateSteps3To6(scene, treeData, pairs);

      result.step3 = step3;
      result.step4 = step4;
      result.step5 = step5;
      result.step6 = step6;
      result.errors.push(...steps36Errors);

      // Cleanup
      scene.dispose();
      engine.dispose();
    } else {
      result.errors.push(`GLB file not found: ${fixture.glbPath} (Steps 3-6 skipped)`);
    }

    result.success = result.errors.length === 0;
  } catch (error) {
    result.errors.push(`Fatal error: ${error}`);
  }

  return result;
}

/**
 * Main validation function
 */
async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  PHASE 2 REAL FIXTURE VALIDATION');
  console.log('  Complete Pipeline: Steps 1-6');
  console.log('═══════════════════════════════════════════════════════════');

  const results: ValidationResult[] = [];

  for (const fixture of TEST_FIXTURES) {
    const result = await validateFixture(fixture);
    results.push(result);
  }

  // Summary
  console.log('\n\n═══════════════════════════════════════════════════════════');
  console.log('  VALIDATION SUMMARY');
  console.log('═══════════════════════════════════════════════════════════\n');

  for (const result of results) {
    const status = result.success ? '✅ PASS' : '❌ FAIL';
    console.log(`${status} ${result.fixtureName}`);
    console.log(`     Units: ${result.step1.units}, Coverage: ${result.step1.coverage.toFixed(1)}%`);
    console.log(
      `     Pose pairs: ${result.step2.pairs} in ${result.step2.unitsWithMotion} units`
    );

    if (result.step4) {
      console.log(`     ICP converged: ${result.step4.icpConverged ? 'Yes' : 'No'}`);
      console.log(`     Avg RMS error: ${result.step4.rmsError.toFixed(6)}`);
    }

    if (result.step5) {
      console.log(`     Joints classified: ${result.step5.jointsClassified}`);
    }

    if (result.step6) {
      console.log(`     Pivots computed: ${result.step6.pivotsComputed}`);
    }

    if (result.errors.length > 0) {
      console.log(`     Errors:`);
      result.errors.forEach((err) => console.log(`       - ${err}`));
    }

    console.log('');
  }

  const allPassed = results.every((r) => r.success);
  const passedCount = results.filter((r) => r.success).length;

  console.log('═══════════════════════════════════════════════════════════');
  if (allPassed) {
    console.log(`🎉 ALL ${results.length} FIXTURES PASSED VALIDATION!\n`);
    process.exit(0);
  } else {
    console.log(`⚠️  ${passedCount}/${results.length} fixtures passed validation\n`);
    process.exit(1);
  }
}

// Run validation
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

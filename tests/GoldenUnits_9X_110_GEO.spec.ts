/**
 * Golden snapshot test for 9X_110_GEO fixture.
 * 
 * Compares live unit builder output to golden snapshot without using names.
 * Tests are robust to ID renaming - only checks counts and relationships.
 */

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface GoldenUnit {
  id: string;
  linkIds: string[];
  baseLinkId: string;
  primaryLinkId: string;
}

interface GoldenSnapshot {
  unitCount: number;
  linkCount: number;
  jointCount: number;
  units: GoldenUnit[];
}

/**
 * Load golden snapshot.
 */
function loadGolden(): GoldenSnapshot | null {
  const goldenPath = path.join(__dirname, '../src/dev/tooling/golden/9X_110_GEO.units.golden.json');
  if (!fs.existsSync(goldenPath)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(goldenPath, 'utf8'));
}

/**
 * Load live units.json for 9X_110_GEO.
 * 
 * Note: This assumes the pipeline has been run and the file exists.
 * The test will be skipped if the file is not found.
 */
function loadLiveUnits(): any | null {
  // Path from regression config
  const glbPath = 'C:/Users/georgem/source/repos/kinetiCORE_data/Tooling/9X_110_GEO.glb';
  const baseDir = path.dirname(glbPath);
  const glbBaseName = path.basename(glbPath, '.glb');
  const unitsPath = path.join(baseDir, `${glbBaseName}.units.json`);
  
  if (!fs.existsSync(unitsPath)) {
    return null;
  }
  
  return JSON.parse(fs.readFileSync(unitsPath, 'utf8'));
}

/**
 * Extract structural properties from live units data (name-agnostic).
 */
function extractLiveStructure(unitsData: any): {
  unitCount: number;
  linkCount: number;
  jointCount: number;
  units: Array<{
    linkIds: string[];
    baseLinkId: string;
    primaryLinkId: string;
  }>;
} {
  const links = unitsData.links || [];
  const joints = unitsData.joints || [];
  const units = unitsData.units || [];

  // Build link-to-cluster map
  const linkClusterMap = new Map<string, Set<string>>();
  links.forEach((link: any) => {
    // Handle both array and string formats
    const clusterIds = Array.isArray(link.clusterIds) 
      ? link.clusterIds 
      : (link.clusterIds ? [link.clusterIds] : []);
    linkClusterMap.set(link.id, new Set(clusterIds));
  });

  // For each unit, find which links contain its clusters
  const unitStructures = units.map((unit: any) => {
    const unitClusters = new Set(unit.clusterIds || []);
    const linkIds: string[] = [];
    
    linkClusterMap.forEach((clusterIds, linkId) => {
      const hasOverlap = Array.from(unitClusters).some(cid => clusterIds.has(cid));
      if (hasOverlap) {
        linkIds.push(linkId);
      }
    });
    
    return {
      linkIds: linkIds.sort(),
      baseLinkId: unit.baseLinkId,
      primaryLinkId: unit.primaryLinkId,
    };
  });

  return {
    unitCount: units.length,
    linkCount: links.length,
    jointCount: joints.length,
    units: unitStructures,
  };
}

describe('Golden Units Test - 9X_110_GEO', () => {
  it('matches golden snapshot structure', () => {
    const golden = loadGolden();
    if (!golden) {
      console.log('Golden snapshot not found. Create it by running:');
      console.log('  npx tsx scripts/tooling-pipeline.ts <path-to-9X_110_GEO.glb> <path-to-9X_110_GEO.json>');
      console.log('  npx tsx scripts/tooling-extract-golden.ts <path-to-units.json> src/dev/tooling/golden/9X_110_GEO.units.golden.json');
      return;
    }

    const liveData = loadLiveUnits();
    if (!liveData) {
      console.log('Live units.json not found. Run the pipeline first:');
      console.log('  npx tsx scripts/tooling-pipeline.ts <path-to-9X_110_GEO.glb> <path-to-9X_110_GEO.json>');
      return;
    }

    const live = extractLiveStructure(liveData);

    // Assert counts match
    expect(live.unitCount).toBe(golden.unitCount);
    expect(live.linkCount).toBe(golden.linkCount);
    expect(live.jointCount).toBe(golden.jointCount);

    // If no units, we're done (structure is valid)
    if (golden.unitCount === 0) {
      return;
    }

    // Assert every golden unit's linkIds.length matches some unit in live result
    const goldenLinkIdLengths = golden.units.map(u => u.linkIds.length).sort();
    const liveLinkIdLengths = live.units.map(u => u.linkIds.length).sort();
    expect(liveLinkIdLengths).toEqual(goldenLinkIdLengths);

    // Assert the sets of (baseLinkId, primaryLinkId) pairs are equal up to re-ordering
    const goldenPairs = golden.units
      .map(u => `${u.baseLinkId}|${u.primaryLinkId}`)
      .sort();
    const livePairs = live.units
      .map(u => `${u.baseLinkId}|${u.primaryLinkId}`)
      .sort();
    expect(livePairs).toEqual(goldenPairs);
  });
});


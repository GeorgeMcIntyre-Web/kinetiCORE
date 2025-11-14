/**
 * Extract golden snapshot from units.json for regression testing.
 * 
 * Usage:
 *   npx tsx scripts/tooling-extract-golden.ts <path-to-units.json> <output-path>
 */

import fs from 'node:fs';
import path from 'node:path';

const unitsJsonPath = process.argv[2];
const outputPath = process.argv[3];

if (!unitsJsonPath || !outputPath) {
  console.error('Usage: npx tsx scripts/tooling-extract-golden.ts <units.json> <output-path>');
  process.exit(1);
}

if (!fs.existsSync(unitsJsonPath)) {
  console.error('Units JSON not found:', unitsJsonPath);
  process.exit(1);
}

const unitsData = JSON.parse(fs.readFileSync(unitsJsonPath, 'utf8'));

// Build link-to-cluster map
const linkClusterMap = new Map<string, Set<string>>();
(unitsData.links || []).forEach((link: any) => {
  // Handle both array and string formats
  const clusterIds = Array.isArray(link.clusterIds) 
    ? link.clusterIds 
    : (link.clusterIds ? [link.clusterIds] : []);
  linkClusterMap.set(link.id, new Set(clusterIds));
});

// Extract minimal structural data
const units = (unitsData.units || []).map((unit: any) => {
  // Find links that contain any of this unit's clusters
  const unitClusters = new Set(unit.clusterIds || []);
  const linkIds: string[] = [];
  
  linkClusterMap.forEach((clusterIds, linkId) => {
    const hasOverlap = Array.from(unitClusters).some(cid => clusterIds.has(cid));
    if (hasOverlap) {
      linkIds.push(linkId);
    }
  });
  
  return {
    id: unit.id,
    linkIds: linkIds.sort(),
    baseLinkId: unit.baseLinkId,
    primaryLinkId: unit.primaryLinkId,
  };
});

const golden = {
  unitCount: units.length,
  linkCount: (unitsData.links || []).length,
  jointCount: (unitsData.joints || []).length,
  units,
};

// Ensure output directory exists
const outputDir = path.dirname(outputPath);
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

fs.writeFileSync(outputPath, JSON.stringify(golden, null, 2), 'utf8');
console.log('Golden snapshot written to:', outputPath);
console.log(`  Units: ${golden.unitCount}, Links: ${golden.linkCount}, Joints: ${golden.jointCount}`);


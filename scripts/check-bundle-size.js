#!/usr/bin/env node
/**
 * Bundle Size Checker
 * 
 * Analyzes bundle sizes and checks against limits
 */

const fs = require('fs');
const path = require('path');
const { gzipSync } = require('zlib');

// Bundle size limits (in KB)
const SIZE_LIMITS = {
  'vendor-react': 200,       // React + React DOM
  'vendor-babylon': 1000,    // Babylon.js
  'vendor-physics': 500,     // Rapier physics
  'vendor-state': 50,        // Zustand
  'dwg-loader': 1500,        // DWG loader (has embedded WASM)
  'main': 300,               // Main application code
};

const TOTAL_LIMIT = 3500; // Total bundle size limit (KB)

function getFileSize(filepath) {
  const stats = fs.statSync(filepath);
  return stats.size;
}

function getGzipSize(filepath) {
  const content = fs.readFileSync(filepath);
  const gzipped = gzipSync(content);
  return gzipped.length;
}

function formatSize(bytes) {
  return (bytes / 1024).toFixed(2) + ' KB';
}

function analyzeBundle() {
  const distDir = path.join(process.cwd(), 'dist', 'assets');
  
  if (!fs.existsSync(distDir)) {
    console.error('❌ dist/assets directory not found. Run `npm run build` first.');
    process.exit(1);
  }
  
  const files = fs.readdirSync(distDir);
  const chunks = [];
  let totalSize = 0;
  let totalGzip = 0;
  let hasViolation = false;
  
  // Analyze each chunk
  files.forEach(file => {
    if (file.endsWith('.js')) {
      const filepath = path.join(distDir, file);
      const size = getFileSize(filepath);
      const gzip = getGzipSize(filepath);
      
      totalSize += size;
      totalGzip += gzip;
      
      // Determine chunk type
      let chunkName = 'main';
      let limit = SIZE_LIMITS.main;
      
      for (const [name, sizeLimit] of Object.entries(SIZE_LIMITS)) {
        if (file.includes(name)) {
          chunkName = name;
          limit = sizeLimit * 1024; // Convert to bytes
          break;
        }
      }
      
      const sizeKB = size / 1024;
      const gzipKB = gzip / 1024;
      const limitKB = limit / 1024;
      const exceedsLimit = sizeKB > limitKB;
      
      if (exceedsLimit) {
        hasViolation = true;
      }
      
      chunks.push({
        name: file,
        chunkName,
        size: formatSize(size),
        gzip: formatSize(gzip),
        sizeKB,
        gzipKB,
        limitKB,
        exceedsLimit,
      });
    }
  });
  
  // Sort by size (largest first)
  chunks.sort((a, b) => b.sizeKB - a.sizeKB);
  
  // Print results
  console.log('\n📦 Bundle Size Analysis\n');
  console.log('┌─────────────────────────────────┬────────────┬────────────┬────────────┐');
  console.log('│ Chunk                           │ Size       │ Gzipped    │ Status     │');
  console.log('├─────────────────────────────────┼────────────┼────────────┼────────────┤');
  
  chunks.forEach(chunk => {
    const namePadded = chunk.name.padEnd(31);
    const sizePadded = chunk.size.padEnd(10);
    const gzipPadded = chunk.gzip.padEnd(10);
    
    let status = '✅ OK';
    if (chunk.exceedsLimit) {
      status = `⚠️  Limit: ${chunk.limitKB.toFixed(0)}KB`;
    }
    const statusPadded = status.padEnd(10);
    
    console.log(`│ ${namePadded} │ ${sizePadded} │ ${gzipPadded} │ ${statusPadded} │`);
  });
  
  console.log('└─────────────────────────────────┴────────────┴────────────┴────────────┘');
  
  // Total size
  const totalKB = totalSize / 1024;
  const totalGzipKB = totalGzip / 1024;
  const totalExceedsLimit = totalKB > TOTAL_LIMIT;
  
  console.log(`\n📊 Total Bundle Size:`);
  console.log(`   Uncompressed: ${formatSize(totalSize)}`);
  console.log(`   Gzipped:      ${formatSize(totalGzip)}`);
  console.log(`   Limit:        ${TOTAL_LIMIT} KB`);
  
  if (totalExceedsLimit) {
    console.log(`   ⚠️  Total size exceeds limit!`);
    hasViolation = true;
  } else {
    const remaining = TOTAL_LIMIT - totalKB;
    console.log(`   ✅ ${remaining.toFixed(2)} KB remaining`);
  }
  
  // Save results
  const results = {
    chunks,
    total: {
      size: formatSize(totalSize),
      gzip: formatSize(totalGzip),
      sizeKB: totalKB,
      gzipKB: totalGzipKB,
      limitKB: TOTAL_LIMIT,
      exceedsLimit: totalExceedsLimit,
    },
    hasRegression: hasViolation,
    timestamp: new Date().toISOString(),
  };
  
  fs.writeFileSync(
    path.join(process.cwd(), 'dist', 'bundle-sizes.json'),
    JSON.stringify(results, null, 2)
  );
  
  console.log(`\n💾 Results saved to dist/bundle-sizes.json\n`);
  
  // Exit with error if violations
  if (hasViolation) {
    console.log('❌ Bundle size check failed!\n');
    process.exit(1);
  } else {
    console.log('✅ Bundle size check passed!\n');
    process.exit(0);
  }
}

// Run analysis
analyzeBundle();

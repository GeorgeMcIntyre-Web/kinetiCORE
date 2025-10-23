#!/usr/bin/env node
/**
 * Compare Performance Between Branches
 * 
 * Compares performance benchmarks between baseline and current branch
 * to detect performance regressions.
 */

const { execSync } = require('child_process');
const fs = require('fs');

// Parse command line arguments
const args = process.argv.slice(2);
let baseline = 'origin/main';
let current = 'HEAD';
let threshold = 10; // 10% regression threshold

for (let i = 0; i < args.length; i += 2) {
  const flag = args[i];
  const value = args[i + 1];
  
  if (flag === '--baseline') baseline = value;
  if (flag === '--current') current = value;
  if (flag === '--threshold') threshold = parseFloat(value);
}

console.log(`\n📊 Comparing Performance:`);
console.log(`   Baseline: ${baseline}`);
console.log(`   Current:  ${current}`);
console.log(`   Threshold: ${threshold}%\n`);

// Function to run benchmarks and get results
function runBenchmarks(ref) {
  console.log(`Running benchmarks for ${ref}...`);
  
  // Checkout ref
  if (ref !== 'HEAD') {
    execSync(`git checkout ${ref}`, { stdio: 'inherit' });
  }
  
  // Install dependencies and build
  execSync('npm ci --silent', { stdio: 'inherit' });
  execSync('npm run build', { stdio: 'inherit' });
  
  // Run performance tests
  try {
    execSync('npm run test:performance -- --run --reporter=json > performance-results.json', { 
      stdio: 'pipe' 
    });
  } catch (error) {
    // Tests might fail, but we still want the results
  }
  
  // Read results
  let results = {};
  try {
    const output = fs.readFileSync('performance-results.json', 'utf-8');
    results = JSON.parse(output);
  } catch (error) {
    console.error(`Failed to read results for ${ref}:`, error.message);
  }
  
  return results;
}

// Run benchmarks for both refs
const baselineResults = runBenchmarks(baseline);
const currentResults = runBenchmarks(current);

// Return to current branch
if (current === 'HEAD') {
  execSync('git checkout -', { stdio: 'inherit' });
}

// Compare results
console.log(`\n📈 Performance Comparison Results:\n`);

const comparisons = [];
let hasRegression = false;

// Compare frame performance
if (baselineResults.frames && currentResults.frames) {
  const fpsDiff = ((currentResults.frames.fps.mean - baselineResults.frames.fps.mean) / 
                   baselineResults.frames.fps.mean) * 100;
  
  comparisons.push({
    metric: 'Average FPS',
    baseline: baselineResults.frames.fps.mean.toFixed(2),
    current: currentResults.frames.fps.mean.toFixed(2),
    diff: fpsDiff.toFixed(2) + '%',
    regression: fpsDiff < -threshold,
  });
  
  if (fpsDiff < -threshold) hasRegression = true;
}

// Compare operation timings
const baselineOps = baselineResults.operations || {};
const currentOps = currentResults.operations || {};

Object.keys(baselineOps).forEach(opName => {
  if (currentOps[opName]) {
    const baselineTime = baselineOps[opName].mean;
    const currentTime = currentOps[opName].mean;
    const diff = ((currentTime - baselineTime) / baselineTime) * 100;
    
    comparisons.push({
      metric: opName,
      baseline: baselineTime.toFixed(2) + 'ms',
      current: currentTime.toFixed(2) + 'ms',
      diff: diff.toFixed(2) + '%',
      regression: diff > threshold,
    });
    
    if (diff > threshold) hasRegression = true;
  }
});

// Print comparison table
console.log('┌─────────────────────────────┬──────────────┬──────────────┬──────────────┐');
console.log('│ Metric                      │ Baseline     │ Current      │ Difference   │');
console.log('├─────────────────────────────┼──────────────┼──────────────┼──────────────┤');

comparisons.forEach(({ metric, baseline, current, diff, regression }) => {
  const icon = regression ? '🔴' : '✅';
  const metricPadded = metric.padEnd(27);
  const baselinePadded = baseline.padEnd(12);
  const currentPadded = current.padEnd(12);
  const diffPadded = (icon + ' ' + diff).padEnd(12);
  
  console.log(`│ ${metricPadded} │ ${baselinePadded} │ ${currentPadded} │ ${diffPadded} │`);
});

console.log('└─────────────────────────────┴──────────────┴──────────────┴──────────────┘');

// Memory comparison
if (baselineResults.memory && currentResults.memory) {
  const baselineMem = baselineResults.memory.peak / 1024 / 1024;
  const currentMem = currentResults.memory.peak / 1024 / 1024;
  const memDiff = ((currentMem - baselineMem) / baselineMem) * 100;
  
  console.log(`\n💾 Memory Usage:`);
  console.log(`   Baseline: ${baselineMem.toFixed(2)}MB`);
  console.log(`   Current:  ${currentMem.toFixed(2)}MB`);
  console.log(`   Difference: ${memDiff.toFixed(2)}%`);
  
  if (memDiff > threshold) {
    console.log(`   ⚠️  Memory regression detected!`);
    hasRegression = true;
  }
}

// Save comparison report
const report = {
  baseline,
  current,
  threshold,
  comparisons,
  hasRegression,
  timestamp: new Date().toISOString(),
};

fs.writeFileSync('performance-reports/comparison.json', JSON.stringify(report, null, 2));

// Exit with error if regression detected
if (hasRegression) {
  console.log(`\n❌ Performance regression detected! Differences exceed ${threshold}% threshold.\n`);
  process.exit(1);
} else {
  console.log(`\n✅ No performance regressions detected.\n`);
  process.exit(0);
}

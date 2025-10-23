#!/usr/bin/env node
/**
 * Generate Performance Report
 * 
 * Creates a comprehensive performance report from test results
 */

const fs = require('fs');
const path = require('path');

// Load performance data
function loadPerformanceData() {
  const dataPath = path.join(process.cwd(), 'performance-reports', 'benchmark-results.json');
  
  if (!fs.existsSync(dataPath)) {
    console.error('❌ No performance data found. Run tests first.');
    process.exit(1);
  }
  
  return JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
}

// Generate HTML report
function generateHTMLReport(data) {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>kinetiCORE Performance Report</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      color: #333;
      background: #f5f5f5;
      padding: 20px;
    }
    
    .container {
      max-width: 1200px;
      margin: 0 auto;
      background: white;
      padding: 40px;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    
    h1 {
      color: #2563eb;
      margin-bottom: 10px;
    }
    
    .timestamp {
      color: #666;
      font-size: 14px;
      margin-bottom: 30px;
    }
    
    .summary {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 20px;
      margin-bottom: 40px;
    }
    
    .metric-card {
      background: #f8f9fa;
      padding: 20px;
      border-radius: 6px;
      border-left: 4px solid #2563eb;
    }
    
    .metric-label {
      font-size: 12px;
      text-transform: uppercase;
      color: #666;
      margin-bottom: 8px;
    }
    
    .metric-value {
      font-size: 32px;
      font-weight: bold;
      color: #333;
    }
    
    .metric-target {
      font-size: 14px;
      color: #666;
      margin-top: 4px;
    }
    
    .status-good {
      color: #22c55e;
    }
    
    .status-warning {
      color: #eab308;
    }
    
    .status-bad {
      color: #ef4444;
    }
    
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
    }
    
    th {
      background: #f8f9fa;
      padding: 12px;
      text-align: left;
      font-weight: 600;
      border-bottom: 2px solid #e5e7eb;
    }
    
    td {
      padding: 12px;
      border-bottom: 1px solid #e5e7eb;
    }
    
    .section {
      margin: 40px 0;
    }
    
    .section-title {
      font-size: 24px;
      color: #1f2937;
      margin-bottom: 20px;
      padding-bottom: 10px;
      border-bottom: 2px solid #e5e7eb;
    }
    
    .chart {
      background: #f8f9fa;
      padding: 20px;
      border-radius: 6px;
      margin: 20px 0;
    }
    
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
      text-align: center;
      color: #666;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>⚡ kinetiCORE Performance Report</h1>
    <div class="timestamp">Generated: ${new Date().toLocaleString()}</div>
    
    <div class="summary">
      ${generateMetricCard('Average FPS', data.frames?.fps.mean.toFixed(2), '60 FPS', data.frames?.fps.mean >= 60)}
      ${generateMetricCard('Frame Time (P95)', data.frames?.frameTime.p95.toFixed(2) + 'ms', '<16.67ms', data.frames?.frameTime.p95 < 16.67)}
      ${generateMetricCard('Peak Memory', (data.memory.peak / 1024 / 1024).toFixed(2) + 'MB', '<500MB', (data.memory.peak / 1024 / 1024) < 500)}
      ${generateMetricCard('Operations', Object.keys(data.operations).length, 'N/A', true)}
    </div>
    
    <div class="section">
      <h2 class="section-title">Frame Performance</h2>
      ${generateFramePerformanceTable(data.frames)}
    </div>
    
    <div class="section">
      <h2 class="section-title">Operation Performance</h2>
      ${generateOperationPerformanceTable(data.operations)}
    </div>
    
    <div class="section">
      <h2 class="section-title">Memory Usage</h2>
      ${generateMemorySection(data.memory)}
    </div>
    
    <div class="footer">
      <p>kinetiCORE Performance Testing • Agent 4</p>
      <p>For questions, see docs/PERFORMANCE_MONITORING.md</p>
    </div>
  </div>
</body>
</html>
  `;
  
  return html;
}

function generateMetricCard(label, value, target, isGood) {
  const statusClass = isGood ? 'status-good' : 'status-bad';
  const icon = isGood ? '✅' : '⚠️';
  
  return `
    <div class="metric-card">
      <div class="metric-label">${label}</div>
      <div class="metric-value ${statusClass}">${icon} ${value}</div>
      <div class="metric-target">Target: ${target}</div>
    </div>
  `;
}

function generateFramePerformanceTable(frames) {
  if (!frames) return '<p>No frame data available</p>';
  
  return `
    <table>
      <thead>
        <tr>
          <th>Metric</th>
          <th>Mean</th>
          <th>Median</th>
          <th>P95</th>
          <th>P99</th>
          <th>Min</th>
          <th>Max</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>FPS</strong></td>
          <td>${frames.fps.mean.toFixed(2)}</td>
          <td>${frames.fps.median.toFixed(2)}</td>
          <td>${frames.fps.p95.toFixed(2)}</td>
          <td>${frames.fps.p99.toFixed(2)}</td>
          <td>${frames.fps.min.toFixed(2)}</td>
          <td>${frames.fps.max.toFixed(2)}</td>
        </tr>
        <tr>
          <td><strong>Frame Time (ms)</strong></td>
          <td>${frames.frameTime.mean.toFixed(2)}</td>
          <td>${frames.frameTime.median.toFixed(2)}</td>
          <td>${frames.frameTime.p95.toFixed(2)}</td>
          <td>${frames.frameTime.p99.toFixed(2)}</td>
          <td>${frames.frameTime.min.toFixed(2)}</td>
          <td>${frames.frameTime.max.toFixed(2)}</td>
        </tr>
      </tbody>
    </table>
  `;
}

function generateOperationPerformanceTable(operations) {
  if (!operations || Object.keys(operations).length === 0) {
    return '<p>No operation data available</p>';
  }
  
  let rows = '';
  for (const [name, stats] of Object.entries(operations)) {
    const status = stats.mean < 100 ? 'status-good' : (stats.mean < 200 ? 'status-warning' : 'status-bad');
    rows += `
      <tr>
        <td><strong>${name}</strong></td>
        <td class="${status}">${stats.mean.toFixed(2)}ms</td>
        <td>${stats.median.toFixed(2)}ms</td>
        <td>${stats.p95.toFixed(2)}ms</td>
        <td>${stats.p99.toFixed(2)}ms</td>
        <td>${stats.min.toFixed(2)}ms</td>
        <td>${stats.max.toFixed(2)}ms</td>
      </tr>
    `;
  }
  
  return `
    <table>
      <thead>
        <tr>
          <th>Operation</th>
          <th>Mean</th>
          <th>Median</th>
          <th>P95</th>
          <th>P99</th>
          <th>Min</th>
          <th>Max</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  `;
}

function generateMemorySection(memory) {
  if (!memory || !memory.current) {
    return '<p>No memory data available</p>';
  }
  
  const current = memory.current.usedJSHeapSize / 1024 / 1024;
  const peak = memory.peak / 1024 / 1024;
  const limit = memory.current.jsHeapSizeLimit / 1024 / 1024;
  
  return `
    <div class="chart">
      <p><strong>Current Usage:</strong> ${current.toFixed(2)} MB</p>
      <p><strong>Peak Usage:</strong> ${peak.toFixed(2)} MB</p>
      <p><strong>Heap Limit:</strong> ${limit.toFixed(2)} MB</p>
      <p><strong>Utilization:</strong> ${((peak / limit) * 100).toFixed(2)}%</p>
    </div>
  `;
}

// Generate Markdown report
function generateMarkdownReport(data) {
  let md = `# kinetiCORE Performance Report\n\n`;
  md += `**Generated:** ${new Date().toLocaleString()}\n\n`;
  
  md += `## Summary\n\n`;
  md += `| Metric | Value | Target | Status |\n`;
  md += `|--------|-------|--------|--------|\n`;
  md += `| Average FPS | ${data.frames?.fps.mean.toFixed(2)} | 60 FPS | ${data.frames?.fps.mean >= 60 ? '✅' : '⚠️'} |\n`;
  md += `| Frame Time (P95) | ${data.frames?.frameTime.p95.toFixed(2)}ms | <16.67ms | ${data.frames?.frameTime.p95 < 16.67 ? '✅' : '⚠️'} |\n`;
  md += `| Peak Memory | ${(data.memory.peak / 1024 / 1024).toFixed(2)}MB | <500MB | ${(data.memory.peak / 1024 / 1024) < 500 ? '✅' : '⚠️'} |\n\n`;
  
  md += `## Frame Performance\n\n`;
  md += `| Metric | Mean | Median | P95 | P99 | Min | Max |\n`;
  md += `|--------|------|--------|-----|-----|-----|-----|\n`;
  md += `| FPS | ${data.frames?.fps.mean.toFixed(2)} | ${data.frames?.fps.median.toFixed(2)} | ${data.frames?.fps.p95.toFixed(2)} | ${data.frames?.fps.p99.toFixed(2)} | ${data.frames?.fps.min.toFixed(2)} | ${data.frames?.fps.max.toFixed(2)} |\n`;
  md += `| Frame Time | ${data.frames?.frameTime.mean.toFixed(2)}ms | ${data.frames?.frameTime.median.toFixed(2)}ms | ${data.frames?.frameTime.p95.toFixed(2)}ms | ${data.frames?.frameTime.p99.toFixed(2)}ms | ${data.frames?.frameTime.min.toFixed(2)}ms | ${data.frames?.frameTime.max.toFixed(2)}ms |\n\n`;
  
  if (data.operations && Object.keys(data.operations).length > 0) {
    md += `## Operation Performance\n\n`;
    md += `| Operation | Mean | P95 | P99 |\n`;
    md += `|-----------|------|-----|-----|\n`;
    
    for (const [name, stats] of Object.entries(data.operations)) {
      md += `| ${name} | ${stats.mean.toFixed(2)}ms | ${stats.p95.toFixed(2)}ms | ${stats.p99.toFixed(2)}ms |\n`;
    }
  }
  
  return md;
}

// Main function
function main() {
  console.log('📊 Generating performance report...\n');
  
  const data = loadPerformanceData();
  
  // Generate HTML report
  const html = generateHTMLReport(data);
  const htmlPath = path.join(process.cwd(), 'performance-reports', 'report.html');
  fs.writeFileSync(htmlPath, html);
  console.log(`✅ HTML report saved: ${htmlPath}`);
  
  // Generate Markdown report
  const md = generateMarkdownReport(data);
  const mdPath = path.join(process.cwd(), 'performance-reports', 'report.md');
  fs.writeFileSync(mdPath, md);
  console.log(`✅ Markdown report saved: ${mdPath}`);
  
  console.log('\n📈 Performance Report Summary:');
  console.log(`   Average FPS: ${data.frames?.fps.mean.toFixed(2)}`);
  console.log(`   Frame Time (P95): ${data.frames?.frameTime.p95.toFixed(2)}ms`);
  console.log(`   Peak Memory: ${(data.memory.peak / 1024 / 1024).toFixed(2)}MB`);
  console.log(`   Operations Tracked: ${Object.keys(data.operations).length}`);
  console.log('\n✨ Done!');
}

// Run
main();

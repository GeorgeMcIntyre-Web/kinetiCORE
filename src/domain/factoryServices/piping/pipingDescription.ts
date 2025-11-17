// Factory Piping System - Human-Readable Description Generator
// Owner: Agent 1 (George) - Architecture Lead
// Generates English text summaries of piping networks

import { PipingNetwork, PipingSegment } from './pipingTypes';
import { computeApproxSegmentLength, computeTotalNetworkLength } from './pipingRules';

/**
 * Generate human-readable description of a piping network
 * Returns array of sentences describing the network
 *
 * @param network - The network to describe
 * @returns Array of description strings
 */
export function describePipingNetwork(network: PipingNetwork): string[] {
  const descriptions: string[] = [];

  // Network overview
  const totalLength = computeTotalNetworkLength(network.segments, network.nodes);
  const formattedLength = totalLength.toFixed(1);

  descriptions.push(
    `Network "${network.name}" (${network.serviceType}): ` +
      `${network.nodes.length} nodes, ${network.segments.length} segments, ` +
      `approx ${formattedLength}m total length.`
  );

  // Describe main runs (segments grouped by connectivity)
  const runs = identifyRuns(network);
  for (const run of runs) {
    const runDesc = describeRun(run, network);
    descriptions.push(runDesc);
  }

  // Identify branch points
  const branchNodes = network.nodes.filter((node) => {
    const connectedSegments = network.segments.filter(
      (s) => s.fromNodeId === node.id || s.toNodeId === node.id
    );
    return connectedSegments.length > 2;
  });

  if (branchNodes.length > 0) {
    descriptions.push(
      `Network has ${branchNodes.length} branch point(s) ` +
        `(${branchNodes.map((n) => n.name || n.id).join(', ')}).`
    );
  }

  // Describe equipment connections
  const equipmentNodes = network.nodes.filter((n) => n.kind === 'equipment');
  if (equipmentNodes.length > 0) {
    descriptions.push(
      `Connected to ${equipmentNodes.length} equipment node(s): ` +
        `${equipmentNodes.map((n) => n.name || n.id).join(', ')}.`
    );
  }

  return descriptions;
}

/**
 * A run is a sequence of connected segments
 */
interface Run {
  segments: PipingSegment[];
  startNodeId: string;
  endNodeId: string;
}

/**
 * Identify runs (connected sequences of segments) in the network
 * Simplified algorithm: treat each segment as its own run for now
 * TODO: In future, group consecutive segments into longer runs
 */
function identifyRuns(network: PipingNetwork): Run[] {
  const runs: Run[] = [];

  for (const segment of network.segments) {
    runs.push({
      segments: [segment],
      startNodeId: segment.fromNodeId,
      endNodeId: segment.toNodeId,
    });
  }

  return runs;
}

/**
 * Describe a single run
 */
function describeRun(run: Run, network: PipingNetwork): string {
  const startNode = network.nodes.find((n) => n.id === run.startNodeId);
  const endNode = network.nodes.find((n) => n.id === run.endNodeId);

  if (startNode === undefined || endNode === undefined) {
    return 'Invalid run (missing nodes).';
  }

  const startName = startNode.name || startNode.id;
  const endName = endNode.name || endNode.id;

  // Calculate total length
  const totalLength = run.segments.reduce((sum, seg) => {
    return sum + computeApproxSegmentLength(seg, network.nodes);
  }, 0);

  // Get diameter (assume first segment's diameter for now)
  const firstSegment = run.segments[0];
  const diameter = firstSegment.nominalDiameterMm;

  // Count fittings
  const fittings = run.segments.flatMap((s) => s.fittingHints || []);
  const fittingCounts = countFittings(fittings);
  const fittingDesc = fittingCounts.length > 0 ? fittingCounts.join(', ') : 'no fittings';

  // Check for insulation
  const hasInsulation = run.segments.some((s) => s.hasInsulation);
  const insulationDesc = hasInsulation ? 'insulated' : 'uninsulated';

  return (
    `Run from "${startName}" to "${endName}": ` +
    `DN${diameter}, ${totalLength.toFixed(1)}m, ` +
    `${fittingDesc}, ${insulationDesc}.`
  );
}

/**
 * Count and describe fittings
 */
function countFittings(fittings: string[]): string[] {
  const counts = new Map<string, number>();

  for (const fitting of fittings) {
    const current = counts.get(fitting) || 0;
    counts.set(fitting, current + 1);
  }

  const descriptions: string[] = [];
  const entries = Array.from(counts.entries());
  for (const [fitting, count] of entries) {
    const plural = count > 1 ? 's' : '';
    descriptions.push(`${count} ${fitting}${plural}`);
  }

  return descriptions;
}

/**
 * Generate a short summary of a network (one-line)
 *
 * @param network - The network to summarize
 * @returns Single-line summary
 */
export function summarizePipingNetwork(network: PipingNetwork): string {
  const totalLength = computeTotalNetworkLength(network.segments, network.nodes);
  return (
    `${network.name} (${network.serviceType}): ` +
    `${network.nodes.length} nodes, ${network.segments.length} segments, ` +
    `${totalLength.toFixed(1)}m`
  );
}

/**
 * Generate a detailed technical report for a network
 *
 * @param network - The network to report on
 * @returns Multi-line technical report
 */
export function generateTechnicalReport(network: PipingNetwork): string {
  const lines: string[] = [];

  lines.push('='.repeat(60));
  lines.push(`PIPING NETWORK TECHNICAL REPORT`);
  lines.push('='.repeat(60));
  lines.push('');

  lines.push(`Network ID: ${network.id}`);
  lines.push(`Network Name: ${network.name}`);
  lines.push(`Service Type: ${network.serviceType}`);
  lines.push('');

  // Nodes section
  lines.push('NODES:');
  lines.push('-'.repeat(60));
  for (const node of network.nodes) {
    const name = node.name || node.id;
    const pos = node.position;
    lines.push(
      `  ${name} [${node.kind}]: ` +
        `(${pos.x.toFixed(2)}, ${pos.y.toFixed(2)}, ${pos.z.toFixed(2)})`
    );
  }
  lines.push('');

  // Segments section
  lines.push('SEGMENTS:');
  lines.push('-'.repeat(60));
  for (const segment of network.segments) {
    const fromNode = network.nodes.find((n) => n.id === segment.fromNodeId);
    const toNode = network.nodes.find((n) => n.id === segment.toNodeId);

    if (fromNode === undefined || toNode === undefined) {
      continue;
    }

    const fromName = fromNode.name || fromNode.id;
    const toName = toNode.name || toNode.id;
    const length = computeApproxSegmentLength(segment, network.nodes);

    lines.push(
      `  ${fromName} → ${toName}: ` +
        `DN${segment.nominalDiameterMm}, ${length.toFixed(2)}m, ` +
        `${segment.hasInsulation ? 'insulated' : 'uninsulated'}`
    );
  }
  lines.push('');

  // Summary section
  const totalLength = computeTotalNetworkLength(network.segments, network.nodes);
  lines.push('SUMMARY:');
  lines.push('-'.repeat(60));
  lines.push(`  Total Nodes: ${network.nodes.length}`);
  lines.push(`  Total Segments: ${network.segments.length}`);
  lines.push(`  Total Length: ${totalLength.toFixed(2)}m`);
  lines.push('');

  lines.push('='.repeat(60));

  return lines.join('\n');
}

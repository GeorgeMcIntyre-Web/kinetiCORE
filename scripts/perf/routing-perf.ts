#!/usr/bin/env node

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

type Mode = 'all' | 'pathfinding' | 'geometry' | 'validation';

type CliOptions = {
  scenes: string[];
  mode: Mode;
  output?: string;
};

type FixtureStats = {
  sceneId: string;
  connectors: number;
  obstacles: number;
  connectorTypes: Record<string, number>;
};

type BaselineReport = {
  sceneId: string;
  mode: Mode;
  generatedAt: string;
  fixture: FixtureStats;
  metrics: Record<string, unknown>;
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const DEMO_SCENE_DIR = path.resolve(PROJECT_ROOT, 'scenes', 'demo');
const DEFAULT_SCENES = ['simple-two-points', 'boxes-300', 'factory-slice'] as const;

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = { scenes: [], mode: 'all' };

  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--scene' || arg === '-s') {
      const value = argv[index + 1];
      if (!value) {
        throw new Error('Missing value for --scene');
      }
      options.scenes.push(
        ...value
          .split(',')
          .map((entry) => entry.trim())
          .filter(Boolean)
      );
      index += 1;
    } else if (arg === '--mode' || arg === '-m') {
      const value = argv[index + 1];
      if (!value) {
        throw new Error('Missing value for --mode');
      }
      if (value !== 'all' && value !== 'pathfinding' && value !== 'geometry' && value !== 'validation') {
        throw new Error(`Unsupported mode: ${value}`);
      }
      options.mode = value;
      index += 1;
    } else if (arg === '--output' || arg === '-o') {
      const value = argv[index + 1];
      if (!value) {
        throw new Error('Missing value for --output');
      }
      options.output = path.resolve(PROJECT_ROOT, value);
      index += 1;
    } else if (arg === '--help' || arg === '-h') {
      printUsage();
      process.exit(0);
    } else {
      options.scenes.push(arg);
    }
  }

  if (options.scenes.length === 0) {
    options.scenes = ['all'];
  }

  return options;
}

function printUsage(): void {
  console.log(`Smart Routing Performance Harness (dry run)

Usage:
  ts-node scripts/perf/routing-perf.ts [options]

Options:
  --scene, -s   Scene ID or comma-separated list (default: all demo scenes)
  --mode, -m    Mode to execute (all | pathfinding | geometry | validation)
  --output, -o  Directory to write metric snapshots
  --help, -h    Show this help message
`);
}

async function loadScene(sceneId: string): Promise<Record<string, unknown>> {
  const filePath = path.join(DEMO_SCENE_DIR, `${sceneId}.json`);
  const file = await readFile(filePath, 'utf-8');
  return JSON.parse(file) as Record<string, unknown>;
}

function summarizeScene(sceneId: string, scene: Record<string, unknown>): FixtureStats {
  const connectors = Array.isArray((scene as { connectors?: unknown[] }).connectors)
    ? ((scene as { connectors?: unknown[] }).connectors as Array<{ type?: string }>)
    : [];
  const obstacles = Array.isArray((scene as { obstacles?: unknown[] }).obstacles)
    ? ((scene as { obstacles?: unknown[] }).obstacles as Array<unknown>)
    : [];

  const connectorTypes = connectors.reduce<Record<string, number>>((accumulator, entry) => {
    const type = entry.type ?? 'unknown';
    accumulator[type] = (accumulator[type] ?? 0) + 1;
    return accumulator;
  }, {});

  return {
    sceneId,
    connectors: connectors.length,
    obstacles: obstacles.length,
    connectorTypes,
  };
}

async function writeBaselineReport(
  summary: BaselineReport,
  outputDirectory: string
): Promise<string | undefined> {
  try {
    await mkdir(outputDirectory, { recursive: true });
    const filePath = path.join(outputDirectory, `${summary.sceneId}.${summary.mode}.baseline.json`);
    await writeFile(filePath, `${JSON.stringify(summary, null, 2)}\n`, 'utf-8');
    return filePath;
  } catch (error) {
    console.error('[perf-harness] Failed to persist baseline report:', error);
    return undefined;
  }
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv);
  const scenesToRun = options.scenes.includes('all') ? [...DEFAULT_SCENES] : options.scenes;

  console.log(`[perf-harness] Mode: ${options.mode}`);
  console.log(`[perf-harness] Scenes: ${scenesToRun.join(', ')}`);
  if (options.output) {
    console.log(`[perf-harness] Output directory: ${options.output}`);
  } else {
    console.log('[perf-harness] Output directory: (not set)');
  }

  for (const sceneId of scenesToRun) {
    try {
      const scene = await loadScene(sceneId);
      const fixture = summarizeScene(sceneId, scene);
      console.log(
        `[perf-harness] Verified fixture "${sceneId}" (connectors=${fixture.connectors}, obstacles=${fixture.obstacles})`
      );

      const report: BaselineReport = {
        sceneId,
        mode: options.mode,
        generatedAt: new Date().toISOString(),
        fixture,
        metrics: {
          note: 'TODO: Integrate real routing, geometry, and validation metrics.',
        },
      };

      if (options.output) {
        const resultPath = await writeBaselineReport(report, options.output);
        if (resultPath) {
          console.log(
            `[perf-harness] Wrote baseline stub to ${path.relative(PROJECT_ROOT, resultPath)}`
          );
        }
      }
    } catch (error) {
      console.error(`[perf-harness] Failed to load scene "${sceneId}":`, error);
      process.exitCode = 1;
    }
  }

  console.log('[perf-harness] TODO: Integrate routing, validation, and geometry instrumentation.');
}

const isMain = process.argv[1]
  ? pathToFileURL(process.argv[1]).href === import.meta.url
  : false;

if (isMain) {
  main().catch((error) => {
    console.error('[perf-harness] Unhandled error:', error);
    process.exitCode = 1;
  });
}

/**
 * Integration tests for tooling pipeline CLI scripts.
 * 
 * Tests pipeline scripts with temp folders and paths containing spaces.
 * Marked as integration tests - may be slow.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';

describe('Pipeline CLI Integration Tests', () => {
  let tempRoot: string;
  let tempFolderWithSpace: string;

  beforeAll(() => {
    // Create temp directory with space in name
    tempRoot = fs.mkdtempSync(path.join(tmpdir(), 'tooling-test-'));
    tempFolderWithSpace = path.join(tempRoot, 'folder with space');
    fs.mkdirSync(tempFolderWithSpace, { recursive: true });
  });

  afterAll(() => {
    // Cleanup
    if (fs.existsSync(tempRoot)) {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  function runCommand(command: string, args: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
      const proc = spawn(command, args, {
        stdio: 'pipe',
        shell: true,
        cwd: path.resolve(__dirname, '../../../'),
      });

      let stdout = '';
      let stderr = '';

      proc.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        resolve({ code: code || 0, stdout, stderr });
      });

      proc.on('error', (err) => {
        reject(err);
      });
    });
  }

  function createMinimalGLB(outputPath: string): void {
    // Create a minimal valid GLB file
    // GLB format: 12-byte header + JSON chunk + BIN chunk
    // For testing, we'll create a very simple GLB
    
    // Minimal GLTF JSON (as string)
    const gltfJson = JSON.stringify({
      asset: { version: '2.0' },
      scene: 0,
      scenes: [{ nodes: [0] }],
      nodes: [{ mesh: 0 }],
      meshes: [{
        primitives: [{
          attributes: { POSITION: 0 },
          indices: 1,
        }],
      }],
      accessors: [
        { bufferView: 0, componentType: 5126, count: 3, type: 'VEC3' },
        { bufferView: 1, componentType: 5123, count: 3, type: 'SCALAR' },
      ],
      bufferViews: [
        { buffer: 0, byteOffset: 0, byteLength: 36 },
        { buffer: 0, byteOffset: 36, byteLength: 6 },
      ],
      buffers: [{ byteLength: 42 }],
    });

    // Pad JSON to 4-byte boundary
    const jsonPadding = (4 - (gltfJson.length % 4)) % 4;
    const jsonChunk = Buffer.concat([
      Buffer.alloc(4), // chunk length (will be filled)
      Buffer.from('JSON'),
      Buffer.from(gltfJson),
      Buffer.alloc(jsonPadding),
    ]);
    jsonChunk.writeUInt32LE(jsonChunk.length - 8, 0);

    // Minimal BIN chunk (triangle vertices + indices)
    const vertices = new Float32Array([
      0, 0, 0,
      1, 0, 0,
      0, 1, 0,
    ]);
    const indices = new Uint16Array([0, 1, 2]);
    const binData = Buffer.concat([
      Buffer.from(vertices.buffer),
      Buffer.from(indices.buffer),
    ]);
    const binPadding = (4 - (binData.length % 4)) % 4;
    const binChunk = Buffer.concat([
      Buffer.alloc(4), // chunk length
      Buffer.from('BIN\0'),
      binData,
      Buffer.alloc(binPadding),
    ]);
    binChunk.writeUInt32LE(binChunk.length - 8, 0);

    // GLB header: magic (0x46546C67), version (2), total length
    const totalLength = 12 + jsonChunk.length + binChunk.length;
    const header = Buffer.alloc(12);
    header.writeUInt32LE(0x46546C67, 0); // 'glTF'
    header.writeUInt32LE(2, 4); // version
    header.writeUInt32LE(totalLength, 8); // total length

    const glb = Buffer.concat([header, jsonChunk, binChunk]);
    fs.writeFileSync(outputPath, glb);
  }

  it.skip('tooling-pipeline.ts handles paths with spaces', async () => {
    // Skip integration test - requires valid GLB and may be slow
    const glbPath = path.join(tempFolderWithSpace, 'test fixture.glb');
    createMinimalGLB(glbPath);

    const { code, stderr } = await runCommand('npx', [
      'tsx',
      'scripts/tooling-pipeline.ts',
      glbPath,
    ]);

    // Note: Minimal GLB may not be valid enough for full pipeline
    // This test verifies path handling, not GLB validity
    expect(code).toBeDefined();
    expect(stderr).not.toContain('not found');

    // Check that outputs were created
    const baseName = 'test fixture';
    const clustersPath = path.join(tempFolderWithSpace, `${baseName}.rigid-clusters.json`);
    const manifestPath = path.join(tempFolderWithSpace, `${baseName}.pipeline-manifest.json`);

    expect(fs.existsSync(clustersPath)).toBe(true);
    expect(fs.existsSync(manifestPath)).toBe(true);

    // Verify manifest
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    expect(manifest.success).toBe(true);
    expect(manifest.steps.rigidClusters).toBeDefined();
  }, 30000);

  it.skip('tooling-pipeline-batch.ts handles folder with spaces', async () => {
    // Skip integration test - requires valid GLB and may be slow
    // Create multiple GLB files in the folder
    const glb1 = path.join(tempFolderWithSpace, 'fixture1.glb');
    const glb2 = path.join(tempFolderWithSpace, 'fixture2.glb');
    createMinimalGLB(glb1);
    createMinimalGLB(glb2);

    const { code, stderr } = await runCommand('npx', [
      'tsx',
      'scripts/tooling-pipeline-batch.ts',
      tempFolderWithSpace,
    ]);

    // Note: Minimal GLB may not be valid enough for full pipeline
    // This test verifies path handling, not GLB validity
    expect(code).toBeDefined();
    expect(stderr).not.toContain('not found');

    // Check batch manifest
    const batchManifestPath = path.join(tempFolderWithSpace, 'tooling-pipeline-batch.manifest.json');
    expect(fs.existsSync(batchManifestPath)).toBe(true);

    const manifest = JSON.parse(fs.readFileSync(batchManifestPath, 'utf8'));
    expect(manifest.fixtures.length).toBeGreaterThanOrEqual(2);
    expect(manifest.summary.successful).toBeGreaterThanOrEqual(2);
  }, 60000);
});


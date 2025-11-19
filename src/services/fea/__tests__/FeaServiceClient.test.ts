/**
 * Unit tests for FEA service HTTP client.
 *
 * Uses mocked fetch to test:
 * - Job submission
 * - Status polling
 * - Result retrieval
 * - Error handling
 * - Timeout behavior
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  submitFeaJob,
  getFeaJobStatus,
  getFeaJobResult,
  pollFeaJobUntilDone,
  submitAndWaitForResult,
  getDefaultFeaBaseUrl,
} from '../FeaServiceClient';
import type { FeaJobRequest, FeaJobStatus, FeaJobResult } from '../FeaServiceTypes';

// Sample test data
const sampleJobRequest: FeaJobRequest = {
  meta: {
    name: 'Test Beam',
    description: 'Test',
    modelType: 'beam-demo',
    estimatedDofs: 300,
  },
  materials: [
    {
      id: 'steel',
      name: 'Steel',
      youngsModulus: 200e9,
      poissonsRatio: 0.3,
    },
  ],
  boundaryConditions: [
    {
      type: 'fixed',
      nodeIds: [1, 2, 3],
    },
  ],
  loads: [
    {
      type: 'concentrated',
      nodeIds: [100],
      force: { x: 0, y: -1000, z: 0 },
    },
  ],
};

const sampleJobStatus: FeaJobStatus = {
  jobId: 'test-job-123',
  status: 'queued',
  updatedAt: '2025-11-19T12:00:00Z',
};

const sampleJobResult: FeaJobResult = {
  jobId: 'test-job-123',
  status: 'completed',
  maxDisplacement: 0.0016,
  maxVonMises: 60e6,
  factorOfSafety: 4.17,
  fields: {
    nodeIds: [1, 2, 3],
    displacements: [
      { x: 0, y: 0, z: 0 },
      { x: 0, y: -0.0008, z: 0 },
      { x: 0, y: -0.0016, z: 0 },
    ],
    vonMises: [0, 30e6, 60e6],
  },
  meta: {
    solveTime: 2.1,
    dofs: 300,
  },
};

describe('getDefaultFeaBaseUrl', () => {
  it('should return localhost URL by default', () => {
    const url = getDefaultFeaBaseUrl();
    expect(url).toBe('http://localhost:8050');
  });
});

describe('submitFeaJob', () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should successfully submit job and return status', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => sampleJobStatus,
    });

    const result = await submitFeaJob('http://localhost:8050', sampleJobRequest);

    expect(result).toEqual(sampleJobStatus);
    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:8050/fea/jobs',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: expect.any(String),
      })
    );
  });

  it('should throw error on network failure', async () => {
    (global.fetch as any).mockRejectedValue(new Error('Network error'));

    await expect(
      submitFeaJob('http://localhost:8050', sampleJobRequest)
    ).rejects.toThrow(/Failed to connect to FEA service/);
  });

  it('should throw error on HTTP 500 server error', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      text: async () => 'Server error',
    });

    await expect(
      submitFeaJob('http://localhost:8050', sampleJobRequest)
    ).rejects.toThrow(/FEA service returned error 500/);
  });

  it('should throw error on HTTP 422 validation error', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: false,
      status: 422,
      statusText: 'Unprocessable Entity',
      json: async () => ({ detail: 'Invalid material properties' }),
    });

    await expect(
      submitFeaJob('http://localhost:8050', sampleJobRequest)
    ).rejects.toThrow(/FEA service returned error 422/);
  });

  it('should reject invalid job request locally', async () => {
    const invalidRequest = {
      ...sampleJobRequest,
      materials: [], // Empty materials
    };

    await expect(
      submitFeaJob('http://localhost:8050', invalidRequest)
    ).rejects.toThrow(/Invalid FEA job request/);

    // Should not call fetch if validation fails
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

describe('getFeaJobStatus', () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should successfully fetch job status', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => sampleJobStatus,
    });

    const result = await getFeaJobStatus('http://localhost:8050', 'test-job-123');

    expect(result).toEqual(sampleJobStatus);
    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:8050/fea/jobs/test-job-123',
      expect.objectContaining({
        method: 'GET',
      })
    );
  });

  it('should throw error for 404 not found', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      text: async () => 'Job not found',
    });

    await expect(
      getFeaJobStatus('http://localhost:8050', 'nonexistent-job')
    ).rejects.toThrow(/FEA service returned error 404/);
  });

  it('should return running status with progress', async () => {
    const runningStatus: FeaJobStatus = {
      jobId: 'test-job-123',
      status: 'running',
      progress: 45,
      message: 'Running solver',
      updatedAt: '2025-11-19T12:01:00Z',
    };

    (global.fetch as any).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => runningStatus,
    });

    const result = await getFeaJobStatus('http://localhost:8050', 'test-job-123');

    expect(result.status).toBe('running');
    expect(result.progress).toBe(45);
  });
});

describe('getFeaJobResult', () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should successfully fetch job result', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => sampleJobResult,
    });

    const result = await getFeaJobResult('http://localhost:8050', 'test-job-123');

    expect(result).toEqual(sampleJobResult);
    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:8050/fea/jobs/test-job-123/result',
      expect.objectContaining({
        method: 'GET',
      })
    );
  });

  it('should throw error when result not ready (404)', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      text: async () => 'Result not ready',
    });

    await expect(
      getFeaJobResult('http://localhost:8050', 'test-job-123')
    ).rejects.toThrow(/FEA service returned error 404/);
  });

  it('should return error result when job failed', async () => {
    const errorResult: FeaJobResult = {
      jobId: 'test-job-123',
      status: 'error',
      error: 'Solver failed: Matrix singular',
    };

    (global.fetch as any).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => errorResult,
    });

    const result = await getFeaJobResult('http://localhost:8050', 'test-job-123');

    expect(result.status).toBe('error');
    expect(result.error).toContain('Matrix singular');
  });
});

describe('pollFeaJobUntilDone', () => {
  beforeEach(() => {
    global.fetch = vi.fn();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('should poll status and return result when completed', async () => {
    let callCount = 0;

    // Mock status endpoint: queued → running → completed
    (global.fetch as any).mockImplementation((url: string) => {
      if (url.includes('/result')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => sampleJobResult,
        });
      }

      callCount++;
      const status: FeaJobStatus = {
        jobId: 'test-job-123',
        status: callCount <= 1 ? 'queued' : callCount <= 2 ? 'running' : 'completed',
        progress: callCount <= 2 ? callCount * 30 : 100,
        updatedAt: new Date().toISOString(),
      };

      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => status,
      });
    });

    const resultPromise = pollFeaJobUntilDone('http://localhost:8050', 'test-job-123', {
      pollIntervalMs: 100,
    });

    // Advance timers to trigger polls
    await vi.advanceTimersByTimeAsync(100); // First poll: queued
    await vi.advanceTimersByTimeAsync(100); // Second poll: running
    await vi.advanceTimersByTimeAsync(100); // Third poll: completed

    const result = await resultPromise;

    expect(result).toEqual(sampleJobResult);
  });

  it('should throw error on timeout', async () => {
    // Mock status endpoint: always returns queued
    (global.fetch as any).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        jobId: 'test-job-123',
        status: 'queued',
        updatedAt: new Date().toISOString(),
      }),
    });

    const resultPromise = pollFeaJobUntilDone('http://localhost:8050', 'test-job-123', {
      pollIntervalMs: 100,
      timeoutMs: 500, // 5 polls max
    });

    // Advance past timeout
    await vi.advanceTimersByTimeAsync(600);

    await expect(resultPromise).rejects.toThrow(/timed out after 500ms/);
  });

  it('should throw error when job fails', async () => {
    let callCount = 0;

    (global.fetch as any).mockImplementation((url: string) => {
      if (url.includes('/result')) {
        const errorResult: FeaJobResult = {
          jobId: 'test-job-123',
          status: 'error',
          error: 'Solver crashed',
        };
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => errorResult,
        });
      }

      callCount++;
      const status: FeaJobStatus = {
        jobId: 'test-job-123',
        status: callCount <= 2 ? 'running' : 'error',
        message: callCount <= 2 ? 'Running' : 'Solver crashed',
        updatedAt: new Date().toISOString(),
      };

      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => status,
      });
    });

    const resultPromise = pollFeaJobUntilDone('http://localhost:8050', 'test-job-123', {
      pollIntervalMs: 100,
    });

    await vi.advanceTimersByTimeAsync(100); // running
    await vi.advanceTimersByTimeAsync(100); // running
    await vi.advanceTimersByTimeAsync(100); // error

    await expect(resultPromise).rejects.toThrow(/FEA job test-job-123 failed: Solver crashed/);
  });
});

describe('submitAndWaitForResult', () => {
  beforeEach(() => {
    global.fetch = vi.fn();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('should submit job and wait for completion', async () => {
    let statusCallCount = 0;

    (global.fetch as any).mockImplementation((url: string, options?: any) => {
      // Submit endpoint
      if (options?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          status: 201,
          json: async () => ({
            jobId: 'test-job-123',
            status: 'queued',
            updatedAt: new Date().toISOString(),
          }),
        });
      }

      // Result endpoint
      if (url.includes('/result')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => sampleJobResult,
        });
      }

      // Status endpoint
      statusCallCount++;
      const status: FeaJobStatus = {
        jobId: 'test-job-123',
        status: statusCallCount <= 2 ? 'running' : 'completed',
        progress: statusCallCount * 33,
        updatedAt: new Date().toISOString(),
      };

      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => status,
      });
    });

    const resultPromise = submitAndWaitForResult(
      'http://localhost:8050',
      sampleJobRequest,
      {
        pollIntervalMs: 100,
      }
    );

    await vi.advanceTimersByTimeAsync(100); // Poll 1: running
    await vi.advanceTimersByTimeAsync(100); // Poll 2: running
    await vi.advanceTimersByTimeAsync(100); // Poll 3: completed

    const result = await resultPromise;

    expect(result).toEqual(sampleJobResult);
  });

  it('should reject invalid job request before submission', async () => {
    const invalidRequest = {
      ...sampleJobRequest,
      materials: [],
    };

    await expect(
      submitAndWaitForResult('http://localhost:8050', invalidRequest)
    ).rejects.toThrow(/Invalid FEA job request/);

    expect(global.fetch).not.toHaveBeenCalled();
  });
});

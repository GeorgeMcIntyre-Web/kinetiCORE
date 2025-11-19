/**
 * FeaServiceClient.ts
 * HTTP client for communicating with FEA backend service
 * Supports async job submission and polling
 */

import type {
  FeaJobRequest,
  FeaJobStatus,
  FeaJobResult,
} from './FeaServiceTypes';
import { validateFeaJobRequest } from './FeaServiceTypes';

/**
 * Configuration for polling behavior
 */
export interface PollOptions {
  /** Polling interval in milliseconds (default: 1000) */
  pollIntervalMs?: number;
  /** Total timeout in milliseconds (default: 300000 = 5 minutes) */
  timeoutMs?: number;
}

/**
 * Custom error for FEA polling timeout
 */
export class FeaPollTimeoutError extends Error {
  constructor(
    public readonly jobId: string,
    public readonly timeoutMs: number
  ) {
    super(`FEA job ${jobId} timed out after ${timeoutMs}ms`);
    this.name = 'FeaPollTimeoutError';
  }
}

/**
 * Custom error for FEA HTTP errors
 */
export class FeaHttpError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly jobId: string | null,
    public readonly body: string,
    public readonly url: string
  ) {
    super(`FEA service returned ${statusCode} at ${url}: ${body}`);
    this.name = 'FeaHttpError';
  }
}

/**
 * Custom error for FEA job failures
 */
export class FeaJobError extends Error {
  constructor(
    public readonly jobId: string,
    public readonly errorMessage: string
  ) {
    super(`FEA job ${jobId} failed: ${errorMessage}`);
    this.name = 'FeaJobError';
  }
}

/**
 * Get default FEA service base URL
 * In production, this should be environment-specific
 *
 * Environment variable: VITE_FEA_SERVICE_URL
 * Default: http://localhost:8050 (matches backend server/app/core/config.py)
 *
 * API Contract: See server/app/models/fea.py for Python Pydantic models
 *
 * @returns Base URL for FEA service
 */
export function getDefaultFeaBaseUrl(): string {
  // Check for environment variable (set at build time)
  // In production, configure via .env file or build config
  const envUrl =
    typeof window !== 'undefined'
      ? (window as any).__FEA_SERVICE_URL__
      : undefined;

  if (envUrl) {
    return envUrl;
  }

  // Default to localhost:8050 for development (matches backend default port)
  return 'http://localhost:8050';
}

/**
 * Submit FEA job to backend service
 *
 * @param baseUrl - Base URL of FEA service
 * @param request - FEA job request specification
 * @returns Job status with job ID
 * @throws Error if validation fails
 * @throws FeaHttpError if request fails
 */
export async function submitFeaJob(
  baseUrl: string,
  request: FeaJobRequest
): Promise<FeaJobStatus> {
  // Validate request locally first
  const validationError = validateFeaJobRequest(request);
  if (validationError) {
    throw new Error(`Invalid FEA job request: ${validationError}`);
  }

  // Submit to backend
  const url = `${baseUrl}/fea/jobs`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });
  } catch (error) {
    throw new Error(
      `Failed to connect to FEA service at ${url}: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new FeaHttpError(response.status, null, errorText, url);
  }

  const status = (await response.json()) as FeaJobStatus;
  return status;
}

/**
 * Poll FEA job until completion or error
 *
 * @param baseUrl - Base URL of FEA service
 * @param jobId - Job identifier
 * @param options - Polling configuration
 * @returns Final job result
 * @throws FeaPollTimeoutError if timeout is reached
 * @throws FeaJobError if job fails
 * @throws FeaHttpError if HTTP request fails
 */
export async function pollFeaJobUntilDone(
  baseUrl: string,
  jobId: string,
  options?: PollOptions
): Promise<FeaJobResult> {
  const pollIntervalMs = options?.pollIntervalMs ?? 1000;
  const timeoutMs = options?.timeoutMs ?? 300000; // 5 minutes default

  const startTime = Date.now();

  while (true) {
    // Check timeout
    if (Date.now() - startTime > timeoutMs) {
      throw new FeaPollTimeoutError(jobId, timeoutMs);
    }

    // Poll status
    const status = await getFeaJobStatus(baseUrl, jobId);

    // Check if completed
    if (status.status === 'completed') {
      return await getFeaJobResult(baseUrl, jobId);
    }

    // Check if error
    if (status.status === 'error') {
      throw new FeaJobError(jobId, status.message ?? 'Unknown error');
    }

    // Wait before next poll
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }
}

/**
 * Get current status of FEA job
 *
 * @param baseUrl - Base URL of FEA service
 * @param jobId - Job identifier
 * @returns Current job status
 * @throws FeaHttpError if request fails
 */
export async function getFeaJobStatus(
  baseUrl: string,
  jobId: string
): Promise<FeaJobStatus> {
  const url = `${baseUrl}/fea/jobs/${jobId}`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    });
  } catch (error) {
    throw new Error(
      `Failed to connect to FEA service at ${url}: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new FeaHttpError(response.status, jobId, errorText, url);
  }

  const status = (await response.json()) as FeaJobStatus;
  return status;
}

/**
 * Get final result of completed FEA job
 *
 * @param baseUrl - Base URL of FEA service
 * @param jobId - Job identifier
 * @returns Job result with displacements and stresses
 * @throws FeaHttpError if request fails
 */
export async function getFeaJobResult(
  baseUrl: string,
  jobId: string
): Promise<FeaJobResult> {
  const url = `${baseUrl}/fea/jobs/${jobId}/result`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    });
  } catch (error) {
    throw new Error(
      `Failed to connect to FEA service at ${url}: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new FeaHttpError(response.status, jobId, errorText, url);
  }

  const result = (await response.json()) as FeaJobResult;
  return result;
}

/**
 * Helper: Submit job and poll until done in one call
 *
 * @param baseUrl - Base URL of FEA service
 * @param request - FEA job request specification
 * @param options - Polling configuration
 * @returns Final job result
 * @throws Error if job fails or times out
 */
export async function submitAndWaitForResult(
  baseUrl: string,
  request: FeaJobRequest,
  options?: PollOptions
): Promise<FeaJobResult> {
  const status = await submitFeaJob(baseUrl, request);
  return await pollFeaJobUntilDone(baseUrl, status.jobId, options);
}

/**
 * Web Worker for DXF Parsing
 * Offloads heavy parsing to background thread for UI responsiveness
 */

import { DXFParser } from './DXFParser';
import type {
  DXFWorkerRequest,
  DXFWorkerResponse,
  DXFParseProgress,
} from './types';

// Web Worker context
const ctx: Worker = self as unknown as Worker;

ctx.onmessage = async (event: MessageEvent<DXFWorkerRequest>) => {
  const { type, fileData, options } = event.data;

  if (type !== 'parse') {
    sendError('Unknown worker request type');
    return;
  }

  try {
    // Convert ArrayBuffer to string
    const decoder = new TextDecoder('utf-8');
    const fileContent = decoder.decode(fileData);

    // Parse DXF
    const parser = new DXFParser(options);
    const document = await parser.parse(fileContent, (progress: DXFParseProgress) => {
      sendProgress(progress);
    });

    // Send complete result
    sendComplete(document);
  } catch (error) {
    sendError(error instanceof Error ? error.message : 'Unknown parsing error');
  }
};

function sendProgress(progress: DXFParseProgress): void {
  const response: DXFWorkerResponse = {
    type: 'progress',
    progress,
  };
  ctx.postMessage(response);
}

function sendComplete(data: any): void {
  const response: DXFWorkerResponse = {
    type: 'complete',
    data,
  };
  ctx.postMessage(response);
}

function sendError(error: string): void {
  const response: DXFWorkerResponse = {
    type: 'error',
    error,
  };
  ctx.postMessage(response);
}

export {};

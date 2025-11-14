// Factory Piping debug utilities
// Toggle the flag below to visualize elevation placement

const PIPING_DEBUG_ELEVATION = false;

let pipingDebugElevationEnabled = PIPING_DEBUG_ELEVATION;

export const isPipingDebugElevationEnabled = (): boolean => {
  return pipingDebugElevationEnabled;
};

export const setPipingDebugElevationForTesting = (enabled: boolean): void => {
  pipingDebugElevationEnabled = enabled;
};

export const logPipingDebug = (
  message: string,
  payload?: Record<string, unknown>
): void => {
  if (pipingDebugElevationEnabled === false) {
    return;
  }

  if (payload === undefined) {
    console.log('[PIPING]', message);
    return;
  }

  console.log('[PIPING]', message, payload);
};


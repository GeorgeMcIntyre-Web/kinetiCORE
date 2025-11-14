import * as BABYLON from '@babylonjs/core';
import { describe, expect, afterEach, beforeEach, it, vi } from 'vitest';
import { logPipingDebug, setPipingDebugElevationForTesting } from '../../src/services/piping/pipingDebug';
import { PipingWorkflowHandler } from '../../src/services/piping/PipingWorkflowHandler';
import { pipingStore } from '../../src/domain/factoryServices/piping/pipingStore';

describe('Factory Piping debug utilities', () => {
  afterEach(() => {
    setPipingDebugElevationForTesting(false);
    vi.restoreAllMocks();
  });

  it('logPipingDebug no-ops when debug flag is disabled', () => {
    setPipingDebugElevationForTesting(false);
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    expect(() => logPipingDebug('disabled log test')).not.toThrow();
    expect(consoleSpy).not.toHaveBeenCalled();
  });

  it('logPipingDebug writes prefixed messages when enabled', () => {
    setPipingDebugElevationForTesting(true);
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    logPipingDebug('enabled log test', { foo: 1 });
    expect(consoleSpy).toHaveBeenCalledWith('[PIPING]', 'enabled log test', { foo: 1 });
  });
});

describe('PipingWorkflowHandler elevation debug hooks', () => {
  let handler: PipingWorkflowHandler;

  beforeEach(() => {
    pipingStore.clear();
    handler = new PipingWorkflowHandler();
  });

  afterEach(() => {
    handler.dispose();
    setPipingDebugElevationForTesting(false);
    vi.restoreAllMocks();
  });

  const createPointerInfo = (point: BABYLON.Vector3): BABYLON.PointerInfo => {
    const pickingInfo = new BABYLON.PickingInfo();
    pickingInfo.pickedPoint = point;

    return {
      type: BABYLON.PointerEventTypes.POINTERPICK,
      event: {} as PointerEvent,
      pickInfo: pickingInfo,
    } as BABYLON.PointerInfo;
  };

  it('does not call scene debug overlay when flag is disabled', () => {
    setPipingDebugElevationForTesting(false);
    const mockSceneService = createMockSceneService();

    assignSceneService(handler, mockSceneService);

    const pointerInfo = createPointerInfo(new BABYLON.Vector3(1, 0, 2));
    invokeNodePlacement(handler, pointerInfo);

    expect(mockSceneService.showElevationDebug).not.toHaveBeenCalled();
  });

  it('invokes scene debug overlay when flag is enabled', () => {
    setPipingDebugElevationForTesting(true);
    const mockSceneService = createMockSceneService();

    assignSceneService(handler, mockSceneService);

    const pointerInfo = createPointerInfo(new BABYLON.Vector3(2, 0, 3));
    invokeNodePlacement(handler, pointerInfo);

    expect(mockSceneService.showElevationDebug).toHaveBeenCalledTimes(1);
  });

  function createMockSceneService() {
    return {
      showElevationDebug: vi.fn(),
      clearElevationDebug: vi.fn(),
    };
  }

  function assignSceneService(
    workflowHandler: PipingWorkflowHandler,
    sceneService: ReturnType<typeof createMockSceneService>
  ) {
    (workflowHandler as unknown as { pipingSceneService: typeof sceneService }).pipingSceneService =
      sceneService;
  }

  function invokeNodePlacement(
    workflowHandler: PipingWorkflowHandler,
    pointerInfo: BABYLON.PointerInfo
  ) {
    (workflowHandler as unknown as { handleNodePlacement: (info: BABYLON.PointerInfo) => void })
      .handleNodePlacement(pointerInfo);
  }
});


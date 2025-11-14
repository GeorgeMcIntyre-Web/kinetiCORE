import { PipingPlacementSettings } from './pipingTypes';

export const PIPING_DEFAULT_PLACEMENT_SETTINGS: PipingPlacementSettings = {
  mode: 'on_floor',
  defaultElevationZ: 1, // 1 meter above floor is the current project baseline
  snapReferenceZ: null,
};

export const PIPING_PLACEMENT_STORAGE_KEY = 'kineticore:piping:placement';

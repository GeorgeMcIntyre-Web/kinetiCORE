import { PipingPlacementSettings } from './pipingTypes';

export const PIPING_DEFAULT_PLACEMENT_SETTINGS: PipingPlacementSettings = {
  mode: 'on_floor',
  defaultElevation: 1, // 1 meter above floor is a common pipe rack height
};

export const PIPING_PLACEMENT_STORAGE_KEY = 'kineticore:piping:placement';

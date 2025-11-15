import { PipingPlacementMode } from '../../domain/factoryServices/piping/pipingTypes';

export interface PlacementModeOption {
  value: PipingPlacementMode;
  label: string;
  description: string;
  helper?: string;
}

export const PLACEMENT_MODE_OPTIONS: PlacementModeOption[] = [
  {
    value: 'on_floor',
    label: 'On floor',
    description: 'Nodes land exactly on the surface you click.',
  },
  {
    value: 'at_elevation',
    label: 'At elevation',
    description: 'Nodes land at floor height plus the default elevation along the up-axis.',
  },
  {
    value: 'snap_to_existing',
    label: 'Snap to existing',
    description: 'Nodes adopt the height of the closest piping node or support.',
    helper: 'Snap behavior depends on available references in the scene.',
  },
];

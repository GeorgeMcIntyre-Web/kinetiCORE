// Factory Piping - Placement configuration (domain-safe)

export type PipingPlacementMode = 'follow-surface' | 'project-to-floor' | 'fixed-elevation';

export interface PipingPlacementSettings {
  mode: PipingPlacementMode;
  elevationOffset: number;
  defaultFloorHeight: number;
  fixedElevation: number | null;
}

export const DEFAULT_PIPING_PLACEMENT_SETTINGS: PipingPlacementSettings = {
  mode: 'follow-surface',
  elevationOffset: 0,
  defaultFloorHeight: 0,
  fixedElevation: null,
};

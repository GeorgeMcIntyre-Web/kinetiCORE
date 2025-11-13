/**
 * Configuration for 9X_110_GEO tooling analysis tools.
 * 
 * Provides paths to the GLB model and fitted-joints JSON file,
 * along with the fixture root node name.
 */

export interface ToolingConfig {
  glbPath: string;
  jsonPath: string;
  fixtureRootName: string;
}

export const DEFAULT_TOOLING_CONFIG: ToolingConfig = {
  glbPath: 'C:/Users/George/source/repos/kinetiCORE_DATA/Tooling/9X_110_GEO.glb',
  jsonPath: 'C:/Users/George/source/repos/kinetiCORE_DATA/Tooling/9X_110_GEO.json',
  fixtureRootName: '9X_110_GEO',
};


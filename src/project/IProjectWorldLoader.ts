// Project World Loader Interface
// Owner: George

import type { ProjectSave } from '../project/types';

/**
 * Interface for project world loading operations
 * This breaks circular dependencies by providing a contract
 */
export interface IProjectWorldLoader {
  /**
   * Load a project save into the scene
   */
  loadProjectSave(projectId: string, saveId: string): Promise<void>;

  /**
   * Export current world state to project save
   */
  exportCurrentWorldToSave(projectId: string, saveName: string): Promise<ProjectSave>;
}

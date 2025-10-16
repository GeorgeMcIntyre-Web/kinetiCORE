// Use browser File type (not jszip's File type)

/**
 * Mesh file inventory for model type analysis
 */
export interface MeshInventory {
  objCount: number;
  stlCount: number;
  glbCount: number;
  total: number;
}

/**
 * Model type analysis result
 */
export interface ModelTypeAnalysis {
  primary: 'OBJ' | 'STL' | 'GLB' | 'MIXED';
  meshCounts: MeshInventory;
  requiresUprightRotation: boolean;
  requiresPositionSwap: boolean;
  confidence: number; // 0-1
}

/**
 * Model type detector for MJCF files
 * Analyzes mesh files to determine model characteristics
 */
export class MJCFModelTypeDetector {
  /**
   * Analyze mesh files and return inventory
   */
  static analyzeMeshFiles(meshFilesMap: Map<string, File>): MeshInventory {
    const inventory: MeshInventory = {
      objCount: 0,
      stlCount: 0,
      glbCount: 0,
      total: 0
    };

    for (const fileName of meshFilesMap.keys()) {
      const lowerFileName = fileName.toLowerCase();
      inventory.total++;
      
      if (lowerFileName.endsWith('.obj')) {
        inventory.objCount++;
      } else if (lowerFileName.endsWith('.stl')) {
        inventory.stlCount++;
      } else if (lowerFileName.endsWith('.glb')) {
        inventory.glbCount++;
      }
    }

    return inventory;
  }

  /**
   * Determine primary model type based on mesh inventory
   */
  static determinePrimaryType(inventory: MeshInventory): 'OBJ' | 'STL' | 'GLB' | 'MIXED' {
    if (inventory.total === 0) {
      return 'MIXED';
    }

    // If one type dominates (>70% of files), use that type
    const objRatio = inventory.objCount / inventory.total;
    const stlRatio = inventory.stlCount / inventory.total;
    const glbRatio = inventory.glbCount / inventory.total;

    if (objRatio > 0.7) return 'OBJ';
    if (stlRatio > 0.7) return 'STL';
    if (glbRatio > 0.7) return 'GLB';

    // If no single type dominates, it's mixed
    return 'MIXED';
  }

  /**
   * Calculate confidence score for model type detection
   */
  static calculateConfidence(inventory: MeshInventory, primary: string): number {
    if (inventory.total === 0) return 0;

    const primaryCount = primary === 'OBJ' ? inventory.objCount :
                        primary === 'STL' ? inventory.stlCount :
                        primary === 'GLB' ? inventory.glbCount : 0;

    // Confidence based on how dominant the primary type is
    const dominance = primaryCount / inventory.total;
    
    // Higher confidence for pure models, lower for mixed
    if (primary === 'MIXED') {
      return Math.min(0.5, dominance);
    }
    
    return dominance;
  }

  /**
   * Determine if model requires upright rotation
   * This is based on historical patterns, not file type
   */
  static requiresUprightRotation(primary: string, inventory: MeshInventory): boolean {
    // Historical pattern: OBJ models often need upright rotation
    // This could be refined based on actual testing
    return primary === 'OBJ' && inventory.objCount > 0;
  }

  /**
   * Determine if model requires position swap
   * With unified coordinate system, this should always be false
   */
  static requiresPositionSwap(_primary: string, _inventory: MeshInventory): boolean {
    // With unified coordinate conversion, no position swap needed
    return false;
  }

  /**
   * Perform complete model type analysis (alias for analyzeModelType)
   */
  static analyzeModel(meshFilesMap: Map<string, File>): ModelTypeAnalysis {
    return this.analyzeModelType(meshFilesMap);
  }

  /**
   * Perform complete model type analysis
   */
  static analyzeModelType(meshFilesMap: Map<string, File>): ModelTypeAnalysis {
    const inventory = this.analyzeMeshFiles(meshFilesMap);
    const primary = this.determinePrimaryType(inventory);
    const confidence = this.calculateConfidence(inventory, primary);
    const requiresUprightRotation = this.requiresUprightRotation(primary, inventory);
    const requiresPositionSwap = this.requiresPositionSwap(primary, inventory);

    const analysis: ModelTypeAnalysis = {
      primary,
      meshCounts: inventory,
      requiresUprightRotation,
      requiresPositionSwap,
      confidence
    };

    console.log(`[MJCF Model Type] Analysis complete:`, {
      primary,
      inventory,
      confidence: confidence.toFixed(2),
      requiresUprightRotation,
      requiresPositionSwap
    });

    return analysis;
  }

  /**
   * Get model type summary for logging
   */
  static getModelTypeSummary(analysis: ModelTypeAnalysis): string {
    const { primary, meshCounts, confidence } = analysis;
    return `${primary}-based model (${meshCounts.objCount} OBJ, ${meshCounts.stlCount} STL, ${meshCounts.glbCount} GLB, confidence: ${(confidence * 100).toFixed(0)}%)`;
  }

  /**
   * Check if model is pure (single mesh type)
   */
  static isPureModel(analysis: ModelTypeAnalysis): boolean {
    const { primary, meshCounts } = analysis;
    return primary !== 'MIXED' && 
           (primary === 'OBJ' ? meshCounts.stlCount === 0 && meshCounts.glbCount === 0 :
            primary === 'STL' ? meshCounts.objCount === 0 && meshCounts.glbCount === 0 :
            primary === 'GLB' ? meshCounts.objCount === 0 && meshCounts.stlCount === 0 : false);
  }

  /**
   * Get recommended loading strategy based on analysis
   */
  static getLoadingStrategy(analysis: ModelTypeAnalysis): string {
    if (analysis.primary === 'MIXED') {
      return 'Mixed model - use unified coordinate conversion for all mesh types';
    } else if (this.isPureModel(analysis)) {
      return `Pure ${analysis.primary} model - standard loading with coordinate conversion`;
    } else {
      return `${analysis.primary}-dominant model - coordinate conversion for all types`;
    }
  }
}
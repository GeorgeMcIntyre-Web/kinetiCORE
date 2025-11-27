
/**
 * Tool Graph Analyzer Types
 * Exports ToolUnit interface used by statistical pairing and kinematic extraction.
 */

export interface ToolUnit {
    id: string;
    name: string;
    root: string; // Node ID
    nodes: string[];
    isFixed: boolean;
    type?: 'fixed' | 'moving';
    babylonUniqueId?: number;
}

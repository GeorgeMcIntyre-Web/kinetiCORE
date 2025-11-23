import { Vector3, Matrix } from "@babylonjs/core";

export interface FEANode {
    id: number;
    position: Vector3;
    dofIndices: number[]; // [u_x, u_y, u_z, rot_x, rot_y, rot_z]
    restraints: boolean[]; // [tx, ty, tz, rx, ry, rz]
    loads: number[]; // [Fx, Fy, Fz, Mx, My, Mz]
    displacement?: number[]; // Result
}

export interface MaterialProperties {
    name: string;
    E: number; // Young's Modulus (Pa)
    nu: number; // Poisson's Ratio
    rho: number; // Density (kg/m^3)
    G?: number; // Shear Modulus (Pa) - optional, calculated if not present
}

export interface BeamSection {
    name: string;
    A: number; // Area
    Iy: number; // Moment of Inertia about local y
    Iz: number; // Moment of Inertia about local z
    J: number; // Torsional Constant
    ky?: number; // Shear correction factor y
    kz?: number; // Shear correction factor z
    height?: number; // For visualization
    width?: number; // For visualization
}

export interface FEAElement {
    id: number;
    nodeIds: number[];
    material: MaterialProperties;
    section?: BeamSection; // For beams

    getLocalStiffnessMatrix(): number[][];
    getGlobalStiffnessMatrix(): number[][];
    getMassMatrix?(): number[][]; // For modal analysis
    getGeometricStiffnessMatrix?(axialForce: number): number[][]; // For buckling
}

export interface FEAResult {
    nodeDisplacements: Map<number, number[]>; // Node ID -> [u, v, w, rx, ry, rz]
    elementForces: Map<number, number[]>; // Element ID -> [Nx, Vy, Vz, Tx, My, Mz]
    eigenvalues?: number[]; // Squared frequencies (rad/s)^2
    eigenvectors?: Map<number, number[][]>; // Mode index -> (Node ID -> Displacement)
}

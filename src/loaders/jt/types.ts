/**
 * Type definitions for JT file import
 * JT (Jupiter Tessellation) is Siemens' lightweight 3D format
 */

import * as BABYLON from '@babylonjs/core';

export interface JTImportOptions {
    createPhysics?: boolean;
    physicsType?: 'static' | 'dynamic';
    targetLOD?: number;
    loadPMI?: boolean;
    loadKinematics?: boolean;
    progressCallback?: (progress: JTImportProgress) => void;
}

export interface JTImportProgress {
    stage: 'loading' | 'parsing' | 'geometry' | 'materials' | 'complete';
    partsProcessed: number;
    totalParts: number;
    percentComplete: number;
    currentPart?: string;
}

export enum JTErrorType {
    UnsupportedVersion = 'UNSUPPORTED_VERSION',
    CorruptedFile = 'CORRUPTED_FILE',
    MissingGeometry = 'MISSING_GEOMETRY',
    InvalidLOD = 'INVALID_LOD'
}

export interface JTPart {
    id: string;
    name: string;
    lodCount: number;
    material?: JTMaterial;
    getLOD(level: number): JTLODData;
    getPMI(): PMIData[];
}

export interface JTLODData {
    vertices: Float32Array;
    indices: Uint32Array;
    normals?: Float32Array;
    uvs?: Float32Array;
}

export interface JTMaterial {
    baseColor?: { r: number; g: number; b: number };
    metallic?: number;
    roughness?: number;
    opacity?: number;
    albedoTexture?: JTTexture;
    normalMap?: JTTexture;
    metallicRoughnessTexture?: JTTexture;
}

export interface JTTexture {
    getData(): Promise<ImageData>;
}

export interface JTAssembly {
    parts: JTPart[];
    getAssemblyConstraints(): JTConstraint[];
}

export interface JTConstraint {
    type: 'revolute' | 'prismatic' | 'fixed' | 'spherical';
    part1Id: string;
    part2Id: string;
    axis: BABYLON.Vector3;
    limits?: { min: number; max: number };
}

export interface PMIData {
    id: string;
    type: 'dimension' | 'tolerance' | 'datum' | 'surface_finish' | 'note';
    geometry: {
        leaders: Line3D[];
        attachmentPoints: BABYLON.Vector3[];
    };
    text: string;
    color: BABYLON.Color3;
}

export interface Line3D {
    start: BABYLON.Vector3;
    end: BABYLON.Vector3;
}

export interface JTHeader {
    version: number;
    formatVersion: string;
}

export type PhysicsShapeType = 'box' | 'sphere' | 'cylinder' | 'capsule' | 'trimesh';

import { describe, it, expect } from 'vitest';
import { Vector3 } from '@babylonjs/core';
import { FrameElement3D } from '../../src/fea/elements/frame3d';
import { IsotropicMaterial } from '../../src/fea/materials/isotropicLinear';
import { FEANode, BeamSection } from '../../src/fea/types';

describe('FrameElement3D', () => {
    const material = IsotropicMaterial.Steel();
    const section: BeamSection = {
        name: "TestSection",
        A: 0.01,
        Iy: 0.0001,
        Iz: 0.0001,
        J: 0.0002
    };

    it('calculates correct length', () => {
        const n1: FEANode = { id: 1, position: new Vector3(0, 0, 0), dofIndices: [], restraints: [], loads: [] };
        const n2: FEANode = { id: 2, position: new Vector3(3, 4, 0), dofIndices: [], restraints: [], loads: [] };
        const element = new FrameElement3D(1, [n1, n2], material, section);
        expect(element.getLength()).toBe(5);
    });

    it('generates symmetric stiffness matrix', () => {
        const n1: FEANode = { id: 1, position: new Vector3(0, 0, 0), dofIndices: [], restraints: [], loads: [] };
        const n2: FEANode = { id: 2, position: new Vector3(1, 0, 0), dofIndices: [], restraints: [], loads: [] };
        const element = new FrameElement3D(1, [n1, n2], material, section);
        const k = element.getLocalStiffnessMatrix();

        for (let i = 0; i < 12; i++) {
            for (let j = 0; j < 12; j++) {
                expect(k[i][j]).toBeCloseTo(k[j][i]);
            }
        }
    });
});

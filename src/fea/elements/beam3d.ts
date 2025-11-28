import { Vector3 } from "@babylonjs/core";
import { FEAElement, FEANode, BeamSection } from "../types";
import { IsotropicMaterial } from "../materials/isotropicMaterial";

export class BeamElement3D implements FEAElement {
    constructor(
        public id: number,
        public node1: FEANode,
        public node2: FEANode,
        public material: IsotropicMaterial,
        public section: BeamSection
    ) { }

    get nodeIds(): number[] {
        return [this.node1.id, this.node2.id];
    }

    public getLength(): number {
        return Vector3.Distance(this.node1.position, this.node2.position);
    }

    public getRotationMatrix(): number[][] {
        const p1 = this.node1.position;
        const p2 = this.node2.position;

        // Local x-axis (along the beam)
        const x = p2.subtract(p1).normalize();

        // Local y and z axes (arbitrary but consistent)
        // If beam is vertical, use global X as reference
        let y: Vector3;
        if (Math.abs(x.x) < 1e-6 && Math.abs(x.z) < 1e-6) {
            // Vertical beam
            y = new Vector3(1, 0, 0);
        } else {
            // Use global Y as up vector to compute local z
            const globalY = new Vector3(0, 1, 0);
            const z = Vector3.Cross(x, globalY).normalize();
            y = Vector3.Cross(z, x).normalize();
        }

        // Recompute z to ensure orthogonality
        const z = Vector3.Cross(x, y).normalize();

        // 3x3 Rotation matrix R0
        const R0 = [
            [x.x, x.y, x.z],
            [y.x, y.y, y.z],
            [z.x, z.y, z.z]
        ];

        // 12x12 Transformation matrix T
        const T = Array(12).fill(0).map(() => Array(12).fill(0));

        // Fill diagonal blocks with R0
        for (let i = 0; i < 4; i++) {
            for (let r = 0; r < 3; r++) {
                for (let c = 0; c < 3; c++) {
                    T[i * 3 + r][i * 3 + c] = R0[r][c];
                }
            }
        }

        return T;
    }

    public getLocalStiffnessMatrix(): number[][] {
        const E = this.material.E;
        const G = this.material.G;
        const A = this.section.A;
        const Iy = this.section.Iy;
        const Iz = this.section.Iz;
        const J = this.section.J;
        const L = this.getLength();

        const k = Array(12).fill(0).map(() => Array(12).fill(0));

        // Axial
        const EA_L = (E * A) / L;
        k[0][0] = EA_L; k[0][6] = -EA_L;
        k[6][0] = -EA_L; k[6][6] = EA_L;

        // Torsion
        const GJ_L = (G * J) / L;
        k[3][3] = GJ_L; k[3][9] = -GJ_L;
        k[9][3] = -GJ_L; k[9][9] = GJ_L;

        // Bending about Z (in XY plane)
        const EIz_L3 = (E * Iz) / (L * L * L);
        const EIz_L2 = (E * Iz) / (L * L);
        const EIz_L = (E * Iz) / L;

        // v1, thz1, v2, thz2 -> indices 1, 5, 7, 11
        k[1][1] = 12 * EIz_L3; k[1][5] = 6 * EIz_L2; k[1][7] = -12 * EIz_L3; k[1][11] = 6 * EIz_L2;
        k[5][1] = 6 * EIz_L2; k[5][5] = 4 * EIz_L; k[5][7] = -6 * EIz_L2; k[5][11] = 2 * EIz_L;
        k[7][1] = -12 * EIz_L3; k[7][5] = -6 * EIz_L2; k[7][7] = 12 * EIz_L3; k[7][11] = -6 * EIz_L2;
        k[11][1] = 6 * EIz_L2; k[11][5] = 2 * EIz_L; k[11][7] = -6 * EIz_L2; k[11][11] = 4 * EIz_L;

        // Bending about Y (in XZ plane)
        const EIy_L3 = (E * Iy) / (L * L * L);
        const EIy_L2 = (E * Iy) / (L * L);
        const EIy_L = (E * Iy) / L;

        // w1, thy1, w2, thy2 -> indices 2, 4, 8, 10
        // Note signs are different for rotation about Y
        k[2][2] = 12 * EIy_L3; k[2][4] = -6 * EIy_L2; k[2][8] = -12 * EIy_L3; k[2][10] = -6 * EIy_L2;
        k[4][2] = -6 * EIy_L2; k[4][4] = 4 * EIy_L; k[4][8] = 6 * EIy_L2; k[4][10] = 2 * EIy_L;
        k[8][2] = -12 * EIy_L3; k[8][4] = 6 * EIy_L2; k[8][8] = 12 * EIy_L3; k[8][10] = 6 * EIy_L2;
        k[10][2] = -6 * EIy_L2; k[10][4] = 2 * EIy_L; k[10][8] = 6 * EIy_L2; k[10][10] = 4 * EIy_L;

        return k;
    }

    public getGlobalStiffnessMatrix(): number[][] {
        const k = this.getLocalStiffnessMatrix();
        const T = this.getRotationMatrix();

        // K_global = T^T * k * T

        // Transpose T
        const Tt = Array(12).fill(0).map(() => Array(12).fill(0));
        for (let i = 0; i < 12; i++) {
            for (let j = 0; j < 12; j++) {
                Tt[i][j] = T[j][i];
            }
        }

        // Multiply Tt * k
        const Tt_k = Array(12).fill(0).map(() => Array(12).fill(0));
        for (let i = 0; i < 12; i++) {
            for (let j = 0; j < 12; j++) {
                let sum = 0;
                for (let m = 0; m < 12; m++) {
                    sum += Tt[i][m] * k[m][j];
                }
                Tt_k[i][j] = sum;
            }
        }

        // Multiply (Tt * k) * T
        const K = Array(12).fill(0).map(() => Array(12).fill(0));
        for (let i = 0; i < 12; i++) {
            for (let j = 0; j < 12; j++) {
                let sum = 0;
                for (let m = 0; m < 12; m++) {
                    sum += Tt_k[i][m] * T[m][j];
                }
                K[i][j] = sum;
            }
        }

        return K;
    }
}

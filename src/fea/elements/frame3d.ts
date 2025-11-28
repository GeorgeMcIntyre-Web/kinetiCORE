import * as numeric from 'numeric';
import { Vector3 } from "@babylonjs/core";
import { FEAElement, FEANode, MaterialProperties, BeamSection } from "../types";

export class FrameElement3D implements FEAElement {
    id: number;
    nodeIds: number[];
    material: MaterialProperties;
    section: BeamSection;
    nodes: [FEANode, FEANode];

    constructor(id: number, nodes: [FEANode, FEANode], material: MaterialProperties, section: BeamSection) {
        this.id = id;
        this.nodes = nodes;
        this.nodeIds = [nodes[0].id, nodes[1].id];
        this.material = material;
        this.section = section;
    }

    getLength(): number {
        return Vector3.Distance(this.nodes[0].position, this.nodes[1].position);
    }

    getRotationMatrix(): number[][] {
        const p1 = this.nodes[0].position;
        const p2 = this.nodes[1].position;

        // Local x-axis (along the beam)
        const x = p2.subtract(p1).normalize();

        // Local y and z axes (Arbitrary for now, assuming vertical beams align with global Y)
        let y: Vector3;
        if (Math.abs(x.x) < 0.001 && Math.abs(x.z) < 0.001) {
            // Vertical beam
            y = new Vector3(0, 0, 1); // Local y aligns with global Z
        } else {
            y = new Vector3(0, 1, 0);
        }

        // Gram-Schmidt orthogonalization
        const z = Vector3.Cross(x, y).normalize();
        y = Vector3.Cross(z, x).normalize();

        // 3x3 Rotation Matrix R0
        const R0 = [
            [x.x, x.y, x.z],
            [y.x, y.y, y.z],
            [z.x, z.y, z.z]
        ];

        // 12x12 Rotation Matrix R
        const R = Array(12).fill(0).map(() => Array(12).fill(0));
        for (let i = 0; i < 4; i++) {
            for (let r = 0; r < 3; r++) {
                for (let c = 0; c < 3; c++) {
                    R[i * 3 + r][i * 3 + c] = R0[r][c];
                }
            }
        }
        return R;
    }

    getLocalStiffnessMatrix(): number[][] {
        const E = this.material.E;
        const G = this.material.G || E / (2 * (1 + (this.material.nu || 0.3)));
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
        const k1_z = 12 * EIz_L3;
        const k2_z = 6 * EIz_L3 * L;
        const k3_z = 4 * EIz_L3 * L * L; // 4EI/L
        const k4_z = 2 * EIz_L3 * L * L; // 2EI/L

        // Indices: v1(1), theta_z1(5), v2(7), theta_z2(11)
        k[1][1] = k1_z; k[1][5] = k2_z; k[1][7] = -k1_z; k[1][11] = k2_z;
        k[5][1] = k2_z; k[5][5] = k3_z; k[5][7] = -k2_z; k[5][11] = k4_z;
        k[7][1] = -k1_z; k[7][5] = -k2_z; k[7][7] = k1_z; k[7][11] = -k2_z;
        k[11][1] = k2_z; k[11][5] = k4_z; k[11][7] = -k2_z; k[11][11] = k3_z;

        // Bending about Y (in XZ plane)
        const EIy_L3 = (E * Iy) / (L * L * L);
        const k1_y = 12 * EIy_L3;
        const k2_y = 6 * EIy_L3 * L;
        const k3_y = 4 * EIy_L3 * L * L;
        const k4_y = 2 * EIy_L3 * L * L;

        // Indices: w1(2), theta_y1(4), w2(8), theta_y2(10)
        k[2][2] = k1_y; k[2][4] = -k2_y; k[2][8] = -k1_y; k[2][10] = -k2_y;
        k[4][2] = -k2_y; k[4][4] = k3_y; k[4][8] = k2_y; k[4][10] = k4_y;
        k[8][2] = -k1_y; k[8][4] = k2_y; k[8][8] = k1_y; k[8][10] = k2_y;
        k[10][2] = -k2_y; k[10][4] = k4_y; k[10][8] = k2_y; k[10][10] = k3_y;

        return k;
    }

    getGeometricStiffnessMatrix(axialForce: number): number[][] {
        const L = this.getLength();
        const P = axialForce;
        const kg = Array(12).fill(0).map(() => Array(12).fill(0));

        const c1 = P / L;

        // Transverse terms (approximate)
        // v1, v2
        kg[1][1] = 6 / 5 * c1; kg[1][7] = -6 / 5 * c1;
        kg[7][1] = -6 / 5 * c1; kg[7][7] = 6 / 5 * c1;

        // w1, w2
        kg[2][2] = 6 / 5 * c1; kg[2][8] = -6 / 5 * c1;
        kg[8][2] = -6 / 5 * c1; kg[8][8] = 6 / 5 * c1;

        return kg;
    }

    getMassMatrix(): number[][] {
        const L = this.getLength();
        const A = this.section.A;
        const rho = this.material.rho;
        const m = rho * A * L;

        const M = Array(12).fill(0).map(() => Array(12).fill(0));

        // Lumped mass approximation
        const halfM = m / 2;
        // Translational inertia
        M[0][0] = halfM; M[1][1] = halfM; M[2][2] = halfM;
        M[6][6] = halfM; M[7][7] = halfM; M[8][8] = halfM;

        // Rotational inertia (approximate)
        const rotI = (m * L * L) / 24;
        M[3][3] = rotI; M[4][4] = rotI; M[5][5] = rotI;
        M[9][9] = rotI; M[10][10] = rotI; M[11][11] = rotI;

        // Transform to global coordinates
        const T = this.getRotationMatrix();
        const T_t = numeric.transpose(T);

        const temp = numeric.dot(M, T) as number[][];
        const M_global = numeric.dot(T_t, temp) as number[][];

        return M_global;
    }

    getGlobalStiffnessMatrix(): number[][] {
        const kLocal = this.getLocalStiffnessMatrix();
        const T = this.getRotationMatrix();
        const T_t = numeric.transpose(T);

        // K_global = T^T * K_local * T
        const temp = numeric.dot(kLocal, T) as number[][];
        const kGlobal = numeric.dot(T_t, temp) as number[][];

        return kGlobal;
    }
}

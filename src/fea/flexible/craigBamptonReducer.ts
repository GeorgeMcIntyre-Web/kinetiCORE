import * as numeric from 'numeric';
import { Matrix, Vector3 } from '@babylonjs/core';
import { FEANode, FrameElement3D } from '../types';
import { StiffnessAssembler } from '../solver/stiffnessAssembler';
import { MassAssembler } from '../solver/massAssembler';

export interface ReductionOptions {
    boundaryNodeIndices: number[]; // Indices of nodes that are interface/boundary nodes
    numFixedInterfaceModes: number; // Number of internal modes to keep
}

export interface ReducedModel {
    M_cb: number[][]; // Reduced Mass Matrix (Craig-Bampton)
    K_cb: number[][]; // Reduced Stiffness Matrix (Craig-Bampton)
    Phi_cb: number[][]; // Transformation Matrix: Physical -> Craig-Bampton
    boundaryDofs: number[]; // Indices of boundary DOFs in the original full system
    interiorDofs: number[]; // Indices of interior DOFs in the original full system
    frequencies: number[]; // Natural frequencies of the fixed-interface modes
}

export class CraigBamptonReducer {
    /**
     * Performs Craig-Bampton reduction on a system defined by global K and M matrices.
     */
    public static reduce(
        K: number[][],
        M: number[][],
        options: ReductionOptions
    ): ReducedModel {
        const numDofs = K.length;
        const dofPerNode = 6;

        // 1. Identify Boundary (B) and Interior (I) DOFs
        const boundaryDofs: number[] = [];
        const boundaryNodeSet = new Set(options.boundaryNodeIndices);

        // Assuming nodes are 0-indexed and DOFs are sequential (0-5 for node 0, 6-11 for node 1, etc.)
        // We need to know the total number of nodes to map correctly, but here we assume K is full size.
        // A better way is to pass the node indices directly.

        for (const nodeIndex of options.boundaryNodeIndices) {
            for (let i = 0; i < dofPerNode; i++) {
                boundaryDofs.push(nodeIndex * dofPerNode + i);
            }
        }

        const boundaryDofSet = new Set(boundaryDofs);
        const interiorDofs: number[] = [];
        for (let i = 0; i < numDofs; i++) {
            if (!boundaryDofSet.has(i)) {
                interiorDofs.push(i);
            }
        }

        // 2. Reorder Matrices into [B, I] blocks
        // K = [K_bb K_bi]
        //     [K_ib K_ii]
        const K_bb = this.extractSubMatrix(K, boundaryDofs, boundaryDofs);
        const K_bi = this.extractSubMatrix(K, boundaryDofs, interiorDofs);
        const K_ib = this.extractSubMatrix(K, interiorDofs, boundaryDofs);
        const K_ii = this.extractSubMatrix(K, interiorDofs, interiorDofs);

        const M_bb = this.extractSubMatrix(M, boundaryDofs, boundaryDofs);
        const M_bi = this.extractSubMatrix(M, boundaryDofs, interiorDofs);
        const M_ib = this.extractSubMatrix(M, interiorDofs, boundaryDofs);
        const M_ii = this.extractSubMatrix(M, interiorDofs, interiorDofs);

        // 3. Compute Constraint Modes (Phi_c)
        // Phi_c = -inv(K_ii) * K_ib
        // This represents the static deformation of interior DOFs due to unit displacement of boundary DOFs.
        // Solving K_ii * Phi_c = -K_ib

        // Invert K_ii (Interior Stiffness)
        // For large systems, use a sparse solver or Cholesky decomposition. Here using numeric.inv for MVP.
        const K_ii_inv = numeric.inv(K_ii);
        const Phi_c = numeric.dot(K_ii_inv, K_ib);
        // Negate
        for (let i = 0; i < Phi_c.length; i++) {
            for (let j = 0; j < Phi_c[i].length; j++) {
                Phi_c[i][j] = -Phi_c[i][j];
            }
        }

        // 4. Compute Fixed-Interface Normal Modes (Phi_n)
        // Solve eigenvalue problem for interior structure with fixed boundaries:
        // (K_ii - omega^2 * M_ii) * phi = 0

        // We use numeric.eig for the generalized eigenvalue problem or standard if M_ii is identity (it's not).
        // numeric.eig(A, B) solves A*v = lambda*B*v
        // Note: numeric.js might not have generalized eig. We might need to transform to standard.
        // L * L^T = M_ii (Cholesky) -> standard eig problem.
        // For MVP, let's assume we can use numeric.eig(K_ii.dot(inv(M_ii))) or similar approximation
        // Actually numeric.eig solves standard Ax=lambda*x.
        // We need inv(M_ii) * K_ii * x = lambda * x

        const M_ii_inv = numeric.inv(M_ii);
        const D = numeric.dot(M_ii_inv, K_ii);
        const eig = numeric.eig(D);

        // Extract real parts of eigenvalues and eigenvectors (assuming structural stability)
        const lambdas = eig.lambda.x; // Real part
        const eigenvectors = eig.E.x; // Real part

        // Sort by frequency (ascending)
        const modes = lambdas.map((l, i) => ({ lambda: l, vector: eigenvectors[i] }))
            .sort((a, b) => a.lambda - b.lambda)
            .slice(0, options.numFixedInterfaceModes);

        const frequencies = modes.map(m => Math.sqrt(Math.max(0, m.lambda)) / (2 * Math.PI));

        // Construct Phi_n (Interior Normal Modes)
        // Rows = Interior DOFs, Cols = Modal DOFs (k)
        const Phi_n = numeric.transpose(modes.map(m => m.vector));

        // Mass Normalize Phi_n: Phi_n^T * M_ii * Phi_n = I
        // TODO: Implement mass normalization for better conditioning

        // 5. Assemble Craig-Bampton Transformation Matrix (Phi_cb)
        // Phi_cb = [ I_bb    0   ]
        //          [ Phi_c  Phi_n]
        // Dimensions: (NumTotalDofs) x (NumBoundaryDofs + NumFixedInterfaceModes)

        const numB = boundaryDofs.length;
        const numI = interiorDofs.length;
        const numM = options.numFixedInterfaceModes;
        const numReduced = numB + numM;

        const Phi_cb: number[][] = Array(numDofs).fill(0).map(() => Array(numReduced).fill(0));

        // Fill Top-Left (I_bb) - Identity for boundary DOFs
        // But wait, we need to map back to original DOF indices.
        // Let's construct it in the [B, I] order first, then reorder rows?
        // Actually, let's fill Phi_cb directly using the mappings.

        // For each Column j (0 to numB-1): Corresponds to Boundary DOF j
        for (let j = 0; j < numB; j++) {
            // Boundary rows: Identity
            const originalDofIndex = boundaryDofs[j];
            Phi_cb[originalDofIndex][j] = 1.0;

            // Interior rows: Phi_c column j
            for (let i = 0; i < numI; i++) {
                const interiorDofIndex = interiorDofs[i];
                Phi_cb[interiorDofIndex][j] = Phi_c[i][j];
            }
        }

        // For each Column k (numB to numReduced-1): Corresponds to Mode k-numB
        for (let k = 0; k < numM; k++) {
            const colIndex = numB + k;
            // Boundary rows: 0 (Fixed interface)
            // Interior rows: Phi_n column k
            for (let i = 0; i < numI; i++) {
                const interiorDofIndex = interiorDofs[i];
                Phi_cb[interiorDofIndex][colIndex] = Phi_n[i][k];
            }
        }

        // 6. Compute Reduced Matrices
        // M_cb = Phi_cb^T * M * Phi_cb
        // K_cb = Phi_cb^T * K * Phi_cb

        // Note: K_cb should have the form:
        // [ K_bb + Phi_c^T K_ii Phi_c    0        ]
        // [ 0                            Omega^2  ]
        // Ideally we compute this analytically to save operations, but full multiplication is safer for MVP.

        const Phi_cb_T = numeric.transpose(Phi_cb);

        const tempK = numeric.dot(K, Phi_cb);
        const K_cb = numeric.dot(Phi_cb_T, tempK);

        const tempM = numeric.dot(M, Phi_cb);
        const M_cb = numeric.dot(Phi_cb_T, tempM);

        return {
            M_cb,
            K_cb,
            Phi_cb,
            boundaryDofs,
            interiorDofs,
            frequencies
        };
    }

    private static extractSubMatrix(
        matrix: number[][],
        rowIndices: number[],
        colIndices: number[]
    ): number[][] {
        const sub: number[][] = [];
        for (let i = 0; i < rowIndices.length; i++) {
            const row: number[] = [];
            for (let j = 0; j < colIndices.length; j++) {
                row.push(matrix[rowIndices[i]][colIndices[j]]);
            }
            sub.push(row);
        }
        return sub;
    }
}

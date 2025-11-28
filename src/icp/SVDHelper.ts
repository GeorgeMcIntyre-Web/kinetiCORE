/**
 * SVD (Singular Value Decomposition) helper functions.
 * 
 * Implements SVD for 3x3 matrices using a simplified approach.
 * For production, consider using a proper numerical library.
 */

import { Matrix } from 'ml-matrix';

/**
 * Create a diagonal matrix from an array of diagonal values.
 */
function createDiagonalMatrix(diag: number[]): Matrix {
  const n = diag.length;
  const data: number[][] = [];
  for (let i = 0; i < n; i++) {
    const row: number[] = new Array(n).fill(0);
    row[i] = diag[i];
    data.push(row);
  }
  return new Matrix(data);
}

/**
 * Compute SVD for a 3x3 matrix.
 * 
 * For 3x3 matrices, we can use a simplified approach:
 * - Compute A^T * A
 * - Find eigenvalues/eigenvectors of A^T * A
 * - V = eigenvectors, S = sqrt(eigenvalues), U = A * V * S^(-1)
 * 
 * @param matrix 3x3 matrix
 * @returns SVD result with U, S, V matrices
 */
export function computeSVD3x3(matrix: Matrix): { U: Matrix; S: Matrix; V: Matrix } {
  // For 3x3, we can compute directly
  // A^T * A = V * S^2 * V^T
  const AtA = matrix.transpose().mmul(matrix);
  const AtA_array = AtA.to2DArray();
  
  // Compute eigenvalues and eigenvectors of AtA
  // For 3x3 symmetric matrix, use Jacobi method or direct computation
  const eigenResult = jacobiEigenDecomposition(AtA_array);
  
  // V is the eigenvectors (columns)
  const V = new Matrix(eigenResult.eigenvectors);
  
  // S is the square root of eigenvalues
  const eigenvalues = eigenResult.eigenvalues;
  const S_diag = eigenvalues.map(e => Math.sqrt(Math.max(0, e)));
  const S = createDiagonalMatrix(S_diag);
  
  // U = A * V * S^(-1)
  // Handle division by zero
  const S_inv_diag = eigenvalues.map(e => {
    const sqrt_e = Math.sqrt(Math.max(1e-10, e));
    return 1 / sqrt_e;
  });
  const S_inv = createDiagonalMatrix(S_inv_diag);
  const U = matrix.mmul(V).mmul(S_inv);
  
  return { U, S, V };
}

/**
 * Jacobi method for eigenvalue decomposition of symmetric 3x3 matrix.
 * 
 * @param matrix 3x3 symmetric matrix
 * @returns Eigenvalues and eigenvectors
 */
function jacobiEigenDecomposition(matrix: number[][]): {
  eigenvalues: number[];
  eigenvectors: number[][];
} {
  // Simplified Jacobi method for 3x3
  // Start with identity matrix for eigenvectors
  let V = [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1]
  ];
  
  let A = matrix.map(row => [...row]);
  const maxIterations = 50;
  const tolerance = 1e-10;
  
  for (let iter = 0; iter < maxIterations; iter++) {
    // Find largest off-diagonal element
    let maxVal = 0;
    let p = 0, q = 1;
    
    for (let i = 0; i < 3; i++) {
      for (let j = i + 1; j < 3; j++) {
        const val = Math.abs(A[i][j]);
        if (val > maxVal) {
          maxVal = val;
          p = i;
          q = j;
        }
      }
    }
    
    if (maxVal < tolerance) {
      break; // Converged
    }
    
    // Compute rotation angle
    const theta = 0.5 * Math.atan2(2 * A[p][q], A[p][p] - A[q][q]);
    const c = Math.cos(theta);
    const s = Math.sin(theta);
    
    // Apply Jacobi rotation
    const Ap = A[p][p];
    const Aq = A[q][q];
    const Apq = A[p][q];
    
    A[p][p] = c * c * Ap + 2 * c * s * Apq + s * s * Aq;
    A[q][q] = s * s * Ap - 2 * c * s * Apq + c * c * Aq;
    A[p][q] = A[q][p] = (c * c - s * s) * Apq + c * s * (Aq - Ap);
    
    // Update other off-diagonal elements
    for (let k = 0; k < 3; k++) {
      if (k !== p && k !== q) {
        const Akp = A[k][p];
        const Akq = A[k][q];
        A[k][p] = A[p][k] = c * Akp + s * Akq;
        A[k][q] = A[q][k] = -s * Akp + c * Akq;
      }
    }
    
    // Update eigenvectors
    for (let k = 0; k < 3; k++) {
      const Vkp = V[k][p];
      const Vkq = V[k][q];
      V[k][p] = c * Vkp + s * Vkq;
      V[k][q] = -s * Vkp + c * Vkq;
    }
  }
  
  // Extract eigenvalues (diagonal elements)
  const eigenvalues = [A[0][0], A[1][1], A[2][2]];
  
  // Sort by eigenvalue magnitude (descending)
  const indices = [0, 1, 2].sort((a, b) => Math.abs(eigenvalues[b]) - Math.abs(eigenvalues[a]));
  const sortedEigenvalues = indices.map(i => eigenvalues[i]);
  const sortedEigenvectors = indices.map(i => [V[0][i], V[1][i], V[2][i]]);
  
  return {
    eigenvalues: sortedEigenvalues,
    eigenvectors: sortedEigenvectors
  };
}


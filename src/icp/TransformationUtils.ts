/**
 * Transformation matrix utilities.
 * 
 * Ported from Python: cascaded_fit/core/transformations.py
 */

import { Transform4x4 } from './types';

export class TransformationUtils {
  /**
   * Convert float to string with maximum decimals.
   * 
   * @param value Float value
   * @param decimals Number of decimal places (default: 50)
   * @returns Formatted string
   */
  static floatToMaxDecimalsString(value: number, decimals: number = 50): string {
    return value.toFixed(decimals);
  }

  /**
   * Convert transformation matrix to CSV string.
   * 
   * @param transform 4x4 transformation matrix
   * @returns CSV-formatted string
   */
  static arrayToCSVString(transform: Transform4x4): string {
    const rows: string[] = [];
    
    for (const row of transform.matrix) {
      const rowString = row
        .map(value => this.floatToMaxDecimalsString(value))
        .join(',');
      rows.push(rowString);
    }
    
    return rows.join('\n');
  }

  /**
   * Convert transformation matrix to JSON string.
   * 
   * @param transform 4x4 transformation matrix
   * @param pretty Whether to format with indentation
   * @returns JSON string
   */
  static arrayToJSONString(transform: Transform4x4, pretty: boolean = false): string {
    if (pretty) {
      return JSON.stringify(transform.matrix, null, 2);
    }
    return JSON.stringify(transform.matrix);
  }

  /**
   * Create identity transformation matrix.
   * 
   * @returns 4x4 identity matrix
   */
  static createIdentity(): Transform4x4 {
    return {
      matrix: [
        [1, 0, 0, 0],
        [0, 1, 0, 0],
        [0, 0, 1, 0],
        [0, 0, 0, 1]
      ]
    };
  }

  /**
   * Multiply two transformation matrices.
   * 
   * @param a First transformation
   * @param b Second transformation
   * @returns Result transformation (a * b)
   */
  static multiply(a: Transform4x4, b: Transform4x4): Transform4x4 {
    const result: number[][] = [
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0]
    ];
    
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        let sum = 0;
        for (let k = 0; k < 4; k++) {
          sum += a.matrix[i][k] * b.matrix[k][j];
        }
        result[i][j] = sum;
      }
    }
    
    return { matrix: result };
  }

  /**
   * Invert transformation matrix.
   * 
   * @param transform Transformation to invert
   * @returns Inverted transformation
   */
  static invert(transform: Transform4x4): Transform4x4 {
    const R = transform.matrix.slice(0, 3).map(row => row.slice(0, 3));
    const t = [
      transform.matrix[0][3],
      transform.matrix[1][3],
      transform.matrix[2][3]
    ];
    
    // Invert rotation (transpose for orthogonal matrix)
    const R_inv = [
      [R[0][0], R[1][0], R[2][0]],
      [R[0][1], R[1][1], R[2][1]],
      [R[0][2], R[1][2], R[2][2]]
    ];
    
    // Invert translation: t_inv = -R^T * t
    const t_inv = [
      -(R_inv[0][0] * t[0] + R_inv[0][1] * t[1] + R_inv[0][2] * t[2]),
      -(R_inv[1][0] * t[0] + R_inv[1][1] * t[1] + R_inv[1][2] * t[2]),
      -(R_inv[2][0] * t[0] + R_inv[2][1] * t[1] + R_inv[2][2] * t[2])
    ];
    
    // Normalize zeros to avoid -0
    const normalizeZero = (x: number) => x === 0 ? 0 : x;
    
    return {
      matrix: [
        [normalizeZero(R_inv[0][0]), normalizeZero(R_inv[0][1]), normalizeZero(R_inv[0][2]), normalizeZero(t_inv[0])],
        [normalizeZero(R_inv[1][0]), normalizeZero(R_inv[1][1]), normalizeZero(R_inv[1][2]), normalizeZero(t_inv[1])],
        [normalizeZero(R_inv[2][0]), normalizeZero(R_inv[2][1]), normalizeZero(R_inv[2][2]), normalizeZero(t_inv[2])],
        [0, 0, 0, 1]
      ]
    };
  }
}


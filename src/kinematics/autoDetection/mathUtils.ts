/**
 * Mathematical utilities for automatic kinematics detection.
 * Pure functions for linear algebra, geometry, and transformations.
 */

export type Vec3 = [number, number, number];
export type Quat = [number, number, number, number];  // [x, y, z, w]
export type Mat3 = number[][];  // 3x3 matrix
export type Mat4 = number[][];  // 4x4 matrix

/**
 * Vector operations
 */
export function vecAdd(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

export function vecSub(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

export function vecScale(v: Vec3, s: number): Vec3 {
  return [v[0] * s, v[1] * s, v[2] * s];
}

export function vecDot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

export function vecCross(a: Vec3, b: Vec3): Vec3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

export function vecLength(v: Vec3): number {
  return Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
}

export function vecNormalize(v: Vec3): Vec3 {
  const len = vecLength(v);
  if (len < 1e-10) return [0, 0, 1];  // Default to Z-up if zero
  return vecScale(v, 1 / len);
}

export function vecDistance(a: Vec3, b: Vec3): number {
  return vecLength(vecSub(a, b));
}

export function vecMidpoint(a: Vec3, b: Vec3): Vec3 {
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
}

/**
 * Matrix operations
 */
export function mat3Identity(): Mat3 {
  return [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ];
}

export function mat4Identity(): Mat4 {
  return [
    [1, 0, 0, 0],
    [0, 1, 0, 0],
    [0, 0, 1, 0],
    [0, 0, 0, 1],
  ];
}

export function mat3Multiply(a: Mat3, b: Mat3): Mat3 {
  const result: Mat3 = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];

  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      result[i][j] =
        a[i][0] * b[0][j] +
        a[i][1] * b[1][j] +
        a[i][2] * b[2][j];
    }
  }

  return result;
}

export function mat3Subtract(a: Mat3, b: Mat3): Mat3 {
  return [
    [a[0][0] - b[0][0], a[0][1] - b[0][1], a[0][2] - b[0][2]],
    [a[1][0] - b[1][0], a[1][1] - b[1][1], a[1][2] - b[1][2]],
    [a[2][0] - b[2][0], a[2][1] - b[2][1], a[2][2] - b[2][2]],
  ];
}

export function mat4Multiply(a: Mat4, b: Mat4): Mat4 {
  const result: Mat4 = [
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ];

  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      result[i][j] =
        a[i][0] * b[0][j] +
        a[i][1] * b[1][j] +
        a[i][2] * b[2][j] +
        a[i][3] * b[3][j];
    }
  }

  return result;
}

export function mat4Invert(m: Mat4): Mat4 | null {
  const a00 = m[0][0], a01 = m[0][1], a02 = m[0][2], a03 = m[0][3];
  const a10 = m[1][0], a11 = m[1][1], a12 = m[1][2], a13 = m[1][3];
  const a20 = m[2][0], a21 = m[2][1], a22 = m[2][2], a23 = m[2][3];
  const a30 = m[3][0], a31 = m[3][1], a32 = m[3][2], a33 = m[3][3];

  const b00 = a00 * a11 - a01 * a10;
  const b01 = a00 * a12 - a02 * a10;
  const b02 = a00 * a13 - a03 * a10;
  const b03 = a01 * a12 - a02 * a11;
  const b04 = a01 * a13 - a03 * a11;
  const b05 = a02 * a13 - a03 * a12;
  const b06 = a20 * a31 - a21 * a30;
  const b07 = a20 * a32 - a22 * a30;
  const b08 = a20 * a33 - a23 * a30;
  const b09 = a21 * a32 - a22 * a31;
  const b10 = a21 * a33 - a23 * a31;
  const b11 = a22 * a33 - a23 * a32;

  const det =
    b00 * b11 -
    b01 * b10 +
    b02 * b09 +
    b03 * b08 -
    b04 * b07 +
    b05 * b06;

  if (Math.abs(det) < 1e-12) {
    return null;
  }

  const invDet = 1 / det;

  return [
    [
      (a11 * b11 - a12 * b10 + a13 * b09) * invDet,
      (-a01 * b11 + a02 * b10 - a03 * b09) * invDet,
      (a31 * b05 - a32 * b04 + a33 * b03) * invDet,
      (-a21 * b05 + a22 * b04 - a23 * b03) * invDet,
    ],
    [
      (-a10 * b11 + a12 * b08 - a13 * b07) * invDet,
      (a00 * b11 - a02 * b08 + a03 * b07) * invDet,
      (-a30 * b05 + a32 * b02 - a33 * b01) * invDet,
      (a20 * b05 - a22 * b02 + a23 * b01) * invDet,
    ],
    [
      (a10 * b10 - a11 * b08 + a13 * b06) * invDet,
      (-a00 * b10 + a01 * b08 - a03 * b06) * invDet,
      (a30 * b04 - a31 * b02 + a33 * b00) * invDet,
      (-a20 * b04 + a21 * b02 - a23 * b00) * invDet,
    ],
    [
      (-a10 * b09 + a11 * b07 - a12 * b06) * invDet,
      (a00 * b09 - a01 * b07 + a02 * b06) * invDet,
      (-a30 * b03 + a31 * b01 - a32 * b00) * invDet,
      (a20 * b03 - a21 * b01 + a22 * b00) * invDet,
    ],
  ];
}

export function mat3ApplyToVec(m: Mat3, v: Vec3): Vec3 {
  return [
    m[0][0] * v[0] + m[0][1] * v[1] + m[0][2] * v[2],
    m[1][0] * v[0] + m[1][1] * v[1] + m[1][2] * v[2],
    m[2][0] * v[0] + m[2][1] * v[1] + m[2][2] * v[2],
  ];
}

export function mat4ApplyToVec(m: Mat4, v: Vec3): Vec3 {
  const w = m[3][0] * v[0] + m[3][1] * v[1] + m[3][2] * v[2] + m[3][3];
  return [
    (m[0][0] * v[0] + m[0][1] * v[1] + m[0][2] * v[2] + m[0][3]) / w,
    (m[1][0] * v[0] + m[1][1] * v[1] + m[1][2] * v[2] + m[1][3]) / w,
    (m[2][0] * v[0] + m[2][1] * v[1] + m[2][2] * v[2] + m[2][3]) / w,
  ];
}

export function mat3Transpose(m: Mat3): Mat3 {
  return [
    [m[0][0], m[1][0], m[2][0]],
    [m[0][1], m[1][1], m[2][1]],
    [m[0][2], m[1][2], m[2][2]],
  ];
}

export function mat3Determinant(m: Mat3): number {
  return (
    m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) -
    m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) +
    m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0])
  );
}

export function mat3Trace(m: Mat3): number {
  return m[0][0] + m[1][1] + m[2][2];
}

/**
 * Quaternion operations
 */
export function quatToMat3(q: Quat): Mat3 {
  const [x, y, z, w] = q;

  const xx = x * x;
  const yy = y * y;
  const zz = z * z;
  const xy = x * y;
  const xz = x * z;
  const yz = y * z;
  const wx = w * x;
  const wy = w * y;
  const wz = w * z;

  return [
    [1 - 2 * (yy + zz), 2 * (xy - wz), 2 * (xz + wy)],
    [2 * (xy + wz), 1 - 2 * (xx + zz), 2 * (yz - wx)],
    [2 * (xz - wy), 2 * (yz + wx), 1 - 2 * (xx + yy)],
  ];
}

export function quatFromAxisAngle(axis: Vec3, angle: number): Quat {
  const halfAngle = angle / 2;
  const s = Math.sin(halfAngle);
  return [
    axis[0] * s,
    axis[1] * s,
    axis[2] * s,
    Math.cos(halfAngle),
  ];
}

/**
 * Compose transformation matrix from TRS components
 */
export function composeMat4(
  translation: Vec3,
  rotation: Quat,
  scale: Vec3
): Mat4 {
  const rotMat = quatToMat3(rotation);

  return [
    [rotMat[0][0] * scale[0], rotMat[0][1] * scale[1], rotMat[0][2] * scale[2], translation[0]],
    [rotMat[1][0] * scale[0], rotMat[1][1] * scale[1], rotMat[1][2] * scale[2], translation[1]],
    [rotMat[2][0] * scale[0], rotMat[2][1] * scale[1], rotMat[2][2] * scale[2], translation[2]],
    [0, 0, 0, 1],
  ];
}

/**
 * Compute centroid of point cloud
 */
export function computeCentroid(points: Float32Array): Vec3 {
  const count = points.length / 3;
  if (count === 0) return [0, 0, 0];

  let sumX = 0;
  let sumY = 0;
  let sumZ = 0;

  for (let i = 0; i < points.length; i += 3) {
    sumX += points[i];
    sumY += points[i + 1];
    sumZ += points[i + 2];
  }

  return [sumX / count, sumY / count, sumZ / count];
}

/**
 * Compute covariance matrix for point sets
 */
export function computeCovarianceMatrix(
  sourcePoints: Vec3[],
  targetPoints: Vec3[]
): Mat3 {
  const n = Math.min(sourcePoints.length, targetPoints.length);
  const H: Mat3 = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];

  for (let i = 0; i < n; i++) {
    const s = sourcePoints[i];
    const t = targetPoints[i];

    H[0][0] += s[0] * t[0];
    H[0][1] += s[0] * t[1];
    H[0][2] += s[0] * t[2];
    H[1][0] += s[1] * t[0];
    H[1][1] += s[1] * t[1];
    H[1][2] += s[1] * t[2];
    H[2][0] += s[2] * t[0];
    H[2][1] += s[2] * t[1];
    H[2][2] += s[2] * t[2];
  }

  return H;
}

/**
 * Simplified 3x3 SVD for rotation matrix extraction.
 * 
 * @deprecated This function is not used by the ICP implementation.
 * The ICP algorithm in icp.ts uses ml-matrix's SVD which is numerically stable.
 * This function is kept for reference only and may be removed in the future.
 * 
 * If you need SVD, use ml-matrix's SVD class directly (as done in icp.ts).
 */
export function svd3x3(H: Mat3): { U: Mat3; S: Vec3; V: Mat3 } {
  // Compute H^T * H for V
  const HTH: Mat3 = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];

  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      HTH[i][j] =
        H[0][i] * H[0][j] +
        H[1][i] * H[1][j] +
        H[2][i] * H[2][j];
    }
  }

  // Power iteration to find eigenvectors of H^T * H
  // NOTE: This is a placeholder implementation.
  // The actual ICP algorithm uses ml-matrix's SVD (see icp.ts:computeRotationViaSVD)

  // For now, return identity matrices - this is not used in production
  console.warn('[MATH] svd3x3 is deprecated - ICP uses ml-matrix SVD instead');

  return {
    U: mat3Identity(),
    S: [1, 1, 1],
    V: mat3Identity(),
  };
}

/**
 * Solve 3x3 linear system Ax = b using Gaussian elimination
 */
export function solve3x3(A: Mat3, b: Vec3): Vec3 {
  // Create augmented matrix [A | b]
  const aug: number[][] = [
    [A[0][0], A[0][1], A[0][2], b[0]],
    [A[1][0], A[1][1], A[1][2], b[1]],
    [A[2][0], A[2][1], A[2][2], b[2]],
  ];

  // Forward elimination
  for (let i = 0; i < 3; i++) {
    // Find pivot
    let maxRow = i;
    for (let k = i + 1; k < 3; k++) {
      if (Math.abs(aug[k][i]) > Math.abs(aug[maxRow][i])) {
        maxRow = k;
      }
    }

    // Swap rows
    [aug[i], aug[maxRow]] = [aug[maxRow], aug[i]];

    // Eliminate below
    for (let k = i + 1; k < 3; k++) {
      const factor = aug[k][i] / aug[i][i];
      for (let j = i; j < 4; j++) {
        aug[k][j] -= factor * aug[i][j];
      }
    }
  }

  // Back substitution
  const x: Vec3 = [0, 0, 0];
  for (let i = 2; i >= 0; i--) {
    x[i] = aug[i][3];
    for (let j = i + 1; j < 3; j++) {
      x[i] -= aug[i][j] * x[j];
    }
    x[i] /= aug[i][i];
  }

  return x;
}

/**
 * Project point onto plane
 */
export function projectToPlane(
  point: Vec3,
  planePoint: Vec3,
  planeNormal: Vec3
): Vec3 {
  const v = vecSub(point, planePoint);
  const dist = vecDot(v, planeNormal);
  return vecSub(point, vecScale(planeNormal, dist));
}

/**
 * Subsample points uniformly
 */
export function subsamplePoints(
  points: Float32Array,
  ratio: number
): Float32Array {
  if (ratio >= 1.0) return points;

  const totalPoints = points.length / 3;
  const desiredCount = Math.floor(totalPoints * ratio);

  // CRITICAL FIX: Ensure we always have at least a few points
  // If the input is small (<100 points), don't subsample
  if (totalPoints < 100) return points;

  // Ensure at least 10 points after subsampling
  const count = Math.max(10, desiredCount);
  const result = new Float32Array(count * 3);

  const stride = Math.max(1, Math.floor(totalPoints / count));

  for (let i = 0, j = 0; i < points.length && j < count * 3; i += stride * 3, j += 3) {
    result[j] = points[i];
    result[j + 1] = points[i + 1];
    result[j + 2] = points[i + 2];
  }

  return result;
}

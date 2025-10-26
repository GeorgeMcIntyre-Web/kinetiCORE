// Babylon.js mocks for testing
// Provides lightweight mocks of Babylon.js classes to avoid WebGL dependencies in tests

import { vi } from 'vitest';

// Mock Vector3
export class MockVector3 {
  constructor(
    public x: number = 0,
    public y: number = 0,
    public z: number = 0
  ) {}

  clone(): MockVector3 {
    return new MockVector3(this.x, this.y, this.z);
  }

  copyFrom(other: MockVector3): MockVector3 {
    this.x = other.x;
    this.y = other.y;
    this.z = other.z;
    return this;
  }

  add(other: MockVector3): MockVector3 {
    return new MockVector3(this.x + other.x, this.y + other.y, this.z + other.z);
  }

  subtract(other: MockVector3): MockVector3 {
    return new MockVector3(this.x - other.x, this.y - other.y, this.z - other.z);
  }

  scale(s: number): MockVector3 {
    return new MockVector3(this.x * s, this.y * s, this.z * s);
  }

  length(): number {
    return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
  }

  normalize(): MockVector3 {
    const len = this.length();
    if (len === 0) return this;
    return this.scale(1 / len);
  }

  static Distance(a: MockVector3, b: MockVector3): number {
    return a.subtract(b).length();
  }

  static Dot(a: MockVector3, b: MockVector3): number {
    return a.x * b.x + a.y * b.y + a.z * b.z;
  }

  static TransformCoordinates(vector: MockVector3, _transformation: MockMatrix): MockVector3 {
    // Simplified transform - just return the vector for now
    return vector.clone();
  }
}

// Mock Matrix
export class MockMatrix {
  private m: number[] = new Array(16).fill(0);

  static Identity(): MockMatrix {
    const matrix = new MockMatrix();
    matrix.m[0] = 1;
    matrix.m[5] = 1;
    matrix.m[10] = 1;
    matrix.m[15] = 1;
    return matrix;
  }

  clone(): MockMatrix {
    const matrix = new MockMatrix();
    matrix.m = [...this.m];
    return matrix;
  }
}

// Mock Color3
export class MockColor3 {
  constructor(
    public r: number = 0,
    public g: number = 0,
    public b: number = 0
  ) {}

  clone(): MockColor3 {
    return new MockColor3(this.r, this.g, this.b);
  }
}

// Mock Mesh
export class MockMesh {
  public position: MockVector3 = new MockVector3();
  public rotation: MockVector3 = new MockVector3();
  public scaling: MockVector3 = new MockVector3(1, 1, 1);
  public uniqueId: number = Math.floor(Math.random() * 1000000);
  public isVisible: boolean = true;
  public material: any = null;
  private vertices: number[] = [];
  private indices: number[] = [];
  private worldMatrix: MockMatrix = MockMatrix.Identity();

  constructor(public name: string) {}

  getVerticesData(_kind: string): number[] | null {
    return this.vertices.length > 0 ? this.vertices : null;
  }

  setVerticesData(_kind: string, data: number[]): void {
    this.vertices = data;
  }

  getIndices(): number[] | null {
    return this.indices.length > 0 ? this.indices : null;
  }

  setIndices(indices: number[]): void {
    this.indices = indices;
  }

  computeWorldMatrix(_force: boolean = false): MockMatrix {
    return this.worldMatrix;
  }

  getBoundingInfo(): any {
    const min = new MockVector3(-0.5, -0.5, -0.5);
    const max = new MockVector3(0.5, 0.5, 0.5);
    const center = new MockVector3(0, 0, 0);

    return {
      boundingBox: {
        minimumWorld: min,
        maximumWorld: max,
        centerWorld: center,
      },
    };
  }

  getAbsolutePosition(): MockVector3 {
    return this.position.clone();
  }

  dispose(): void {
    this.vertices = [];
    this.indices = [];
  }
}

// Mock Scene
export class MockScene {
  public meshes: MockMesh[] = [];
  public transformNodes: any[] = [];
  public useRightHandedSystem: boolean = true;
  public onBeforeRenderObservable: any = {
    add: vi.fn(),
    remove: vi.fn(),
  };

  pickWithRay(_ray: any, _predicate?: (mesh: MockMesh) => boolean): any {
    return {
      hit: false,
      pickedPoint: null,
      pickedMesh: null,
      getNormal: () => null,
    };
  }

  dispose(): void {
    this.meshes.forEach((mesh) => mesh.dispose());
    this.meshes = [];
    this.transformNodes = [];
  }
}

// Mock Ray
export class MockRay {
  constructor(
    public origin: MockVector3,
    public direction: MockVector3,
    public length: number = 1000
  ) {}
}

// Mock TransformNode
export class MockTransformNode {
  public position: MockVector3 = new MockVector3();
  public rotation: MockVector3 = new MockVector3();
  public scaling: MockVector3 = new MockVector3(1, 1, 1);
  public uniqueId: number = Math.floor(Math.random() * 1000000);

  constructor(public name: string) {}

  getAbsolutePosition(): MockVector3 {
    return this.position.clone();
  }

  dispose(): void {}
}

// Export mocks that can be used in tests
export const createMockMesh = (name: string, vertices?: number[], indices?: number[]): MockMesh => {
  const mesh = new MockMesh(name);
  if (vertices) mesh.setVerticesData('position', vertices);
  if (indices) mesh.setIndices(indices);
  return mesh;
};

export const createMockScene = (): MockScene => {
  return new MockScene();
};

export const createMockBox = (name: string, size: number = 1): MockMesh => {
  const s = size / 2;
  // Box vertices (8 corners)
  const vertices = [
    // Front face
    -s, -s, s,  s, -s, s,  s, s, s,  -s, s, s,
    // Back face
    -s, -s, -s,  s, -s, -s,  s, s, -s,  -s, s, -s,
  ];

  // Box indices (12 triangles)
  const indices = [
    // Front
    0, 1, 2, 0, 2, 3,
    // Back
    5, 4, 7, 5, 7, 6,
    // Top
    3, 2, 6, 3, 6, 7,
    // Bottom
    4, 5, 1, 4, 1, 0,
    // Right
    1, 5, 6, 1, 6, 2,
    // Left
    4, 0, 3, 4, 3, 7,
  ];

  return createMockMesh(name, vertices, indices);
};

// Export as Babylon.js-like namespace for easy replacement in tests
export const BABYLON = {
  Vector3: MockVector3,
  Matrix: MockMatrix,
  Color3: MockColor3,
  Mesh: MockMesh,
  Scene: MockScene,
  Ray: MockRay,
  TransformNode: MockTransformNode,
  VertexBuffer: {
    PositionKind: 'position',
  },
};

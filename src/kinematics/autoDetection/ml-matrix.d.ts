declare module 'ml-matrix' {
    export class Matrix {
        constructor(data: number[][] | number, columns?: number);
        static eye(rows: number, columns?: number): Matrix;
        static zeros(rows: number, columns: number): Matrix;
        static checkMatrix(matrix: Matrix): boolean;

        rows: number;
        columns: number;
        data: number[][];

        transpose(): Matrix;
        inverse(): Matrix;
        mmul(other: Matrix): Matrix;
        mul(value: number): Matrix;
        div(value: number): Matrix;
        add(other: Matrix | number): Matrix;
        sub(other: Matrix | number): Matrix;
        clone(): Matrix;

        get(row: number, column: number): number;
        set(row: number, column: number, value: number): Matrix;

        getRow(index: number): number[];
        getColumn(index: number): number[];
        setRow(index: number, array: number[]): Matrix;
        setColumn(index: number, array: number[]): Matrix;

        to1DArray(): number[];
        to2DArray(): number[][];
    }

    export class SingularValueDecomposition {
        constructor(matrix: Matrix);
        leftSingularVectors: Matrix;
        diagonalMatrix: Matrix;
        rightSingularVectors: Matrix;
        singularValues: number[];
    }

    export { SingularValueDecomposition as SVD };

    export class EigenvalueDecomposition {
        constructor(matrix: Matrix);
        realEigenvalues: number[];
        imaginaryEigenvalues: number[];
        eigenvectorMatrix: Matrix;
    }

    export function determinant(matrix: Matrix): number;
    export function inverse(matrix: Matrix): Matrix;
}

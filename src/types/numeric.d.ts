declare module 'numeric' {
    export function solve(A: number[][], b: number[]): number[];
    export function dim(A: number[][]): number[];
    export function add(A: number[][] | number[], B: number[][] | number[]): number[][] | number[];
    export function sub(A: number[][] | number[], B: number[][] | number[]): number[][] | number[];
    export function mul(A: number[][] | number[], B: number[][] | number[]): number[][] | number[];
    export function div(A: number[][] | number[], B: number[][] | number[]): number[][] | number[];
    export function dot(A: number[][] | number[], B: number[][] | number[]): number[][] | number[];
    export function transpose(A: number[][]): number[][];
    export function identity(n: number): number[][];
    export function rep(s: number[], v: number): number[][] | number[];
    export function eig(matrix: number[][]): { lambda: { x: number[] }, E: { x: number[][] } };
}

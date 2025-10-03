declare module '@dimforge/rapier3d-compat' {
  const RAPIER: any;
  export default RAPIER;
}

declare module '@babylonjs/core' {
  const BABYLON: any;
  export = BABYLON;
}

declare module '@babylonjs/gui' {
  export const AdvancedDynamicTexture: any;
  export const TextBlock: any;
}

declare module 'react' {
  export const useEffect: any;
  export const useRef: any;
  const React: any;
  export default React;
}

declare module 'react/jsx-runtime' {
  const jsxRuntime: any;
  export = jsxRuntime;
}


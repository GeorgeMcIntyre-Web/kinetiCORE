import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@core': path.resolve(__dirname, './src/core'),
      '@physics': path.resolve(__dirname, './src/physics'),
      '@scene': path.resolve(__dirname, './src/scene'),
      '@entities': path.resolve(__dirname, './src/entities'),
      '@ui': path.resolve(__dirname, './src/ui'),
      '@utils': path.resolve(__dirname, './src/utils'),
    },
  },
  server: {
    port: 5173,
    open: true,
  },
  build: {
    target: 'es2020',
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        // Optimize chunking strategy to reduce main bundle size
        manualChunks(id) {
          // React and related libraries
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) {
            return 'vendor-react';
          }
          // Babylon.js ecosystem
          if (id.includes('node_modules/@babylonjs')) {
            return 'vendor-babylon';
          }
          // Physics engine
          if (id.includes('node_modules/@dimforge/rapier')) {
            return 'vendor-physics';
          }
          // State management
          if (id.includes('node_modules/zustand') || id.includes('node_modules/immer')) {
            return 'vendor-state';
          }
          // DWG/CAD loaders (large, separate chunk)
          if (id.includes('node_modules/@mlightcad')) {
            return 'dwg-loader';
          }
        },
      },
    },
    // Increase chunk size warning limit for expected large chunks (DWG has embedded WASM base64)
    chunkSizeWarningLimit: 1500, // 1.5MB (from default 500KB)
  },
  optimizeDeps: {
    exclude: ['@dimforge/rapier3d-compat', '@mlightcad/libredwg-web'],
  },
  assetsInclude: ['**/*.wasm'],
  worker: {
    format: 'es',
    plugins: () => [],
  },
});

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { execSync } from 'child_process';
import fs from 'fs';

// Get version from package.json
const packageJson = JSON.parse(fs.readFileSync('./package.json', 'utf-8'));
const version = packageJson.version;

// Get git commit hash (if available)
let gitCommit = 'unknown';
try {
  gitCommit = execSync('git rev-parse --short HEAD').toString().trim();
} catch (e) {
  console.warn('Could not get git commit hash');
}

// Get build timestamp
const buildTime = new Date().toISOString();

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(version),
    'import.meta.env.VITE_GIT_COMMIT': JSON.stringify(gitCommit),
    'import.meta.env.VITE_BUILD_TIME': JSON.stringify(buildTime),
    // Polyfill for Node.js global object (required by icpts/eigen-js)
    global: 'globalThis',
  },
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
    sourcemap: false, // Disable sourcemaps in production for smaller bundle
    // Best-in-class compression with Terser
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.info', 'console.debug'], // Remove specific console calls
        passes: 2, // Run compression twice for better results
      },
      mangle: {
        safari10: true, // Fix Safari 10+ bugs
      },
      format: {
        comments: false, // Remove all comments
      },
    },
    rollupOptions: {
      external: (id) => {
        // Mark inspector as external (optional debug tool, loaded dynamically)
        if (id === '@babylonjs/inspector') {
          return true;
        }
        return false;
      },
      output: {
        // Optimize chunking strategy to reduce main bundle size
        manualChunks(id) {
          // React and related libraries
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) {
            return 'vendor-react';
          }
          // Babylon.js ecosystem (split into smaller chunks)
          if (id.includes('node_modules/@babylonjs/core')) {
            return 'vendor-babylon-core';
          }
          if (id.includes('node_modules/@babylonjs/loaders')) {
            return 'vendor-babylon-loaders';
          }
          if (id.includes('node_modules/@babylonjs')) {
            return 'vendor-babylon-misc';
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
          // Supabase
          if (id.includes('node_modules/@supabase')) {
            return 'vendor-supabase';
          }
          // Three.js (if used)
          if (id.includes('node_modules/three')) {
            return 'vendor-three';
          }
        },
        // Optimize asset file names for better caching
        assetFileNames: (assetInfo) => {
          const info = assetInfo.name?.split('.') || [];
          const ext = info[info.length - 1];

          // Group assets by type for better CDN caching
          if (/\.(png|jpe?g|svg|gif|tiff|bmp|ico)$/i.test(assetInfo.name || '')) {
            return 'assets/images/[name]-[hash][extname]';
          }
          if (/\.(woff2?|eot|ttf|otf)$/i.test(assetInfo.name || '')) {
            return 'assets/fonts/[name]-[hash][extname]';
          }
          if (/\.(wasm)$/i.test(assetInfo.name || '')) {
            return 'assets/wasm/[name]-[hash][extname]';
          }
          return 'assets/[name]-[hash][extname]';
        },
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
      },
    },
    // Increase chunk size warning limit for expected large chunks (DWG has embedded WASM base64)
    chunkSizeWarningLimit: 1500, // 1.5MB (from default 500KB)
    // Enable CSS code splitting
    cssCodeSplit: true,
    // Optimize asset inlining threshold (4KB default, increased for better performance)
    assetsInlineLimit: 4096,
    // Report compressed size
    reportCompressedSize: true,
  },
  optimizeDeps: {
    exclude: ['@dimforge/rapier3d-compat', '@mlightcad/libredwg-web', 'pcl.js'],
  },
  assetsInclude: ['**/*.wasm', '**/pcl-core.wasm'],
  worker: {
    format: 'es',
    plugins: () => [],
  },
});

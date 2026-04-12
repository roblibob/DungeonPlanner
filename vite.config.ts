import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import type { Plugin } from 'vite'

/**
 * Three.js r182's three.webgpu.js pre-built file contains a debug-only
 * side-effect import to greggman.github.io. In LAN-only environments
 * the request fails and crashes the entire WebGPU module at init time.
 * This plugin strips that import before Rollup processes the file.
 */
function stripThreeDebugImport(): Plugin {
  return {
    name: 'strip-three-debug-import',
    transform(code, id) {
      if (!id.includes('three.webgpu') && !id.includes('three.tsl')) return
      const cleaned = code.replace(
        /import\s+['"]https?:\/\/greggman[^'"]*['"]\s*;?/g,
        '',
      )
      if (cleaned !== code) return { code: cleaned, map: null }
    },
  }
}

export default defineConfig({
  // When deploying to a subfolder on GitHub Pages, set VITE_BASE_PATH=/dungeonplanner/
  base: process.env.VITE_BASE_PATH ?? '/',
  assetsInclude: ['**/*.glb'],
  plugins: [react(), tailwindcss(), stripThreeDebugImport()],
  resolve: {
    alias: {
      // three.webgpu.js and three.tsl.js pre-built files contain a debug
      // import to greggman.github.io that crashes in LAN-only environments.
      // Point them at the pre-built files; the stripThreeDebugImport plugin
      // below removes the offending line before Rollup processes them.
      // 'three' stays at its default (three.module.js). Both three.module.js
      // and three.webgpu.js import from three.core.js, so Rollup deduplicates
      // the shared core — AmbientLight etc. are the same class instance in both.
      'three/webgpu': path.resolve('./node_modules/three/build/three.webgpu.js'),
      'three/tsl':    path.resolve('./node_modules/three/build/three.tsl.js'),
    },
  },
  build: {
    target: 'esnext',
    chunkSizeWarningLimit: 4000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom') || id.includes('node_modules/scheduler')) {
            return 'react'
          }
          if (
            id.includes('@react-three/rapier') ||
            id.includes('@dimforge/rapier3d-compat')
          ) {
            return 'rapier'
          }
          if (id.includes('node_modules/zustand')) {
            return 'state'
          }
          return undefined
        },
      },
    },
  },
  test: {
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    css: true,
    exclude: ['tests/e2e/**'],
  },
})

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Every build gets an id, baked into the bundle (__BUILD_ID__) and published as
// /version.json. UpdateBanner compares the two, so a tab left open since an
// older deploy is told to reload instead of quietly running old code.
const BUILD_ID = Date.now().toString(36)

const versionFile = () => ({
  name: 'version-file',
  apply: 'build',
  generateBundle() {
    this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ id: BUILD_ID }) })
  },
})

export default defineConfig({
  plugins: [react(), versionFile()],
  define: { __BUILD_ID__: JSON.stringify(BUILD_ID) },
  build: {
    rollupOptions: {
      output: {
        // Split the vendor (React) out of the app bundle so the >500 kB single
        // chunk becomes a cacheable vendor chunk + a smaller app chunk.
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
        },
      },
    },
  },
})

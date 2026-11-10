import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  // Relative paths so the build works on GitHub Pages
  // (served from /puzzle-box-repaired/) and when opened locally.
  base: './',

  // `npm run build:single` inlines all JS/CSS into one index.html
  // that can be opened by double-clicking, no server needed.
  plugins:
    mode === 'singlefile'
      ? [react(), viteSingleFile()]
      : [react()],

  build:
    mode === 'singlefile'
      ? { outDir: 'dist-single', copyPublicDir: false }
      : {
          // Three.js in its own chunk, cached across game updates. It is
          // ~590 kB on its own, so the warning limit allows for it.
          chunkSizeWarningLimit: 650,
          rolldownOptions: {
            output: {
              codeSplitting: {
                groups: [{ name: 'three', test: /node_modules[\\/]three[\\/]/ }],
              },
            },
          },
        },
}))

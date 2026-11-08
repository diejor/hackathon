import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // SafeSense: relative asset paths so the build works under any GitHub Pages subpath,
  // and the dev server may serve ../web/src (the Help Bot client shared with SpacetimeDB).
  base: './',
  server: { fs: { allow: ['..'] } },
})

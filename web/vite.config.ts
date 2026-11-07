import { defineConfig } from "vite";

// Relative base so the same build works at / (dev) and /hackathon/ (GitHub Pages).
export default defineConfig({
  base: "./",
  build: { target: "es2022", chunkSizeWarningLimit: 2000 },
});

import { defineConfig } from "vite";
import path from "node:path";

export default defineConfig({
  root: __dirname,
  esbuild: { jsx: "automatic" },
  resolve: { alias: { "@": path.resolve(__dirname, "../src") } },
  server: { host: "127.0.0.1", port: 3400, strictPort: true },
  build: { outDir: "dist", emptyOutDir: true },
});

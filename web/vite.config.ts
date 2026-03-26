import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "node:path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:3847",
        changeOrigin: true,
      },
      "/fixtures": {
        target: "http://localhost:3847",
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "dist/client",
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
});

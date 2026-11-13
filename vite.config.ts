import { fileURLToPath } from "node:url";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    // Generates src/routeTree.gen.ts from the files in src/routes.
    tanstackRouter({ target: "react", autoCodeSplitting: true }),
    react()
  ],
  resolve: {
    alias: {
      // Kept in sync with api/contracts.ts (the API's copy).
      "@contracts": fileURLToPath(new URL("./contracts.ts", import.meta.url))
    }
  },
  server: {
    port: 5173,
    strictPort: true
  },
  build: {
    outDir: "dist",
    sourcemap: true
  }
});

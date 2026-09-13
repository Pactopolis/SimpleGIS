import { fileURLToPath, URL } from "node:url";

import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";
import { viteStaticCopy } from "vite-plugin-static-copy";

const CESIUM_BUILD = "node_modules/cesium/Build/Cesium";
const CESIUM_RUNTIME_DIRECTORIES = ["Workers", "ThirdParty", "Assets", "Widgets"];

// Overridable so the dev container can proxy to the `backend` service by
// name instead of localhost (see docker-compose.yml at the repo root).
const MOCK_API = process.env.API_PROXY_TARGET ?? "http://127.0.0.1:8080";

export default defineConfig({
  plugins: [
    vue(),
    viteStaticCopy({
      targets: CESIUM_RUNTIME_DIRECTORIES.map((directory) => ({
        src: `${CESIUM_BUILD}/${directory}`,
        dest: "cesium",
      })),
    }),
  ],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    proxy: { "/v1": MOCK_API },
    // The dev container's bind mount doesn't propagate native filesystem
    // change events (see docker-compose.yml), so chokidar needs to poll
    // instead — only turned on there, since polling costs more CPU.
    watch: process.env.VITE_USE_POLLING === "true" ? { usePolling: true } : undefined,
  },
  preview: { host: true, port: 4173, strictPort: true },
});

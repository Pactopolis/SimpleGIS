import { fileURLToPath, URL } from "node:url";

import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";
import { viteStaticCopy } from "vite-plugin-static-copy";

const CESIUM_BUILD = "node_modules/cesium/Build/Cesium";
const CESIUM_RUNTIME_DIRECTORIES = ["Workers", "ThirdParty", "Assets", "Widgets"];

const MOCK_API = "http://127.0.0.1:8080";

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
  },
  preview: { host: true, port: 4173, strictPort: true },
});

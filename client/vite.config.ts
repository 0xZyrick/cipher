import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";
import mkcert from 'vite-plugin-mkcert';
import basicSsl from "@vitejs/plugin-basic-ssl";

export default defineConfig({
  plugins: [react(), basicSsl(), mkcert()],
  server: { 
    port: 3000,
  },
  define: {
    global: "globalThis",
    "process.env": {},
  },
  resolve: {
    alias: [
      { find: "starknetkit/injected", replacement: resolve(__dirname, "src/stubs/starknetkit-injected.ts") },
      { find: "starknetkit",          replacement: resolve(__dirname, "src/stubs/starknetkit.ts") },
      { find: "@metamask/sdk",        replacement: resolve(__dirname, "src/stubs/metamask.ts") },
      { find: "buffer",               replacement: "buffer/" },
    ],
  },
  optimizeDeps: {
    include: ["buffer"],
    exclude: ["@cartridge/controller-wasm"],
  },
  assetsInclude: ["**/*.wasm"],
});
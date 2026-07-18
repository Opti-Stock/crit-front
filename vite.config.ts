import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  server: {
    proxy: {
      "/api": "http://localhost:3000",
      "/admin": "http://localhost:3001",
      "/checkin": "http://localhost:3002",
      "/super-admin": "http://localhost:3003",
    },
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        admin: resolve(__dirname, "admin.html"),
        superAdmin: resolve(__dirname, "super-admin.html"),
        checkin: resolve(__dirname, "checkin.html"),
        error: resolve(__dirname, "error.html"),
      },
    },
  },
});

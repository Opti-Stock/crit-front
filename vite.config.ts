import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        admin: resolve(__dirname, "admin.html"),
        superAdmin: resolve(__dirname, "super-admin.html"),
        checkin: resolve(__dirname, "checkin.html"),
      },
    },
  },
});

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api/identity": {
        target: "http://127.0.0.1:8001",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/identity/, ""),
      },
      "/api/time": {
        target: "http://127.0.0.1:8002",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/time/, ""),
      },
      "/api/project": {
        target: "http://127.0.0.1:8003",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/project/, ""),
      },
      "/api/partner": {
        target: "http://127.0.0.1:8004",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/partner/, ""),
      },
      "/api/customer": {
        target: "http://127.0.0.1:8005",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/customer/, ""),
      },
    },
  },
});

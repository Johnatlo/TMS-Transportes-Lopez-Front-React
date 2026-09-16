import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 4200,
    // El backend corre en 3000. Con el proxy, el navegador pide a /api del
    // mismo origen y no hay CORS de por medio en desarrollo.
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
});

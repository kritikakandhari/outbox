import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Proxy keeps the auth cookie same-origin, so no CORS setup is needed in dev.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:4000",
      "/auth": "http://localhost:4000",
      "/admin": "http://localhost:4000",
    },
  },
});

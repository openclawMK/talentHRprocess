import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: { port: 5174 },
  build: {
    // This build's output gets copied into the main app's frontend/public/,
    // which is served alongside that app's OWN Vite build (its assets also
    // land in an "assets/" folder) — a distinct name avoids any collision.
    assetsDir: "landing-assets",
  },
});

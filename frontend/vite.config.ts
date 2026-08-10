import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

// In GitHub Codespaces the app is served over an https *.app.github.dev host.
const inCodespaces = !!process.env.CODESPACES;

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg"],
      manifest: {
        name: "Gokulam Dairy Farm ERP",
        short_name: "Gokulam",
        description: "Dairy farm operations — milk, cattle & owners",
        theme_color: "#6395ED",
        background_color: "#ffffff",
        display: "standalone",
        start_url: "/",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        // App shell + navigation fallback so the SPA loads offline.
        navigateFallback: "/index.html",
        runtimeCaching: [
          {
            // Cache GET catalog/read responses so the milk form works offline.
            urlPattern: ({ url }) =>
              url.pathname.startsWith("/api/v1/cattle") ||
              url.pathname.startsWith("/api/v1/owners"),
            handler: "NetworkFirst",
            options: {
              cacheName: "api-catalog",
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 * 7 },
            },
          },
        ],
      },
      devOptions: { enabled: true },
    }),
  ],
  server: {
    host: true, // listen on 0.0.0.0 so Codespaces can forward the port
    port: 5173,
    // Allow the Codespaces preview host to reach the dev server.
    allowedHosts: inCodespaces ? [".app.github.dev"] : undefined,
    // HMR travels over the forwarded https URL on port 443.
    hmr: inCodespaces ? { clientPort: 443 } : undefined,
    proxy: {
      "/api": { target: "http://127.0.0.1:8000", changeOrigin: true },
      "/media": { target: "http://127.0.0.1:8000", changeOrigin: true },
    },
  },
});

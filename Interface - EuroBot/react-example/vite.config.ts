import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  // Configura proxy para chamadas de NetworkTables

  

  server: {
    proxy: {
    // sempre que o navegador pedir /start-nt/...
      // Vite vai encaminhar a http://localhost:3001/start-nt/...
      "^/start-nt(/.*)?$": {
        target: "http://localhost:3001",
        changeOrigin: true,
        rewrite: (path) => path, // mantém /start-nt/cable ou /start-nt/wifi
      },
    },
  },


   // Proxy em modo preview (build)
   preview: {
    port: 4173,
    proxy: {
      "^/start-nt(/.*)?$": {
        target: "http://localhost:3001",
        changeOrigin: true,
        rewrite: (path) => path,
      },
    },
  },

  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "Eurobot Dashboard",
        short_name: "Eurobot",
        description: "Interface para controle e monitoramento",
        theme_color: "#34C759",
        background_color: "#f3f3e7",
        display: "standalone",
        start_url: "/",
        icons: [
          {
            src: "/Euro Logo.png",
            sizes: "192x192",
            type: "image/png"
          },
          {
            src: "/Euro Logo.png",
            sizes: "512x512",
            type: "image/png"
          }
        ]
      },
      workbox: {
        runtimeCaching: [
          {
            urlPattern: /.*\.(png|jpg|jpeg|svg|gif|ttf)$/,
            handler: "CacheFirst",
            options: {
              cacheName: "images",
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 30 * 24 * 60 * 60,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: /.*\.(css|js)/,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "static-resources",
              expiration: {
                maxEntries: 30,
                maxAgeSeconds: 7 * 24 * 60 * 60,
              },
            },
          },
          {
            urlPattern: /^https:\/\/.*\/stream/,
            handler: "NetworkOnly",
            options: {
              cacheName: "stream-cache",
              expiration: {
                maxEntries: 1,
                maxAgeSeconds: 60,
              },
            },
          },
        ],
      }
    })
  ]
});
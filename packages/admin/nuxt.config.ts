import { fileURLToPath } from "node:url"

// The Nuxt Medusa admin, as a Nuxt layer.
// In your admin app's nuxt.config.ts: extends: ["@nuxt-medusa/admin"]
//
// The admin is a single-page app: it only runs in the browser and talks to the
// Medusa Admin API. No server rendering is needed.
export default defineNuxtConfig({
  compatibilityDate: "2026-11-01",
  ssr: false,
  // admin-kit: extension system (widgets in zones, sidebar links, settings tabs).
  modules: ["@nuxt/ui", "@nuxt-medusa/admin-kit"],
  // Paths in a layer must be absolute, or they'd point into the app using it.
  css: [fileURLToPath(new URL("./app/assets/css/main.css", import.meta.url))],
  app: {
    head: {
      title: "Admin",
      meta: [
        { name: "robots", content: "noindex, nofollow" },
        // Let the layout use the full screen on phones with a notch.
        { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
        { name: "theme-color", content: "#fbfaf7", media: "(prefers-color-scheme: light)" },
        { name: "theme-color", content: "#121110", media: "(prefers-color-scheme: dark)" },
      ],
    },
  },
  runtimeConfig: {
    public: {
      // Set with NUXT_PUBLIC_MEDUSA_BACKEND_URL
      medusaBackendUrl: "http://localhost:9000",
    },
  },
  icon: {
    // Bundle the Lucide icons we use into the app, so none are fetched online.
    // These patterns are checked in every layer, including the app using this one.
    serverBundle: "local",
    clientBundle: {
      scan: { globInclude: ["app/**/*.{vue,ts}", "layers/**/*.{vue,ts}"] },
    },
  },
})

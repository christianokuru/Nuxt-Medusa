// The admin is a single-page app: it only runs in the browser and talks to the
// Medusa Admin API. No server rendering is needed.
export default defineNuxtConfig({
  compatibilityDate: "2026-11-01",
  ssr: false,
  modules: ["@nuxt/ui"],
  css: ["~/assets/css/main.css"],
  devtools: { enabled: true },
  devServer: { port: 3001 },
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
    serverBundle: "local",
    clientBundle: {
      scan: { globInclude: ["app/**/*.{vue,ts}"] },
    },
  },
})

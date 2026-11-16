// This app is the admin dashboard, put together from installed packages:
// - @nuxt-medusa/admin: the admin itself (orders, products, customers, settings...)
// - the admin parts of installed Medusa plugins (Home page, email settings)
// Extensions in ./layers/<name>/ are picked up automatically.
export default defineNuxtConfig({
  compatibilityDate: "2026-11-01",
  extends: [
    "@nuxt-medusa/admin",
    "@nuxt-medusa/medusa-analytics/nuxt-admin",
    "@nuxt-medusa/medusa-resend/nuxt-admin",
  ],
  devtools: { enabled: true },
  devServer: { port: 3001 },
})

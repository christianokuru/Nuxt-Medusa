import Medusa from "@medusajs/js-sdk"

// One shared Medusa SDK client for the whole admin.
// "session" auth: after login the backend sets an httpOnly cookie,
// so no token is kept in browser storage.
export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig()

  const medusa = new Medusa({
    baseUrl: config.public.medusaBackendUrl,
    auth: { type: "session" },
    debug: import.meta.dev,
  })

  return { provide: { medusa } }
})

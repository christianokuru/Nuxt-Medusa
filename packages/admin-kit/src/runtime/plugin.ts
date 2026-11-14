import { defineNuxtPlugin } from "#app"
import extensions from "#admin-extensions"
import { createRegistry } from "./registry"

export default defineNuxtPlugin({
  name: "admin-kit",
  setup() {
    return { provide: { adminExtensions: createRegistry(extensions) } }
  },
})

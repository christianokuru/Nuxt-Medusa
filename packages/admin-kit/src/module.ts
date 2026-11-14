import { existsSync } from "node:fs"
import { join, relative } from "node:path"
import {
  addComponent,
  addImports,
  addPlugin,
  addTemplate,
  addTypeTemplate,
  createResolver,
  defineNuxtModule,
} from "@nuxt/kit"

const ENTRY_NAMES = ["admin.extension.ts", "admin.extension.js", "admin.extension.mjs"]

/**
 * Admin extension system.
 *
 * Any Nuxt layer used by the admin (a folder in `apps/admin/layers/`, or a package
 * listed in `extends`) can add an `admin.extension.ts` file at its root. This module
 * collects them all, so their widgets show up in `<AdminZone>` spots and their links
 * show up in the sidebar. Pages and components in the layer work as normal Nuxt files.
 */
export default defineNuxtModule({
  meta: {
    name: "@nuxt-medusa/admin-kit",
    configKey: "adminKit",
  },
  setup(_options, nuxt) {
    const resolver = createResolver(import.meta.url)

    const findEntries = () =>
      nuxt.options._layers
        .map(layer => ENTRY_NAMES.map(name => join(layer.config.rootDir, name)).find(existsSync))
        .filter((file): file is string => !!file)

    const template = addTemplate({
      filename: "admin-extensions.mjs",
      write: true,
      getContents: () => {
        const entries = findEntries()
        const imports = entries.map((file, i) => `import extension${i} from ${JSON.stringify(file)}`)
        return [...imports, `export default [${entries.map((_, i) => `extension${i}`).join(", ")}]`, ""].join("\n")
      },
    })
    nuxt.options.alias["#admin-extensions"] = template.dst

    addTypeTemplate({
      filename: "types/admin-extensions.d.ts",
      getContents: () => [
        `declare module "#admin-extensions" {`,
        `  const extensions: import(${JSON.stringify(resolver.resolve("./runtime/define"))}).AdminExtension[]`,
        `  export default extensions`,
        `}`,
        `declare module "#app" {`,
        `  interface NuxtApp {`,
        `    $adminExtensions: import(${JSON.stringify(resolver.resolve("./runtime/registry"))}).AdminExtensionRegistry`,
        `  }`,
        `}`,
        `export {}`,
        "",
      ].join("\n"),
    })

    addPlugin(resolver.resolve("./runtime/plugin"))
    addImports([
      { name: "defineAdminExtension", from: resolver.resolve("./runtime/define") },
      { name: "defineAdminWidget", from: resolver.resolve("./runtime/define") },
      { name: "useAdminExtensions", from: resolver.resolve("./runtime/composables") },
    ])
    addComponent({ name: "AdminZone", filePath: resolver.resolve("./runtime/components/AdminZone.vue") })

    // The runtime is TypeScript source; let Nuxt compile it.
    nuxt.options.build.transpile.push(resolver.resolve("./runtime"))

    // Restart the dev server when an extension entry file is added or removed.
    nuxt.hook("builder:watch", async (event, path) => {
      if ((event === "add" || event === "unlink") && ENTRY_NAMES.some(name => path.endsWith(name))) {
        await nuxt.callHook("restart")
      }
    })

    nuxt.hook("ready", () => {
      const entries = findEntries()
      if (entries.length) {
        console.info(`[admin-kit] ${entries.length} extension(s): ${entries.map(f => relative(nuxt.options.rootDir, f)).join(", ")}`)
      }
    })
  },
})

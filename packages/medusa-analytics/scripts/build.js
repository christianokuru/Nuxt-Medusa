// Compiles the plugin's backend code (src/) into .medusa/server.
// We don't use `medusa plugin:build` because it also builds React admin screens,
// and this plugin's admin screens are Nuxt (see nuxt-admin/).
const { Compiler } = require("@medusajs/framework/build-tools")
const { logger } = require("@medusajs/framework/logger")

;(async () => {
  const compiler = new Compiler(process.cwd(), logger)
  const tsConfig = await compiler.loadTSConfigFile()
  const ok = tsConfig && (await compiler.buildPluginBackend(tsConfig))
  process.exit(ok ? 0 : 1)
})()

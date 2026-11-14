import { loadEnv, defineConfig, Modules } from "@medusajs/framework/utils"

loadEnv(process.env.NODE_ENV || "development", process.cwd())

const REDIS_URL = process.env.REDIS_URL

// Hosted databases (Supabase, Railway, Neon...) need SSL. Local Postgres does not.
const useDbSsl = process.env.DATABASE_SSL === "true"

// With REDIS_URL set, cache, events, workflows and locks run on Redis.
// Without it, Medusa falls back to in-memory versions (fine for local dev only).
const redisModules = REDIS_URL
  ? [
      {
        key: Modules.CACHING,
        resolve: "@medusajs/medusa/caching",
        options: {
          providers: [
            {
              resolve: "@medusajs/medusa/caching-redis",
              id: "caching-redis",
              is_default: true,
              options: { redisUrl: REDIS_URL },
            },
          ],
        },
      },
      {
        key: Modules.EVENT_BUS,
        resolve: "@medusajs/medusa/event-bus-redis",
        options: { redisUrl: REDIS_URL },
      },
      {
        key: Modules.WORKFLOW_ENGINE,
        resolve: "@medusajs/medusa/workflow-engine-redis",
        options: { redis: { redisUrl: REDIS_URL } },
      },
      {
        key: Modules.LOCKING,
        resolve: "@medusajs/medusa/locking",
        options: {
          providers: [
            {
              resolve: "@medusajs/medusa/locking-redis",
              id: "locking-redis",
              is_default: true,
              options: { redisUrl: REDIS_URL },
            },
          ],
        },
      },
    ]
  : []

module.exports = defineConfig({
  projectConfig: {
    databaseUrl: process.env.DATABASE_URL,
    databaseDriverOptions: useDbSsl
      ? { connection: { ssl: { rejectUnauthorized: false } } }
      : {},
    redisUrl: REDIS_URL,
    // "shared" runs API + background jobs in one process (dev).
    // In production run one "server" and one "worker" instance.
    workerMode: (process.env.MEDUSA_WORKER_MODE as
      | "shared"
      | "worker"
      | "server") || "shared",
    http: {
      storeCors: process.env.STORE_CORS!,
      adminCors: process.env.ADMIN_CORS!,
      authCors: process.env.AUTH_CORS!,
      jwtSecret: process.env.JWT_SECRET || "supersecret",
      cookieSecret: process.env.COOKIE_SECRET || "supersecret",
    },
  },
  // The React admin is turned off. Our Vue/Nuxt admin lives in apps/admin.
  admin: {
    disable: true,
  },
  modules: redisModules,
})

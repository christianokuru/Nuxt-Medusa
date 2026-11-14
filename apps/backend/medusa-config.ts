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

// Payment providers. Each is turned on only when its secret key is set.
// Provider ids in Medusa: pp_paystack_paystack, pp_flutterwave_flutterwave.
// Webhook URLs: <backend>/hooks/payment/paystack_paystack and /hooks/payment/flutterwave_flutterwave
const paymentProviders = [
  process.env.PAYSTACK_SECRET_KEY && {
    resolve: "./src/modules/paystack",
    id: "paystack",
    options: {
      secretKey: process.env.PAYSTACK_SECRET_KEY,
      callbackUrl: process.env.PAYSTACK_CALLBACK_URL,
    },
  },
  process.env.FLUTTERWAVE_SECRET_KEY && {
    resolve: "./src/modules/flutterwave",
    id: "flutterwave",
    options: {
      secretKey: process.env.FLUTTERWAVE_SECRET_KEY,
      webhookHash: process.env.FLUTTERWAVE_WEBHOOK_HASH,
      redirectUrl: process.env.FLUTTERWAVE_REDIRECT_URL,
      storeName: process.env.STORE_NAME,
    },
  },
].filter(Boolean) as { resolve: string, id: string, options: Record<string, unknown> }[]

const paymentModule = paymentProviders.length
  ? [{ key: Modules.PAYMENT, resolve: "@medusajs/medusa/payment", options: { providers: paymentProviders } }]
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
  modules: [...redisModules, ...paymentModule],
})

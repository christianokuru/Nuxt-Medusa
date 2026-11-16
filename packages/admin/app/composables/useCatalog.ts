import type { HttpTypes } from "@medusajs/types"

// Lists used by product forms (collections, tags, channels...).
// Each is loaded once and shared between all modals.
export const useCatalog = () => {
  const medusa = useMedusa()

  const load = <T>(key: string, fn: () => Promise<T>, fallback: T) =>
    useAsyncData(`catalog:${key}`, fn, { default: () => fallback, dedupe: "defer" })

  return {
    collections: () =>
      load("collections", async () =>
        (await medusa.admin.productCollection.list({ limit: 200, fields: "id,title" })).collections,
      [] as HttpTypes.AdminCollection[]),
    types: () =>
      load("types", async () =>
        (await medusa.admin.productType.list({ limit: 200, fields: "id,value" })).product_types,
      [] as HttpTypes.AdminProductType[]),
    tags: () =>
      load("tags", async () =>
        (await medusa.admin.productTag.list({ limit: 500, fields: "id,value" })).product_tags,
      [] as HttpTypes.AdminProductTag[]),
    categories: () =>
      load("categories", async () =>
        (await medusa.admin.productCategory.list({ limit: 500, fields: "id,name,parent_category_id" })).product_categories,
      [] as HttpTypes.AdminProductCategory[]),
    salesChannels: () =>
      load("sales-channels", async () =>
        (await medusa.admin.salesChannel.list({ limit: 100, fields: "id,name,description,is_disabled" })).sales_channels,
      [] as HttpTypes.AdminSalesChannel[]),
    store: () =>
      load("store", async () => {
        const { stores } = await medusa.admin.store.list({ fields: "id,name,default_sales_channel_id" })
        return stores[0] ?? null
      }, null as HttpTypes.AdminStore | null),
    currencies: () =>
      load("currencies", async () => {
        const { stores } = await medusa.admin.store.list({ fields: "id,*supported_currencies" })
        const list = stores[0]?.supported_currencies ?? []
        // Default currency first.
        return [...list].sort((a, b) => Number(b.is_default) - Number(a.is_default))
      }, [] as HttpTypes.AdminStoreCurrency[]),
    shippingProfiles: () =>
      load("shipping-profiles", async () =>
        (await medusa.admin.shippingProfile.list({ limit: 50, fields: "id,name,type" })).shipping_profiles,
      [] as HttpTypes.AdminShippingProfile[]),
  }
}

// Clear cached lists after creating something new (e.g. a tag).
export const refreshCatalog = (key: string) => refreshNuxtData(`catalog:${key}`)

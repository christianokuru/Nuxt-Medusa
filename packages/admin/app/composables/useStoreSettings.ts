import type { HttpTypes } from "@medusajs/types"

// The store record with its currencies. Shared by the settings pages.
export const useStoreSettings = () => {
  const medusa = useMedusa()
  return useAsyncData("settings:store", async () => {
    const { stores } = await medusa.admin.store.list({
      fields: "id,name,default_sales_channel_id,default_region_id,*supported_currencies",
    })
    return (stores[0] ?? null) as HttpTypes.AdminStore | null
  })
}

// All currencies Medusa knows, for pickers.
export const useAllCurrencies = () => {
  const medusa = useMedusa()
  return useAsyncData("settings:all-currencies", async () =>
    (await medusa.admin.currency.list({ limit: 400, order: "code" })).currencies,
  { default: () => [] as HttpTypes.AdminCurrency[] })
}

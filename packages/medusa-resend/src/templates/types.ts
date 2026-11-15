/** Store details shown in every email. Set them in the plugin options (`brand`). */
export interface EmailBrand {
  /** Store name. Defaults to the name in Medusa's store settings. */
  name: string
  /** Logo image URL (PNG or JPG, about 160px wide). Without it, the name is shown in type. */
  logoUrl?: string
  /** Button and accent colour. Default near-black. */
  color?: string
  /** Your storefront's address, e.g. https://shop.example.com */
  storeUrl?: string
  /** Where customers can write for help. */
  supportEmail?: string
  /** Postal address for the footer (many countries require it). */
  address?: string
  /** Locale for dates and prices, e.g. "en-NG". Default "en-US". */
  locale?: string
}

export interface EmailOrderItem {
  title: string
  subtitle?: string | null
  quantity: number
  /** Line total in main units (12.5 = 12.50). */
  total: number
  thumbnail?: string | null
}

export interface EmailAddress {
  name: string
  lines: string[]
}

export interface EmailOrder {
  id: string
  display_id: number | string
  created_at: string
  email: string
  currency_code: string
  items: EmailOrderItem[]
  subtotal: number
  shipping_total: number
  discount_total: number
  tax_total: number
  total: number
  shipping_address?: EmailAddress | null
  shipping_method?: string | null
  /** Link to the order on your store, if you have an order page. */
  url?: string | null
}

export interface EmailTracking {
  number?: string | null
  url?: string | null
}

/** Data every order email receives. */
export interface OrderEmailData {
  brand: EmailBrand
  order: EmailOrder
  customer_name?: string | null
  /** Shipped email: tracking numbers and links. */
  tracking?: EmailTracking[]
  /** Shipped and delivered emails: the items in this shipment. */
  shipment_items?: EmailOrderItem[]
}

export interface RenderedEmail {
  subject: string
  html: string
  text: string
}

// Medusa v2 stores amounts in the main currency unit (10 = 10.00).
export function formatMoney(amount: number | null | undefined, currency: string) {
  if (amount === null || amount === undefined) {
    return "-"
  }
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency.toUpperCase(),
      maximumFractionDigits: 2,
    }).format(amount)
  } catch {
    return `${amount} ${currency.toUpperCase()}`
  }
}

export function currencySymbol(currency: string) {
  try {
    const parts = new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency.toUpperCase(),
    }).formatToParts(0)
    return parts.find(p => p.type === "currency")?.value ?? currency.toUpperCase()
  } catch {
    return currency.toUpperCase()
  }
}

type PriceLike = { amount: number, currency_code: string }

// "€10 - €20" style range for a set of variants, in one currency.
export function priceRange(
  variants: { prices?: PriceLike[] | null }[] | null | undefined,
  currency: string,
) {
  const amounts = (variants ?? [])
    .flatMap(v => v.prices ?? [])
    .filter(p => p.currency_code === currency)
    .map(p => p.amount)
  if (!amounts.length) {
    return null
  }
  const min = Math.min(...amounts)
  const max = Math.max(...amounts)
  return min === max
    ? formatMoney(min, currency)
    : `${formatMoney(min, currency)} – ${formatMoney(max, currency)}`
}

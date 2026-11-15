// Friendly names for Medusa payment provider ids.
const KNOWN: Record<string, { name: string, description: string, icon: string }> = {
  pp_system_default: {
    name: "Manual payment",
    description: "No online payment. Mark orders as paid yourself (bank transfer, cash on delivery).",
    icon: "i-lucide-hand-coins",
  },
  pp_paystack_paystack: {
    name: "Paystack",
    description: "Cards, bank transfer and mobile money. Nigeria, Ghana, Kenya, South Africa.",
    icon: "i-lucide-credit-card",
  },
  pp_flutterwave_flutterwave: {
    name: "Flutterwave",
    description: "Cards, bank transfer, USSD and mobile money across Africa.",
    icon: "i-lucide-wallet",
  },
  pp_stripe_stripe: {
    name: "Stripe",
    description: "Cards and wallets worldwide.",
    icon: "i-lucide-credit-card",
  },
}

export function paymentProviderInfo(id: string) {
  const known = KNOWN[id]
  if (known) {
    return known
  }
  // pp_<identifier>_<id> -> "Identifier"
  const name = id.replace(/^pp_/, "").split("_")[0] ?? id
  return { name: capitalize(name), description: id, icon: "i-lucide-credit-card" }
}

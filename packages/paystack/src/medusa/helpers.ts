import { BigNumber, MedusaError } from "@medusajs/framework/utils"
import type { BigNumberInput, PaymentProviderContext } from "@medusajs/framework/types"
import { ProviderError } from "../utils"

/** Medusa amount (BigNumber, string or number, in main units) -> plain number. */
export function toNumber(amount: BigNumberInput): number {
  return Number(new BigNumber(amount).numeric)
}

/** Customer email for the payment page: from the customer, or what the store sent. */
export function customerEmail(context: PaymentProviderContext | undefined, data: Record<string, unknown> | undefined): string | null {
  const fromCustomer = context?.customer?.email
  if (fromCustomer) {
    return fromCustomer
  }
  const client = (data?.client ?? {}) as Record<string, unknown>
  const candidate = data?.email ?? client.email
  return typeof candidate === "string" && /.+@.+\..+/.test(candidate) ? candidate : null
}

/** Run a provider call and turn its errors into Medusa errors. */
export async function medusaErrors<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run()
  }
  catch (error) {
    if (error instanceof ProviderError) {
      throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, error.message)
    }
    throw error
  }
}

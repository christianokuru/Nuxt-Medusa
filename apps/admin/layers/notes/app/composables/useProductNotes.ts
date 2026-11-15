import type { HttpTypes } from "@medusajs/types"

// Notes are kept in the product's metadata, so no backend changes are needed.
const NOTE_KEY = "admin_notes"
const UPDATED_KEY = "admin_notes_updated_at"

export function productNote(product: Pick<HttpTypes.AdminProduct, "metadata">) {
  const value = product.metadata?.[NOTE_KEY]
  return typeof value === "string" ? value : ""
}

export function productNoteUpdatedAt(product: Pick<HttpTypes.AdminProduct, "metadata">) {
  const value = product.metadata?.[UPDATED_KEY]
  return typeof value === "string" ? value : null
}

export const useProductNotes = () => {
  const medusa = useMedusa()

  async function save(product: HttpTypes.AdminProduct, note: string) {
    const text = note.trim()
    await medusa.admin.product.update(product.id, {
      metadata: {
        ...(product.metadata ?? {}),
        [NOTE_KEY]: text,
        [UPDATED_KEY]: text ? new Date().toISOString() : "",
      },
    })
  }

  return { save }
}

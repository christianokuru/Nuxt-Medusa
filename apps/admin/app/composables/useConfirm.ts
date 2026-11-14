import { AppConfirmModal } from "#components"

type ConfirmOptions = {
  title: string
  description?: string
  confirmLabel?: string
  danger?: boolean
  onConfirm?: () => Promise<unknown> | unknown
}

// const ok = await confirm({ title: "Delete product?", danger: true, onConfirm: () => ... })
export const useConfirm = () => {
  const overlay = useOverlay()
  const modal = overlay.create(AppConfirmModal)
  return (options: ConfirmOptions) => modal.open(options).result
}

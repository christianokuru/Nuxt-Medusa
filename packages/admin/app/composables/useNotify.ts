// Short, consistent success and error messages.
export const useNotify = () => {
  const toast = useToast()
  return {
    success: (title: string, description?: string) =>
      toast.add({ title, description, icon: "i-lucide-check", color: "success" }),
    error: (error: unknown, title = "Something went wrong") =>
      toast.add({ title, description: errorMessage(error), icon: "i-lucide-circle-alert", color: "error" }),
  }
}

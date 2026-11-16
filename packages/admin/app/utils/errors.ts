// Turn an SDK or network error into a short message for the user.
export function errorMessage(error: unknown, fallback = "Something went wrong.") {
  if (error && typeof error === "object" && "message" in error) {
    const message = String((error as { message: unknown }).message)
    if (message) {
      return message
    }
  }
  return fallback
}

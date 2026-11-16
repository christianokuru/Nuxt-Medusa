import type { HttpTypes } from "@medusajs/types"

export const useAuth = () => {
  const medusa = useMedusa()
  const user = useState<HttpTypes.AdminUser | null>("auth:user", () => null)
  // True once we have asked the backend whether a session exists.
  const checked = useState("auth:checked", () => false)

  async function fetchUser() {
    try {
      const { user: me } = await medusa.admin.user.me()
      user.value = me
    } catch {
      user.value = null
    } finally {
      checked.value = true
    }
    return user.value
  }

  async function login(email: string, password: string) {
    const result = await medusa.auth.login("user", "emailpass", {
      email,
      password,
    })
    if (typeof result !== "string") {
      // Third-party login, MFA or verification steps are not supported yet.
      throw new Error("This login method is not supported yet.")
    }
    const me = await fetchUser()
    if (!me) {
      throw new Error("Could not load your account.")
    }
    return me
  }

  async function logout() {
    try {
      await medusa.auth.logout()
    } finally {
      user.value = null
      await navigateTo("/login")
    }
  }

  return { user, checked, fetchUser, login, logout }
}

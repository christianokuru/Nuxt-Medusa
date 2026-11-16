// Every page needs a logged-in user, except pages marked `public: true`.
export default defineNuxtRouteMiddleware(async (to) => {
  const { user, checked, fetchUser } = useAuth()

  if (!checked.value) {
    await fetchUser()
  }

  if (to.meta.public) {
    // Logged-in users do not need the login page.
    if (user.value && to.path === "/login") {
      return navigateTo("/")
    }
    return
  }

  if (!user.value) {
    return navigateTo({
      path: "/login",
      query: to.fullPath !== "/" ? { redirect: to.fullPath } : {},
    })
  }
})

// "/" is the Home page from the analytics extension. Without it, start on Orders.
export default defineNuxtRouteMiddleware((to) => {
  if (to.path === "/" && !to.matched.length) {
    return navigateTo("/orders", { replace: true })
  }
})

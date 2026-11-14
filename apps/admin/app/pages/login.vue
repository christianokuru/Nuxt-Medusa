<script setup lang="ts">
import type { AuthFormField, FormSubmitEvent } from "@nuxt/ui"

definePageMeta({ layout: "auth", public: true })
useHead({ title: "Log in" })

const { login } = useAuth()
const route = useRoute()
const error = ref("")
const loading = ref(false)

const fields: AuthFormField[] = [
  { name: "email", type: "email", label: "Email", placeholder: "you@example.com", required: true },
  { name: "password", type: "password", label: "Password", required: true },
]

type LoginForm = { email: string, password: string }

function validate(state: Partial<LoginForm>) {
  const errors = []
  if (!state.email) {
    errors.push({ name: "email", message: "Enter your email" })
  }
  if (!state.password) {
    errors.push({ name: "password", message: "Enter your password" })
  }
  return errors
}

async function onSubmit(event: FormSubmitEvent<LoginForm>) {
  error.value = ""
  loading.value = true
  try {
    await login(event.data.email, event.data.password)
    const redirect = typeof route.query.redirect === "string" ? route.query.redirect : "/"
    // Only allow redirects inside the admin.
    await navigateTo(redirect.startsWith("/") && !redirect.startsWith("//") ? redirect : "/")
  } catch (e) {
    error.value = errorMessage(e, "Could not log in.")
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <UPageCard class="w-full max-w-sm">
    <UAuthForm
      title="Welcome back"
      description="Log in to manage your store."
      icon="i-lucide-store"
      :fields="fields"
      :validate="validate"
      :loading="loading"
      :submit="{ label: 'Log in', block: true }"
      @submit="onSubmit"
    >
      <template v-if="error" #validation>
        <UAlert color="error" variant="subtle" icon="i-lucide-circle-alert" :title="error" />
      </template>
    </UAuthForm>
  </UPageCard>
</template>

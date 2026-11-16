<script setup lang="ts">
import type { HttpTypes } from "@medusajs/types"

const props = defineProps<{ product: HttpTypes.AdminProduct }>()
defineEmits<{ close: [saved: boolean] }>()

const medusa = useMedusa()
const p = props.product
const form = reactive({
  weight: p.weight ?? null,
  length: p.length ?? null,
  width: p.width ?? null,
  height: p.height ?? null,
  material: p.material ?? "",
  origin_country: p.origin_country ?? "",
  hs_code: p.hs_code ?? "",
  mid_code: p.mid_code ?? "",
})

const num = (v: number | null | undefined) => (v === null || v === undefined || Number.isNaN(v) ? null : Number(v))
const text = (v: string) => v.trim() || null

async function submit() {
  await medusa.admin.product.update(p.id, {
    weight: num(form.weight),
    length: num(form.length),
    width: num(form.width),
    height: num(form.height),
    material: text(form.material),
    origin_country: text(form.origin_country)?.toLowerCase() ?? null,
    hs_code: text(form.hs_code),
    mid_code: text(form.mid_code),
  })
}
</script>

<template>
  <AppFormModal title="Attributes" description="Used for shipping and customs." :submit="submit" @close="(v) => $emit('close', v)">
    <div class="grid grid-cols-2 gap-6">
      <UFormField label="Weight" hint="grams">
        <UInputNumber v-model="form.weight" :min="0" :increment="false" :decrement="false" class="w-full" />
      </UFormField>
      <UFormField label="Length" hint="cm">
        <UInputNumber v-model="form.length" :min="0" :increment="false" :decrement="false" class="w-full" />
      </UFormField>
      <UFormField label="Width" hint="cm">
        <UInputNumber v-model="form.width" :min="0" :increment="false" :decrement="false" class="w-full" />
      </UFormField>
      <UFormField label="Height" hint="cm">
        <UInputNumber v-model="form.height" :min="0" :increment="false" :decrement="false" class="w-full" />
      </UFormField>
      <UFormField label="Material">
        <UInput v-model="form.material" class="w-full" />
      </UFormField>
      <UFormField label="Country of origin" hint="2-letter code">
        <UInput v-model="form.origin_country" maxlength="2" placeholder="it" class="w-full" />
      </UFormField>
      <UFormField label="HS code">
        <UInput v-model="form.hs_code" class="w-full" />
      </UFormField>
      <UFormField label="MID code">
        <UInput v-model="form.mid_code" class="w-full" />
      </UFormField>
    </div>
  </AppFormModal>
</template>

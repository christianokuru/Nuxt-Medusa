<script setup lang="ts">
// Sales as thin bars, one per hour/day/week. Hover, tap or use the arrow keys
// to read a bar. `table` swaps the chart for the same numbers as a table.
const props = defineProps<{
  bars: ChartBar[]
  currency: string
  table?: boolean
}>()

const HEIGHT = 200
const TOP = 8
const BOTTOM = 26 // room for the date labels
const plotHeight = HEIGHT - TOP - BOTTOM

const root = ref<HTMLElement>()
const width = ref(0)
let observer: ResizeObserver | undefined
onMounted(() => {
  observer = new ResizeObserver(([entry]) => {
    width.value = Math.floor(entry!.contentRect.width)
  })
  observer.observe(root.value!)
})
onBeforeUnmount(() => observer?.disconnect())

const top = computed(() => niceCeiling(Math.max(0, ...props.bars.map(b => b.sales))))
const ticks = computed(() => [0, top.value / 2, top.value])
const yFor = (value: number) => TOP + plotHeight - (value / top.value) * plotHeight

// Room on the left for the money labels, sized to the longest one.
const gutter = computed(() => Math.ceil(Math.max(...ticks.value.map(t => tick(t).length)) * 6.6) + 10)
const plotWidth = computed(() => Math.max(0, width.value - gutter.value))
const band = computed(() => (props.bars.length ? plotWidth.value / props.bars.length : 0))
const xAt = (i: number) => gutter.value + i * band.value
// Thin bars, never wider than 24px, always with air between them.
const barWidth = computed(() => Math.max(2, Math.min(24, band.value * 0.62)))

function barPath(i: number, value: number) {
  const w = barWidth.value
  const x = xAt(i) + (band.value - w) / 2
  const base = TOP + plotHeight
  const h = Math.max(2, base - yFor(value))
  const y = base - h
  const r = Math.min(4, w / 2, h)
  // Rounded at the top, square at the baseline.
  return `M${x},${base}L${x},${y + r}Q${x},${y} ${x + r},${y}L${x + w - r},${y}Q${x + w},${y} ${x + w},${y + r}L${x + w},${base}Z`
}

const xLabels = computed(() => {
  const n = props.bars.length
  if (!n) {
    return []
  }
  const picks = n > 2 ? [0, Math.floor((n - 1) / 2), n - 1] : [...Array(n).keys()]
  return picks.map((i, k) => ({
    text: props.bars[i]!.label,
    x: k === 0 ? gutter.value : k === picks.length - 1 ? width.value : xAt(i) + band.value / 2,
    anchor: k === 0 ? "start" : k === picks.length - 1 ? "end" : "middle",
  }))
})

const active = ref<number | null>(null)
const activeBar = computed(() => (active.value === null ? null : props.bars[active.value] ?? null))
const tooltipLeft = computed(() => {
  if (active.value === null) {
    return 0
  }
  const center = xAt(active.value) + band.value / 2
  return Math.min(Math.max(center, 80), Math.max(80, width.value - 80))
})

function onKey(event: KeyboardEvent) {
  const n = props.bars.length
  if (!n) {
    return
  }
  const current = active.value ?? n - 1
  if (event.key === "ArrowLeft") {
    active.value = Math.max(0, current - 1)
  }
  else if (event.key === "ArrowRight") {
    active.value = Math.min(n - 1, current + 1)
  }
  else if (event.key === "Home") {
    active.value = 0
  }
  else if (event.key === "End") {
    active.value = n - 1
  }
  else {
    return
  }
  event.preventDefault()
}

const money = (n: number) => formatMoney(n, props.currency)
const tick = (n: number) => formatMoneyCompact(n, props.currency)
const ordersLabel = (n: number) => plural(n, "order")
</script>

<template>
  <div>
    <div v-show="!table" ref="root" class="relative select-none">
      <svg
        v-if="width"
        :width="width"
        :height="HEIGHT"
        :viewBox="`0 0 ${width} ${HEIGHT}`"
        class="block overflow-visible outline-none focus-visible:ring-2 focus-visible:ring-inverted/20 rounded-sm"
        tabindex="0"
        role="group"
        :aria-label="`Sales chart with ${bars.length} bars. Use the left and right arrow keys to read each one.`"
        @keydown="onKey"
        @focus="active ??= bars.length - 1"
        @blur="active = null"
        @pointerleave="active = null"
      >
        <!-- Gridlines with their labels sitting just above. -->
        <g>
          <template v-for="t in ticks" :key="t">
            <line :x1="gutter" :x2="width" :y1="yFor(t) + 0.5" :y2="yFor(t) + 0.5" class="stroke-(--ui-border)" stroke-width="1" />
            <text :x="gutter - 10" :y="yFor(t) + 4" text-anchor="end" class="fill-(--ui-text-dimmed) text-[11px] tabular-nums">{{ tick(t) }}</text>
          </template>
        </g>

        <g>
          <template v-for="(bar, i) in bars" :key="i">
            <path
              v-if="bar.sales > 0"
              :d="barPath(i, bar.sales)"
              class="fill-(--ui-primary) transition-opacity duration-150"
              :class="active !== null && active !== i ? 'opacity-30' : ''"
            />
          </template>
        </g>

        <!-- Hit areas: the whole column, not just the painted bar. -->
        <g>
          <rect
            v-for="(bar, i) in bars"
            :key="i"
            :x="xAt(i)"
            :y="TOP"
            :width="band"
            :height="plotHeight"
            fill="transparent"
            @pointerenter="active = i"
            @pointerdown="active = i"
          />
        </g>

        <g>
          <text
            v-for="label in xLabels"
            :key="label.x"
            :x="label.x"
            :y="HEIGHT - 6"
            :text-anchor="label.anchor"
            class="fill-(--ui-text-muted) text-[11px]"
          >{{ label.text }}</text>
        </g>
      </svg>

      <div
        v-if="activeBar"
        class="pointer-events-none absolute top-0 -translate-x-1/2 -translate-y-[calc(100%+4px)] rounded-md bg-default ring ring-default shadow-lg px-3 py-2 whitespace-nowrap"
        :style="{ left: `${tooltipLeft}px` }"
        aria-hidden="true"
      >
        <p class="text-sm font-semibold text-highlighted">
          {{ money(activeBar.sales) }}
        </p>
        <p class="text-xs text-muted mt-0.5">
          {{ activeBar.detail }} · {{ ordersLabel(activeBar.orders) }}
        </p>
      </div>
      <p class="sr-only" aria-live="polite">
        <template v-if="activeBar">
          {{ activeBar.detail }}: {{ money(activeBar.sales) }}, {{ ordersLabel(activeBar.orders) }}
        </template>
      </p>
    </div>

    <div v-if="table" class="max-h-72 overflow-y-auto -mx-1 px-1">
      <table class="w-full text-sm">
        <thead class="sticky top-0 bg-default">
          <tr class="text-left text-xs text-muted">
            <th class="font-normal py-2">
              When
            </th>
            <th class="font-normal py-2 text-right">
              Orders
            </th>
            <th class="font-normal py-2 text-right">
              Sales
            </th>
          </tr>
        </thead>
        <tbody class="divide-y divide-(--ui-border-muted)">
          <tr v-for="(bar, i) in bars" :key="i">
            <td class="py-2 text-toned">
              {{ bar.detail }}
            </td>
            <td class="py-2 text-right tabular-nums text-toned">
              {{ bar.orders }}
            </td>
            <td class="py-2 text-right tabular-nums text-highlighted">
              {{ money(bar.sales) }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

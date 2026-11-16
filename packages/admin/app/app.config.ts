// Theme for Nuxt UI components.
//
// Mobile first: on small screens every control is at least 44px tall (easy to tap)
// and form fields use 16px text (stops iPhones zooming in on focus).
// `max-sm:` rules apply below 640px; larger screens keep the compact desktop sizes.
const touchField = "max-sm:min-h-11 max-sm:text-base"

export default defineAppConfig({
  ui: {
    colors: {
      primary: "stone",
      neutral: "stone",
    },
    button: {
      slots: {
        base: "font-medium max-sm:min-h-11 max-sm:min-w-11 max-sm:justify-center",
      },
    },
    input: {
      slots: { base: touchField },
    },
    textarea: {
      slots: { base: "max-sm:text-base" },
    },
    inputNumber: {
      slots: { base: touchField },
    },
    select: {
      slots: { base: touchField, item: "max-sm:py-2.5 max-sm:text-base" },
    },
    selectMenu: {
      slots: { base: touchField, input: "max-sm:text-base", item: "max-sm:py-2.5 max-sm:text-base" },
    },
    inputMenu: {
      slots: { base: touchField, tagsInput: "max-sm:text-base", item: "max-sm:py-2.5 max-sm:text-base" },
    },
    inputTags: {
      slots: { base: "max-sm:min-h-11", input: "max-sm:text-base", itemDelete: "max-sm:p-1" },
    },
    checkbox: {
      slots: { base: "max-sm:size-5", label: "max-sm:text-base" },
      variants: {
        variant: {
          card: {
            root: "border border-default rounded-md max-sm:p-4 has-data-[state=checked]:border-inverted has-data-[state=checked]:bg-transparent",
          },
        },
      },
    },
    dropdownMenu: {
      slots: { item: "max-sm:py-2.5 max-sm:text-base" },
    },
    checkboxGroup: {
      slots: {
        item: "has-data-[state=checked]:bg-transparent",
      },
    },
    modal: {
      slots: {
        overlay: "bg-stone-950/40 backdrop-blur-[2px]",
        content: "ring-default shadow-2xl shadow-stone-950/10",
        header: "px-5 sm:px-8 py-5 min-h-0",
        body: "px-5 sm:px-8 py-6",
        footer: "px-5 sm:px-8 py-4 justify-end gap-2 max-sm:pb-[max(1rem,env(safe-area-inset-bottom))] max-sm:[&>*]:flex-1",
        title: "font-display text-2xl font-normal text-highlighted pr-10",
        description: "text-sm text-muted mt-1",
      },
      compoundVariants: [
        {
          // On phones, regular modals become bottom sheets.
          scrollable: false,
          fullscreen: false,
          class: {
            content: [
              "max-sm:top-auto max-sm:bottom-0 max-sm:left-0 max-sm:translate-x-0 max-sm:translate-y-0",
              "max-sm:w-full max-sm:max-w-none max-sm:max-h-[92dvh] max-sm:rounded-b-none max-sm:rounded-t-2xl",
              "max-sm:data-[state=open]:animate-[sheet-in_280ms_var(--ease-out)] max-sm:data-[state=closed]:animate-[sheet-out_200ms_var(--ease-out)]",
            ].join(" "),
          },
        },
      ],
    },
    formField: {
      slots: {
        label: "text-[13px] font-medium text-toned",
        help: "text-xs text-muted",
        description: "text-xs text-muted",
      },
    },
    table: {
      slots: {
        th: "py-3 px-4 first:pl-0 last:pr-0 bg-transparent text-[11px] leading-4 font-medium uppercase tracking-[0.14em] text-muted",
        td: "py-4 px-4 first:pl-0 last:pr-0 text-sm text-toned",
        tr: "data-[selectable=true]:hover:bg-muted/60",
        thead: "[&>tr]:after:bg-(--ui-border)",
        tbody: "divide-y divide-(--ui-border-muted)",
      },
    },
  },
})

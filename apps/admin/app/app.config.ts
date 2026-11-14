export default defineAppConfig({
  ui: {
    colors: {
      primary: "stone",
      neutral: "stone",
    },
    button: {
      slots: {
        base: "font-medium",
      },
    },
    modal: {
      slots: {
        overlay: "bg-stone-950/40 backdrop-blur-[2px]",
        content: "ring-default shadow-2xl shadow-stone-950/10",
        header: "px-6 sm:px-8 py-5 min-h-0",
        body: "px-6 sm:px-8 py-6",
        footer: "px-6 sm:px-8 py-4 justify-end gap-2",
        title: "font-display text-2xl font-normal text-highlighted",
        description: "text-sm text-muted mt-1",
      },
    },
    formField: {
      slots: {
        label: "text-[13px] font-medium text-toned",
        help: "text-xs text-muted",
        description: "text-xs text-muted",
      },
    },
    checkboxGroup: {
      slots: {
        item: "has-data-[state=checked]:bg-transparent",
      },
    },
    checkbox: {
      variants: {
        variant: {
          card: {
            root: "border border-default rounded-md has-data-[state=checked]:border-inverted has-data-[state=checked]:bg-transparent",
          },
        },
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

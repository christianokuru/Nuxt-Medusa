export default defineAdminExtension({
  id: "notes",
  name: "Notes",
  widgets: [
    {
      zone: "product.details.after",
      component: () => import("./app/components/NotesProductWidget.vue"),
    },
  ],
  nav: [
    { label: "Notes", to: "/notes", icon: "i-lucide-notebook-pen", group: "Extensions" },
  ],
})

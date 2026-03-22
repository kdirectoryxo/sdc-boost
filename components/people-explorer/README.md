# People explorer (UI)

- **`PeopleExplorerPanel.vue`** — filters + `PeopleList`; used by the view router and (for now) the legacy dialog.
- **`PeopleDialogShell.vue`** — modal chrome only (overlay, header, Dutch tabs). **Router does not use this** — delete with `PeopleDialog` when the overlay is removed.

Shared logic lives in **`@/lib/people-explorer`**.

# Profile view

- **`ProfileView.vue`** — shared profile UI (tabs, API/cache, gallery/lightboxes). Used by the view router at `/sdc/profile/:userId` and by the thin **`ProfileDialog.vue`** wrapper for legacy modal flows.
- **`ProfileDialog.vue`** lives under `components/chat/` and only adds overlay + sizing; avoid importing it from view-router code when a full page is enough.

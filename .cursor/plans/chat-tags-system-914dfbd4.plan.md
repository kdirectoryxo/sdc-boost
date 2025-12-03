<!-- 914dfbd4-a485-451c-8e8e-bcaa2676e435 deca08b1-2303-4353-ba68-6317bf56b8f1 -->
# Chat Tags System Implementation

## Overview

Add a tags system to chats that stores tags locally in IndexedDB. Tags have both text and color, display as colored badges in the chat list and header, and can be managed through a dialog accessible from dropdown menus.

## Database Changes

### 1. Update `lib/db.ts`

- Extend `ChatMetadata` interface to include `tags?: ChatTag[]`
- Add `ChatTag` interface: `{ text: string; color: string }`
- Add database migration (version 2) to support tags field

## Storage Layer

### 2. Create `lib/tag-storage.ts`

- Create `TagStorage` class with methods:
- `getTags(groupId: number): Promise<ChatTag[]>`
- `setTags(groupId: number, tags: ChatTag[]): Promise<void>`
- `addTag(groupId: number, tag: ChatTag): Promise<void>`
- `removeTag(groupId: number, tagIndex: number): Promise<void>`
- `updateTag(groupId: number, tagIndex: number, tag: ChatTag): Promise<void>`
- Enforce maximum of 5 tags per chat

### 3. Update `lib/chat-storage.ts`

- Update `getAllChats()` to merge tags from metadata
- Update search/query methods to include tags in returned chat objects

## Composable

### 4. Create `lib/composables/chat/useChatTags.ts`

- Create composable with:
- `tags` ref for current chat's tags
- `getTags(groupId: number): Promise<ChatTag[]>`
- `saveTags(groupId: number, tags: ChatTag[]): Promise<void>`
- `addTag(groupId: number, tag: ChatTag): Promise<void>`
- `removeTag(groupId: number, tagIndex: number): Promise<void>`
- `updateTag(groupId: number, tagIndex: number, tag: ChatTag): Promise<void>`

## UI Components

### 5. Create `components/chat/TagDialog.vue`

- Modal dialog component for managing tags
- Props: `modelValue: boolean`, `chat: MessengerChatItem | null`
- Features:
- List of existing tags with edit/delete buttons
- Add new tag form (text input + color picker)
- Color selection: predefined palette + custom color picker
- Validation: max 5 tags, non-empty text, unique text per chat
- Save/Cancel buttons
- Emits: `update:modelValue`, `save: [tags: ChatTag[]]`

### 6. Create `components/ui/TagBadge.vue`

- Reusable tag badge component
- Props: `text: string`, `color: string`
- Displays colored badge with text

### 7. Update `components/ChatListItem.vue`

- Add "Tags" menu item in dropdown (after "Mark as unread")
- Add tag badges display below chat name (or next to it)
- Import and use TagBadge component
- Handle opening TagDialog when "Tags" is clicked

### 8. Update `components/chat/ChatMessagesArea.vue`

- Add "Tags" menu item in header dropdown (after "Mark as unread")
- Handle opening TagDialog when "Tags" is clicked

### 9. Update `components/chat/ChatDialogHeader.vue`

- Add tag badges display in header (next to chat title or below it)
- Import and use TagBadge component
- Fetch and display tags for selected chat

### 10. Update `components/ChatDialog.vue`

- Add TagDialog component
- Manage TagDialog open state
- Handle tag save events
- Pass selected chat to TagDialog

## State Management

### 11. Update `lib/composables/chat/useChatState.ts`

- Update chat list query to include tags from metadata
- Merge tags into chat objects when loading

## Color Palette

### 12. Create `lib/tag-colors.ts`

- Export predefined color palette array
- Include common colors: red, blue, green, yellow, purple, orange, pink, cyan, etc.
- Export utility function to validate color format

## Implementation Details

- Tags stored in `chat_metadata.tags` as array of `{ text: string, color: string }`
- Color format: hex colors (e.g., "#ff0000")
- Maximum 5 tags per chat enforced in TagDialog
- Tags displayed as small rounded badges with colored background
- Tag text should be trimmed and validated (non-empty, reasonable length)
- Tag colors validated to be valid hex colors

## Files to Create

- `lib/tag-storage.ts`
- `lib/composables/chat/useChatTags.ts`
- `components/chat/TagDialog.vue`
- `components/ui/TagBadge.vue`
- `lib/tag-colors.ts`

## Files to Modify

- `lib/db.ts` - Add tags to ChatMetadata, add migration
- `lib/chat-storage.ts` - Include tags when loading chats
- `components/ChatListItem.vue` - Add tags menu item and display
- `components/chat/ChatMessagesArea.vue` - Add tags menu item
- `components/chat/ChatDialogHeader.vue` - Display tags
- `components/ChatDialog.vue` - Add TagDialog component
- `lib/composables/chat/useChatState.ts` - Include tags in chat loading

### To-dos

- [x] Update database schema: extend ChatMetadata interface with tags field and add database migration
- [x] Create tag-storage.ts with TagStorage class for CRUD operations on tags
- [x] Create useChatTags.ts composable for tag management logic
- [x] Create tag-colors.ts with predefined color palette and validation utilities
- [x] Create TagBadge.vue component for displaying individual tags
- [ ] Create TagDialog.vue component with add/edit/delete functionality and color picker
- [ ] Add Tags menu item and tag display to ChatListItem.vue
- [ ] Add Tags menu item to ChatMessagesArea header dropdown and display tags in ChatDialogHeader
- [ ] Integrate TagDialog into ChatDialog.vue and handle tag save events
- [ ] Update useChatState and chat-storage to include tags when loading chats
- [ ] Update database schema: extend ChatMetadata interface with tags field and add database migration
- [ ] Create tag-storage.ts with TagStorage class for CRUD operations on tags
- [ ] Create useChatTags.ts composable for tag management logic
- [ ] Create tag-colors.ts with predefined color palette and validation utilities
- [ ] Create TagBadge.vue component for displaying individual tags
- [ ] Create TagDialog.vue component with add/edit/delete functionality and color picker
- [ ] Add Tags menu item and tag display to ChatListItem.vue
- [ ] Add Tags menu item to ChatMessagesArea header dropdown and display tags in ChatDialogHeader
- [ ] Integrate TagDialog into ChatDialog.vue and handle tag save events
- [ ] Update useChatState and chat-storage to include tags when loading chats
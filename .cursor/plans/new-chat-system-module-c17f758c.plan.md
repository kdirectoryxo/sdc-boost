<!-- c17f758c-293f-4ef3-a5a6-59bafe6d5e9d e4465353-7bec-47c1-b0cd-2c209c2e9aa4 -->
# Vue Chat Dialog Module

## Overview

Create a new module that adds a "Chat" button to the navbar, opening a Vue-based dialog with a modern WhatsApp-like chat interface. The dialog uses WXT's content script UI system with Vue and Tailwind CSS.

## Implementation Steps

### 1. Create Chat Dialog Vue Component

- **File**: `components/ChatDialog.vue` (new file)
- Build WhatsApp-like layout:
- Left sidebar: Chat list (scrollable)
- Right side: Chat messages area (placeholder for now)
- Responsive design with Tailwind
- Dark theme matching existing UI (`bg-[#1a1a1a]`, `text-[#e0e0e0]`)
- Chat list features:
- Profile avatars (circular, 50px)
- Account names with online indicators
- Last message preview (truncated)
- Timestamp
- Unread badges
- Pin indicators
- Hover effects

### 2. Create Chat List Item Component

- **File**: `components/ChatListItem.vue` (new file)
- Reusable component for individual chat items
- Props: chat data (MessengerChatItem)
- Displays: avatar, name, last message, time, unread count, pin status
- Click handler to select chat

### 3. Create ChatDialogModule

### To-dos

- [ ] Add TypeScript types for messenger API response (MessengerChatItem, MessengerLatestResponse) to lib/sdc-api-types.ts
- [ ] Create lib/sdc-api/messenger.ts with getMessengerLatest() function that fetches chat list from API
- [ ] Export getMessengerLatest from lib/sdc-api/index.ts
- [ ] Create lib/modules/NewChatModule.ts extending BaseModule with basic structure
- [ ] Add 'New chat' button to messenger toolbar area in NewChatModule
- [ ] Implement URL query parameter handling (?newChat=true) to switch between old and new chat UI
- [ ] Build new chat list UI that replaces old messenger container when newChat=true
- [ ] Implement API call to fetch chat list and render chat items with proper styling
- [ ] Add pagination support using url_more from API response
- [ ] Add module definition to moduleDefinitions.ts and register in content.ts
/**
 * Shared IndexedDB database instance using Dexie
 * Centralized database initialization with migration support
 */

import Dexie, { type EntityTable } from 'dexie';
import type { MessengerChatItem, MessengerFolder, MessengerMessage } from './sdc-api-types';

const DB_NAME = 'sdc-boost-v2';

// Database entity types
export interface ChatEntity extends MessengerChatItem {
	id: string; // Composite key: group_${group_id} or broadcast_${db_id}_${id_broadcast}
}

export interface MessageEntity extends MessengerMessage {
	id: string; // Composite key: ${group_id}_${message_id}
	group_id: number;
}

export interface ChatTag {
	text: string;
	color: string;
}

export interface ChatMetadata {
	group_id: number;
	messages_fetched: boolean;
	last_fetched_at?: number;
	isBlocked?: boolean;
	isArchived?: boolean;
	tags?: ChatTag[];
}

export interface SyncMetadata {
	key: string;
	last_sync_time: string;
}

// Define the database class
class SDCBoostDatabase extends Dexie {
	chats!: EntityTable<ChatEntity, 'id'>;
	folders!: EntityTable<MessengerFolder, 'id'>;
	messages!: EntityTable<MessageEntity, 'id'>;
	chat_metadata!: EntityTable<ChatMetadata, 'group_id'>;
	sync_metadata!: EntityTable<SyncMetadata, 'key'>;

	constructor() {
		super(DB_NAME);
		
		// Version 1: Initial schema
		this.version(1).stores({
			chats: 'id, group_id, db_id, date_time, pin_chat, account_id, folder_id',
			folders: 'id, name, new_messages',
			messages: 'id, group_id, message_id, date2',
			chat_metadata: 'group_id',
			sync_metadata: 'key',
		});

		// Version 2: Add tags support to chat_metadata
		this.version(2).stores({
			chats: 'id, group_id, db_id, date_time, pin_chat, account_id, folder_id',
			folders: 'id, name, new_messages',
			messages: 'id, group_id, message_id, date2',
			chat_metadata: 'group_id',
			sync_metadata: 'key',
		}).upgrade(tx => {
			// Migration: tags field will be added automatically when metadata is updated
			// No data migration needed as tags is optional
		});
	}
}

// Create and export singleton instance
export const db = new SDCBoostDatabase();

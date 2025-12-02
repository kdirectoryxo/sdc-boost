/**
 * Shared IndexedDB database instance
 * Centralized database initialization with migrations
 */

import { openDB, type IDBPDatabase } from 'idb';
import type { MessengerChatItem, MessengerFolder, MessengerMessage } from './sdc-api-types';

const DB_NAME = 'sdc-boost-v2';
const DB_VERSION = 4;

export interface ChatDB {
    chats: {
        key: string;
        value: MessengerChatItem & { id: string };
        indexes: {
            group_id: number;
            db_id: number;
            date_time: string;
            pin_chat: number;
            account_id: string;
            folder_id: number;
        };
    };
    folders: {
        key: number;
        value: MessengerFolder;
        indexes: {
            name: string;
            new_messages: number;
        };
    };
    messages: {
        key: string;
        value: MessengerMessage & { id: string; group_id: number };
        indexes: {
            group_id: number;
            message_id: number;
            date2: number;
        };
    };
    chat_metadata: {
        key: number;
        value: {
            group_id: number;
            messages_fetched: boolean;
            last_fetched_at?: number;
        };
        indexes: {
            group_id: number;
        };
    };
    sync_metadata: {
        key: string;
        value: {
            key: string;
            last_sync_time: string;
        };
    };
}

let dbInstance: IDBPDatabase<ChatDB> | null = null;
let initPromise: Promise<IDBPDatabase<ChatDB>> | null = null;

/**
 * Get or initialize the shared database instance
 */
export async function getDB(): Promise<IDBPDatabase<ChatDB>> {
    if (dbInstance) {
        return dbInstance;
    }

    if (initPromise) {
        return initPromise;
    }

    initPromise = openDB<ChatDB>(DB_NAME, DB_VERSION, {
        upgrade(db, oldVersion, newVersion, transaction) {
            console.log(`[DB] Upgrading database from version ${oldVersion} to ${newVersion}`);

            // Create chats object store
            if (!db.objectStoreNames.contains('chats')) {
                const store = db.createObjectStore('chats', { keyPath: 'id' });
                store.createIndex('group_id', 'group_id', { unique: false });
                store.createIndex('db_id', 'db_id', { unique: false });
                store.createIndex('date_time', 'date_time', { unique: false });
                store.createIndex('pin_chat', 'pin_chat', { unique: false });
                store.createIndex('account_id', 'account_id', { unique: false });
                store.createIndex('folder_id', 'folder_id', { unique: false });
                console.log('[DB] Created chats object store');
            }

            // Create folders object store
            if (!db.objectStoreNames.contains('folders')) {
                const store = db.createObjectStore('folders', { keyPath: 'id' });
                store.createIndex('name', 'name', { unique: false });
                store.createIndex('new_messages', 'new_messages', { unique: false });
                console.log('[DB] Created folders object store');
            }

            // Create messages object store (version 2+)
            if (!db.objectStoreNames.contains('messages')) {
                const store = db.createObjectStore('messages', { keyPath: 'id' });
                store.createIndex('group_id', 'group_id', { unique: false });
                store.createIndex('message_id', 'message_id', { unique: false });
                store.createIndex('date2', 'date2', { unique: false });
                console.log('[DB] Created messages object store');
            }

            // Create chat_metadata object store (version 3+)
            if (!db.objectStoreNames.contains('chat_metadata')) {
                const store = db.createObjectStore('chat_metadata', { keyPath: 'group_id' });
                store.createIndex('group_id', 'group_id', { unique: true });
                console.log('[DB] Created chat_metadata object store');
            }

            // Create sync_metadata object store (version 4+)
            if (!db.objectStoreNames.contains('sync_metadata')) {
                const store = db.createObjectStore('sync_metadata', { keyPath: 'key' });
                console.log('[DB] Created sync_metadata object store');
            }
        },
    });

    dbInstance = await initPromise;
    console.log('[DB] Database initialized successfully');
    return dbInstance;
}

/**
 * Close the database connection
 */
export async function closeDB(): Promise<void> {
    if (dbInstance) {
        dbInstance.close();
        dbInstance = null;
        initPromise = null;
        console.log('[DB] Database closed');
    }
}


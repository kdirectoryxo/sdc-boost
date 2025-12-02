/**
 * Shared IndexedDB database instance
 * Centralized database initialization with migrations
 */

import { openDB, type IDBPDatabase } from 'idb';
import type { MessengerChatItem, MessengerFolder } from './sdc-api-types';

const DB_NAME = 'sdc-boost-v2';
const DB_VERSION = 1;

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

            // Future migrations can be added here based on oldVersion/newVersion
            // Example:
            // if (oldVersion < 2) {
            //   // Migration logic for version 2
            // }
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


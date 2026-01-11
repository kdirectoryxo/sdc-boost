/**
 * SDC Database class with CRUD operations
 */

import { loadDatabase, saveDatabase } from './storage';
import type { Database, Table, TableSchema, Row, ColumnType } from './types';

export class SDCDatabase {
  private db: Database;

  constructor(db?: Database) {
    this.db = db || { version: 1, tables: {} };
  }

  /**
   * Get database instance
   */
  getDatabase(): Database {
    return this.db;
  }

  /**
   * Get a table by name
   */
  getTable(name: string): Table | null {
    return this.db.tables[name] || null;
  }

  /**
   * Create a new table with schema
   */
  createTable(name: string, schema: TableSchema): void {
    if (this.db.tables[name]) {
      throw new Error(`Table "${name}" already exists`);
    }

    this.db.tables[name] = {
      schema,
      data: [],
    };
  }

  /**
   * Validate value against column type
   */
  private validateValue(value: any, type: ColumnType): any {
    switch (type) {
      case 'int':
        const num = typeof value === 'string' ? parseInt(value, 10) : Number(value);
        if (isNaN(num)) {
          throw new Error(`Invalid integer value: ${value}`);
        }
        return num;

      case 'text':
        return String(value);

      case 'json':
        return value; // Already parsed from JSON

      case 'date':
        if (typeof value === 'string') {
          // Validate ISO date format (YYYY-MM-DD)
          if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
            throw new Error(`Invalid date format: ${value}. Expected YYYY-MM-DD`);
          }
          return value;
        }
        if (value instanceof Date) {
          return value.toISOString().split('T')[0];
        }
        throw new Error(`Invalid date value: ${value}`);

      case 'datetime':
        if (typeof value === 'string') {
          // Validate ISO datetime format
          const date = new Date(value);
          if (isNaN(date.getTime())) {
            throw new Error(`Invalid datetime format: ${value}`);
          }
          return date.toISOString();
        }
        if (value instanceof Date) {
          return value.toISOString();
        }
        throw new Error(`Invalid datetime value: ${value}`);

      default:
        return value;
    }
  }

  /**
   * Insert a new row into a table
   * Returns the auto-increment ID
   */
  insert(tableName: string, row: Partial<Row>): number {
    const table = this.getTable(tableName);
    if (!table) {
      throw new Error(`Table "${tableName}" does not exist`);
    }

    // Generate auto-increment ID
    const maxId = table.data.length > 0
      ? Math.max(...table.data.map(r => r.id || 0))
      : 0;
    const newId = maxId + 1;

    // Validate and build row
    const validatedRow: Row = { id: newId } as Row;

    for (const column of table.schema.columns) {
      if (column.name === 'id') {
        continue; // Already set
      }

      const value = row[column.name];
      if (value !== undefined) {
        validatedRow[column.name] = this.validateValue(value, column.type);
      } else {
        // Set default based on type
        switch (column.type) {
          case 'int':
            validatedRow[column.name] = 0;
            break;
          case 'text':
            validatedRow[column.name] = '';
            break;
          case 'json':
            validatedRow[column.name] = null;
            break;
          case 'date':
          case 'datetime':
            validatedRow[column.name] = '';
            break;
        }
      }
    }

    table.data.push(validatedRow);
    return newId;
  }

  /**
   * Select rows from a table with optional filter
   */
  select(tableName: string, where?: (row: Row) => boolean): Row[] {
    const table = this.getTable(tableName);
    if (!table) {
      return [];
    }

    if (where) {
      return table.data.filter(where);
    }

    return [...table.data];
  }

  /**
   * Update a row by ID
   */
  update(tableName: string, id: number, updates: Partial<Row>): boolean {
    const table = this.getTable(tableName);
    if (!table) {
      throw new Error(`Table "${tableName}" does not exist`);
    }

    const rowIndex = table.data.findIndex(r => r.id === id);
    if (rowIndex === -1) {
      return false;
    }

    const row = table.data[rowIndex];

    // Validate and update fields
    for (const column of table.schema.columns) {
      if (column.name === 'id') {
        continue; // Don't allow ID updates
      }

      if (updates[column.name] !== undefined) {
        row[column.name] = this.validateValue(updates[column.name], column.type);
      }
    }

    return true;
  }

  /**
   * Delete a row by ID
   */
  delete(tableName: string, id: number): boolean {
    const table = this.getTable(tableName);
    if (!table) {
      throw new Error(`Table "${tableName}" does not exist`);
    }

    const rowIndex = table.data.findIndex(r => r.id === id);
    if (rowIndex === -1) {
      return false;
    }

    table.data.splice(rowIndex, 1);
    return true;
  }

  /**
   * Load database from note
   */
  async load(): Promise<void> {
    const loaded = await loadDatabase();
    if (loaded) {
      this.db = loaded;
    }
  }

  /**
   * Save database to note
   */
  async save(): Promise<void> {
    await saveDatabase(this.db);
  }
}

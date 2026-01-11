/**
 * Type definitions for SDC Database System
 */

export type ColumnType = 'int' | 'text' | 'json' | 'date' | 'datetime';

export interface ColumnDefinition {
  name: string;
  type: ColumnType;
}

export interface TableSchema {
  columns: ColumnDefinition[];
}

export type Row = Record<string, any> & { id: number };

export interface Table {
  schema: TableSchema;
  data: Row[];
}

export interface Database {
  version: number;
  tables: Record<string, Table>;
}

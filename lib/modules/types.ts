/**
 * Type definitions for module system
 */

export interface ModuleConfigOption {
  key: string;
  label: string;
  description?: string;
  type: 'number' | 'string' | 'boolean' | 'color';
  default: any;
  min?: number;
  max?: number;
  step?: number;
  dependsOn?: {
    key: string;
    value: any;
  };
  disabled?: boolean;
  disabledReason?: string;
}

export interface ModuleDefinition {
  id: string;
  name: string;
  description: string;
  category: string;
  configOptions: ModuleConfigOption[];
}



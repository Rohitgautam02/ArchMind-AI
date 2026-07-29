export type ToolSchemaValueType = 'string' | 'number' | 'boolean' | 'object' | 'array' | 'unknown';

export interface ToolSchemaField {
  readonly type: ToolSchemaValueType;
  readonly required?: boolean;
  readonly description?: string;
  readonly itemType?: ToolSchemaValueType;
  readonly enumValues?: readonly string[];
}

export interface ToolSchema {
  readonly title: string;
  readonly description: string;
  readonly fields: Readonly<Record<string, ToolSchemaField>>;
}

export interface ToolMetadata {
  readonly id: string;
  readonly name: string;
  readonly capability: string;
  readonly version: string;
  readonly inputSchema: ToolSchema;
  readonly outputSchema: ToolSchema;
}
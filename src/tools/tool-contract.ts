import type { ToolMetadata, ToolSchema } from './tool-metadata.js';
import type { ToolExecutionResult } from './tool-result.js';

export interface ToolValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
}

export interface Tool<TInput = unknown, TOutput = unknown> {
  readonly metadata: ToolMetadata;
  validate(input: unknown): ToolValidationResult;
  execute(input: TInput): ToolExecutionResult<TOutput>;
}

export function validateAgainstSchema(input: unknown, schema: ToolSchema): ToolValidationResult {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    return {
      valid: false,
      errors: ['Input must be a plain object.'],
    };
  }

  const record = input as Record<string, unknown>;
  const errors: string[] = [];

  for (const [fieldName, field] of Object.entries(schema.fields)) {
    const fieldValue = record[fieldName];

    if (field.required && fieldValue === undefined) {
      errors.push(`Missing required field: ${fieldName}`);
      continue;
    }

    if (fieldValue === undefined) {
      continue;
    }

    if (!matchesFieldType(fieldValue, field.type)) {
      errors.push(`Field ${fieldName} must be of type ${field.type}.`);
      continue;
    }

    if (field.type === 'array' && field.itemType) {
      const arrayValue = fieldValue as readonly unknown[];
      if (!arrayValue.every((item) => matchesFieldType(item, field.itemType ?? 'unknown'))) {
        errors.push(`Field ${fieldName} array items must be of type ${field.itemType}.`);
      }
    }

    if (field.enumValues && typeof fieldValue === 'string' && !field.enumValues.includes(fieldValue)) {
      errors.push(`Field ${fieldName} must be one of: ${field.enumValues.join(', ')}.`);
    }
  }

  return {
    valid: errors.length === 0,
    errors: Object.freeze(errors),
  };
}

function matchesFieldType(value: unknown, type: ToolSchema['fields'][string]['type']): boolean {
  switch (type) {
    case 'string':
      return typeof value === 'string';
    case 'number':
      return typeof value === 'number' && Number.isFinite(value);
    case 'boolean':
      return typeof value === 'boolean';
    case 'array':
      return Array.isArray(value);
    case 'object':
      return value !== null && typeof value === 'object' && !Array.isArray(value);
    default:
      return true;
  }
}
export function validateAgainstSchema(input, schema) {
    if (input === null || typeof input !== 'object' || Array.isArray(input)) {
        return {
            valid: false,
            errors: ['Input must be a plain object.'],
        };
    }
    const record = input;
    const errors = [];
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
            const arrayValue = fieldValue;
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
function matchesFieldType(value, type) {
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

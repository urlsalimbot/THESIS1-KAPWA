export function validateJsonSchema(value: unknown, schema: Record<string, unknown>): string[] {
  const errors: string[] = [];
  if (typeof schema !== 'object' || schema === null) return errors;

  if ('type' in schema && schema.type === 'number') {
    if (typeof value !== 'number') {
      errors.push(`Expected number, got ${typeof value}`);
    } else {
      if ('minimum' in schema && typeof schema.minimum === 'number' && value < schema.minimum) {
        errors.push(`Value ${value} is less than minimum ${schema.minimum}`);
      }
      if ('maximum' in schema && typeof schema.maximum === 'number' && value > schema.maximum) {
        errors.push(`Value ${value} is greater than maximum ${schema.maximum}`);
      }
    }
  }

  if ('type' in schema && schema.type === 'string') {
    if (typeof value !== 'string') {
      errors.push(`Expected string, got ${typeof value}`);
    } else if ('enum' in schema && Array.isArray(schema.enum) && !schema.enum.includes(value)) {
      errors.push(`Value "${value}" not in enum [${schema.enum.join(', ')}]`);
    }
  }

  if ('type' in schema && schema.type === 'object') {
    if (typeof value !== 'object' || value === null) {
      errors.push('Expected object');
    } else if ('properties' in schema && typeof schema.properties === 'object' && schema.properties !== null) {
      const val = value as Record<string, unknown>;
      for (const [key, propSchema] of Object.entries(schema.properties as Record<string, unknown>)) {
        if (key in val) {
          errors.push(...validateJsonSchema(val[key], propSchema as Record<string, unknown>));
        } else if ('required' in schema && Array.isArray(schema.required) && schema.required.includes(key)) {
          errors.push(`Missing required field: ${key}`);
        }
      }
    }
  }

  return errors;
}

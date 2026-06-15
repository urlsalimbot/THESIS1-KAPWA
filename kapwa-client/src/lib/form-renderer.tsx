import { FieldProps } from 'react/jsonschema-form';

export interface SchemaField {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  format?: 'email' | 'date' | 'date-time' | 'uri' | 'phone';
  title?: string;
  description?: string;
  enum?: string[];
  enumNames?: string[];
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  default?: unknown;
  properties?: Record<string, SchemaField>;
  items?: SchemaField;
  required?: string[];
}

export interface FormTemplate {
  id: string;
  name: string;
  category: string;
  jsonSchema: SchemaField;
  uiSchema?: Record<string, any>;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface FormData {
  [key: string]: unknown;
}

export interface FormValidationError {
  field: string;
  message: string;
}

export function validateJsonSchema(
  data: FormData,
  schema: SchemaField
): FormValidationError[] {
  const errors: FormValidationError[] = [];

  if (schema.type === 'string') {
    if (schema.minLength && ((data[''] as string)?.length ?? 0) < schema.minLength) {
      errors.push({ field: '', message: `Minimum length: ${schema.minLength}` });
    }
    if (schema.maxLength && ((data[''] as string)?.length ?? 0) > schema.maxLength) {
      errors.push({ field: '', message: `Maximum length: ${schema.maxLength}` });
    }
    if (schema.pattern && (data[''] as string)) {
      const regex = new RegExp(schema.pattern);
      if (!regex.test(data[''] as string)) {
        errors.push({ field: '', message: `Invalid format` });
      }
    }
    if (schema.enum && !schema.enum.includes(data[''] as string)) {
      errors.push({ field: '', message: `Must be one of: ${schema.enum.join(', ')}` });
    }
  }

  if (schema.type === 'number') {
    const num = data[''] as number;
    if (schema.minimum !== undefined && num < schema.minimum) {
      errors.push({ field: '', message: `Minimum: ${schema.minimum}` });
    }
    if (schema.maximum !== undefined && num > schema.maximum) {
      errors.push({ field: '', message: `Maximum: ${schema.maximum}` });
    }
  }

  if (schema.required?.length) {
    for (const field of schema.required) {
      if (data[field] === undefined || data[field] === null || data[field] === '') {
        errors.push({ field, message: 'Required field' });
      }
    }
  }

  if (schema.properties) {
    const nestedData = data[''] as Record<string, unknown>;
    if (nestedData && typeof nestedData === 'object') {
      for (const [key, subSchema] of Object.entries(schema.properties)) {
        const subErrors = validateJsonSchema(
          { _: nestedData[key] },
          { ...subSchema, required: subSchema.required }
        );
        errors.push(...subErrors.map(e => ({
          field: `${key}.${e.field}`,
          message: e.message
        })));
      }
    }
  }

  return errors;
}

export function getDefaultFormProps(schema: SchemaField): FormData {
  const defaults: FormData = {};

  for (const [key, field] of Object.entries(schema.properties || {})) {
    if (field.type === 'string') {
      defaults[key] = field.default || '';
    } else if (field.type === 'number') {
      defaults[key] = field.default || 0;
    } else if (field.type === 'boolean') {
      defaults[key] = field.default || false;
    } else if (field.type === 'array') {
      defaults[key] = [];
    } else if (field.type === 'object') {
      defaults[key] = getDefaultFormProps(field);
    }
  }

  return defaults;
}

export function uiSchemaToProps(uiSchema: Record<string, any>): Partial<FieldProps> {
  return {
    'ui:placeholder': uiSchema.placeholder,
    'ui:autofocus': uiSchema.autofocus,
    'ui:disabled': uiSchema.disabled,
    'ui:readonly': uiSchema.readonly,
    'ui:options': {
      ...uiSchema.options
    }
  };
}

export function schemaToRjsfWidgets(schema: SchemaField) {
  return {
    BaseInput: (props: any) => {
      const type = schema.format === 'date' ? 'date' 
        : schema.format === 'date-time' ? 'datetime-local'
        : schema.format === 'email' ? 'email'
        : schema.format === 'uri' ? 'url'
        : 'text';
      
      return (
        <input
          type={type}
          className="form-input"
          value={props.value || ''}
          onChange={e => props.onChange(e.target.value)}
          disabled={props.disabled}
          readOnly={props.readOnly}
          placeholder={props.schema.description}
        />
      );
    },
    
    SelectWidget: (props: any) => (
      <select
        className="form-select"
        value={props.value || ''}
        onChange={e => props.onChange(e.target.value)}
        disabled={props.disabled}
      >
        <option value="">Select...</option>
        {(props.schema.enumNames || props.schema.enum || []).map((label: string, i: number) => (
          <option key={i} value={props.schema.enum?.[i]}>
            {label}
          </option>
        ))}
      </select>
    ),
    
    CheckboxWidget: (props: any) => (
      <input
        type="checkbox"
        className="form-checkbox"
        checked={props.value || false}
        onChange={e => props.onChange(e.target.checked)}
        disabled={props.disabled}
      />
    ),
    
    TextareaWidget: (props: any) => (
      <textarea
        className="form-textarea"
        value={props.value || ''}
        onChange={e => props.onChange(e.target.value)}
        disabled={props.disabled}
        rows={props.schema.maxLength ? Math.ceil(props.schema.maxLength / 50) : 4}
      />
    )
  };
}
import React, { useState, useCallback } from 'react';

interface JsonSchema {
  title?: string;
  description?: string;
  type: string;
  properties?: Record<string, FieldSchema>;
  required?: string[];
  layout?: FormLayout;
}

interface FieldSchema {
  type: string;
  title?: string;
  description?: string;
  enum?: string[];
  enumNames?: string[];
  default?: unknown;
  minimum?: number;
  maximum?: number;
  pattern?: string;
  format?: string;
  items?: FieldSchema;
  properties?: Record<string, FieldSchema>;
  required?: string[];
}

type FormLayout = 'vertical' | 'horizontal' | 'grid';

interface JsonSchemaFormProps {
  schema: JsonSchema;
  initialData?: Record<string, any>;
  onSubmit?: (data: Record<string, any>) => void;
  onCancel?: () => void;
  submitLabel?: string;
  readOnly?: boolean;
}

export default function JsonSchemaForm({
  schema,
  initialData = {},
  onSubmit,
  onCancel,
  submitLabel = 'Submit',
  readOnly = false,
}: JsonSchemaFormProps) {
  const [formData, setFormData] = useState<Record<string, any>>(() => {
    const defaults: Record<string, any> = {};
    if (schema.properties) {
      for (const [key, field] of Object.entries(schema.properties)) {
        if (field.default !== undefined) defaults[key] = field.default;
      }
    }
    return { ...defaults, ...initialData };
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleChange = useCallback((key: string, value: unknown) => {
    setFormData(prev => ({ ...prev, [key]: value }));
    setErrors(prev => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const validate = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};
    if (!schema.properties) return true;

    for (const [key, field] of Object.entries(schema.properties)) {
      const value = formData[key];

      if (schema.required?.includes(key) && (value === undefined || value === '' || value === null)) {
        newErrors[key] = `${field.title || key} is required`;
        continue;
      }

      if (value !== undefined && value !== '') {
        if (field.type === 'number' || field.type === 'integer') {
          const num = Number(value);
          if (isNaN(num)) {
            newErrors[key] = `${field.title || key} must be a number`;
          } else if (field.minimum !== undefined && num < field.minimum) {
            newErrors[key] = `${field.title || key} must be >= ${field.minimum}`;
          } else if (field.maximum !== undefined && num > field.maximum) {
            newErrors[key] = `${field.title || key} must be <= ${field.maximum}`;
          }
        }

        if (field.type === 'string' && field.pattern) {
          const regex = new RegExp(field.pattern);
          if (!regex.test(String(value))) {
            newErrors[key] = `${field.title || key} format is invalid`;
          }
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData, schema]);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (validate() && onSubmit) {
      onSubmit(formData);
    }
  }, [formData, onSubmit, validate]);

  function renderField(key: string, field: FieldSchema): React.ReactNode {
    const value = formData[key];
    const error = errors[key];
    const label = field.title || key;
    const required = schema.required?.includes(key);

    const errorClass = error ? 'border-red-500' : 'border-gray-300';
    const baseClass = `w-full rounded border px-3 py-2 text-sm ${errorClass} focus:border-blue-500 focus:outline-none`;

    if (field.enum) {
      return (
        <div key={key} className="mb-4">
          <label className="mb-1 block text-sm font-medium text-gray-700">
            {label}{required && <span className="text-red-500 ml-1">*</span>}
          </label>
          <select
            className={baseClass}
            value={value || ''}
            onChange={e => handleChange(key, e.target.value)}
            disabled={readOnly}
          >
            <option value="">Select...</option>
            {field.enum.map((opt, i) => (
              <option key={opt} value={opt}>
                {field.enumNames?.[i] || opt}
              </option>
            ))}
          </select>
          {field.description && <p className="mt-1 text-xs text-gray-500">{field.description}</p>}
          {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
        </div>
      );
    }

    if (field.type === 'boolean') {
      return (
        <div key={key} className="mb-4 flex items-center gap-2">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-gray-300 text-blue-600"
            checked={!!value}
            onChange={e => handleChange(key, e.target.checked)}
            disabled={readOnly}
            id={`field-${key}`}
          />
          <label htmlFor={`field-${key}`} className="text-sm font-medium text-gray-700">
            {label}{required && <span className="text-red-500 ml-1">*</span>}
          </label>
          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
      );
    }

    if (field.type === 'integer' || field.type === 'number') {
      return (
        <div key={key} className="mb-4">
          <label className="mb-1 block text-sm font-medium text-gray-700">
            {label}{required && <span className="text-red-500 ml-1">*</span>}
          </label>
          <input
            type="number"
            className={baseClass}
            value={value ?? ''}
            onChange={e => handleChange(key, e.target.value === '' ? undefined : Number(e.target.value))}
            disabled={readOnly}
            min={field.minimum}
            max={field.maximum}
          />
          {field.description && <p className="mt-1 text-xs text-gray-500">{field.description}</p>}
          {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
        </div>
      );
    }

    if (field.type === 'string' && field.format === 'date') {
      return (
        <div key={key} className="mb-4">
          <label className="mb-1 block text-sm font-medium text-gray-700">
            {label}{required && <span className="text-red-500 ml-1">*</span>}
          </label>
          <input
            type="date"
            className={baseClass}
            value={value || ''}
            onChange={e => handleChange(key, e.target.value)}
            disabled={readOnly}
          />
          {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
        </div>
      );
    }

    if (field.type === 'string' && field.format === 'textarea') {
      return (
        <div key={key} className="mb-4">
          <label className="mb-1 block text-sm font-medium text-gray-700">
            {label}{required && <span className="text-red-500 ml-1">*</span>}
          </label>
          <textarea
            className={baseClass}
            value={value || ''}
            onChange={e => handleChange(key, e.target.value)}
            disabled={readOnly}
            rows={4}
          />
          {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
        </div>
      );
    }

    if (field.type === 'object' && field.properties) {
      return (
        <div key={key} className="mb-4 rounded border border-gray-200 p-3">
          <h4 className="mb-2 text-sm font-semibold text-gray-700">{label}</h4>
          {Object.entries(field.properties).map(([subKey, subField]) =>
            renderField(`${key}.${subKey}`, { ...subField, title: subField.title || subKey })
          )}
        </div>
      );
    }

    return (
      <div key={key} className="mb-4">
        <label className="mb-1 block text-sm font-medium text-gray-700">
          {label}{required && <span className="text-red-500 ml-1">*</span>}
        </label>
        <input
          type={field.format === 'email' ? 'email' : field.format === 'tel' ? 'tel' : 'text'}
          className={baseClass}
          value={value || ''}
          onChange={e => handleChange(key, e.target.value)}
          disabled={readOnly}
          placeholder={field.description || ''}
        />
        {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
      </div>
    );
  }

  const layoutClass = schema.layout === 'grid'
    ? 'grid grid-cols-2 gap-4'
    : schema.layout === 'horizontal'
    ? 'flex flex-wrap gap-4'
    : '';

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      {schema.title && !readOnly && (
        <h3 className="text-lg font-semibold text-gray-800">{schema.title}</h3>
      )}
      {schema.description && (
        <p className="text-sm text-gray-500">{schema.description}</p>
      )}

      <div className={layoutClass}>
        {schema.properties &&
          Object.entries(schema.properties).map(([key, field]) => renderField(key, field))}
      </div>

      {!readOnly && (
        <div className="flex gap-3 pt-4">
          {onSubmit && (
            <button
              type="submit"
              className="rounded bg-primary px-6 py-2 text-sm font-medium text-white hover:bg-primary-dark transition-colors"
            >
              {submitLabel}
            </button>
          )}
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="rounded border border-gray-300 bg-white px-6 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          )}
        </div>
      )}
    </form>
  );
}

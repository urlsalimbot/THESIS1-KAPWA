import { FieldProps } from 'react-jsonschema-form';

export type WidgetType = 
  | 'AltDateTimeWidget'
  | 'AltDateWidget'
  | 'BaseInput'
  | 'BooleanCheckbox'
  | 'CheckboxesWidget'
  | 'ColorWidget'
  | 'DateTimeWidget'
  | 'DateWidget'
  | 'EmailWidget'
  | 'FileWidget'
  | 'HiddenWidget'
  | 'PasswordWidget'
  | 'RadioWidget'
  | 'RangeWidget'
  | 'SelectWidget'
  | 'TextareaWidget'
  | 'TextWidget'
  | 'TimeWidget'
  | 'URISelectWidget'
  | 'URLWidget';

export interface UIOptions {
  'ui:autofocus'?: boolean;
  'ui:disabled'?: boolean;
  'ui:placeholder'?: string;
  'ui:readonly'?: boolean;
  'ui:required'?: boolean;
  'ui:hidden'?: boolean;
  'ui:help'?: string;
  'ui:description'?: string;
  'ui:options'?: {
    hideLabel?: boolean;
    grid?: number;
    inline?: boolean;
    classNames?: string;
    inputType?: string;
  };
}

export interface UISchema {
  [fieldPath: string]: UIOptions;
}

export const customWidgets = {
  PhilippinePhoneWidget: (props: FieldProps) => {
    const formatPhone = (value: string) => {
      const digits = value.replace(/\D/g, '');
      if (digits.length <= 3) return digits;
      if (digits.length <= 7) return `(${digits.slice(0,3)}) ${digits.slice(3)}`;
      return `+63 ${digits.slice(0,3)} ${digits.slice(3,6)} ${digits.slice(6)}`;
    };

    return (
      <input
        type="tel"
        className="form-input w-full"
        value={props.value || ''}
        onChange={(e) => props.onChange(formatPhone(e.target.value))}
        placeholder="+63 917 123 4567"
        disabled={props.disabled}
      />
    );
  },

  PhilippineCurrencyWidget: (props: FieldProps) => {
    const formatCurrency = (value: number) => {
      return new Intl.NumberFormat('en-PH', { 
        style: 'currency', 
        currency: 'PHP' 
      }).format(value || 0);
    };

    return (
      <input
        type="number"
        className="form-input w-full"
        value={props.value || ''}
        onChange={(e) => props.onChange(parseFloat(e.target.value) || 0)}
        placeholder="₱0.00"
        disabled={props.disabled}
        min={0}
        step={0.01}
      />
    );
  },

  SignaturePadWidget: (props: FieldProps) => {
    const canvasRef = React.useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = React.useState(false);

    const handleStart = (e: React.MouseEvent | React.TouchEvent) => {
      setIsDrawing(true);
      const canvas = canvasRef.current;
      if (!canvas) return;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const pos = getPosition(e, canvas);
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
    };

    const handleMove = (e: React.MouseEvent | React.TouchEvent) => {
      if (!isDrawing) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const pos = getPosition(e, canvas);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
    };

    const handleEnd = () => {
      setIsDrawing(false);
      const canvas = canvasRef.current;
      if (!canvas) return;
      
      const dataUrl = canvas.toDataURL('image/png');
      props.onChange(dataUrl);
    };

    const handleClear = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      props.onChange('');
    };

    const getPosition = (e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) => {
      const rect = canvas.getBoundingClientRect();
      if ('touches' in e) {
        return {
          x: e.touches[0].clientX - rect.left,
          y: e.touches[0].clientY - rect.top
        };
      }
      return {
        x: (e as React.MouseEvent).clientX - rect.left,
        y: (e as React.MouseEvent).clientY - rect.top
      };
    };

    return (
      <div className="signature-pad">
        <canvas
          ref={canvasRef}
          width={300}
          height={100}
          className="border rounded bg-white touch-none"
          onMouseDown={handleStart}
          onMouseMove={handleMove}
          onMouseUp={handleEnd}
          onMouseLeave={handleEnd}
          onTouchStart={handleStart}
          onTouchMove={handleMove}
          onTouchEnd={handleEnd}
        />
        <button
          type="button"
          className="btn btn-secondary mt-2"
          onClick={handleClear}
        >
          Clear
        </button>
      </div>
    );
  },

  FileUploadWidget: (props: FieldProps) => {
    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = () => {
        props.onChange(reader.result);
      };
      reader.readAsDataURL(file);
    };

    return (
      <input
        type="file"
        className="form-input"
        onChange={handleFileChange}
        accept="image/*,.pdf"
        disabled={props.disabled}
      />
    );
  },

  BarcodeScanWidget: (props: FieldProps) => {
    const handleScan = async () => {
      try {
        const { BarcodeScanner } = await import('@capacitor-community/barcode-scanner');
        const result = await BarcodeScanner.scan();
        if (result.barcodes?.[0]?.rawValue) {
          props.onChange(result.barcodes[0].rawValue);
        }
      } catch (err) {
        console.error('Scan error:', err);
      }
    };

    return (
      <div className="flex gap-2">
        <input
          type="text"
          className="form-input flex-1"
          value={props.value || ''}
          onChange={(e) => props.onChange(e.target.value)}
          disabled={props.disabled}
        />
        <button
          type="button"
          className="btn btn-secondary"
          onClick={handleScan}
        >
          Scan
        </button>
      </div>
    );
  },

  GeoLocationWidget: (props: FieldProps) => {
    const handleGetLocation = async () => {
      if (!navigator.geolocation) return;

      navigator.geolocation.getCurrentPosition(
        (position) => {
          props.onChange({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (err) => console.error('Geolocation error:', err)
      );
    };

    return (
      <div className="flex gap-2">
        <input
          type="text"
          className="form-input flex-1"
          value={props.value ? JSON.stringify(props.value) : ''}
          readOnly
          disabled={props.disabled}
        />
        <button
          type="button"
          className="btn btn-secondary"
          onClick={handleGetLocation}
        >
          Get Location
        </button>
      </div>
    );
  }
};

import * as React from 'react';

export { customWidgets };

export function getUIWidget(fieldPath: string, uiSchema: Record<string, any>): string | undefined {
  const ui = uiSchema[fieldPath];
  if (!ui) return undefined;
  if (ui['ui:options']?.inputType === 'phone') return 'PhilippinePhoneWidget';
  if (ui['ui:options']?.inputType === 'currency') return 'PhilippineCurrencyWidget';
  if (ui['ui:options']?.inputType === 'signature') return 'SignaturePadWidget';
  if (ui['ui:options']?.inputType === 'file') return 'FileUploadWidget';
  if (ui['ui:options']?.inputType === 'barcode') return 'BarcodeScanWidget';
  if (ui['ui:options']?.inputType === 'geolocation') return 'GeoLocationWidget';
  return undefined;
}
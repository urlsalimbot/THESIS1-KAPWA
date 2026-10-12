import { useState, memo } from 'react';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import psgcRaw from '@/lib/psgc.json';
import { POSTAL_CODES } from '@/lib/postal-codes';
import { Button } from '@/components/ui/button';

type PsgcBarangay = { code: string; name: string };
type PsgcMuncity = { code: string; name: string; barangays: PsgcBarangay[] };
type PsgcProvince = { code: string; name: string; muncities: PsgcMuncity[] };
type PsgcRegion = { code: string; name: string; provinces: PsgcProvince[] };

const psgc = psgcRaw as PsgcRegion[];

export interface AddressFields {
  street: string;
  barangay: string;
  city: string;
  province: string;
  region: string;
  postalCode: string;
  psgcCode: string;
}

interface Props {
  value: AddressFields;
  onChange: (field: string, value: string) => void;
  label: string;
  errors?: Record<string, string>;
  fieldPrefix?: string;
}

//  the shadcn base and error borders come from ec()).

function fieldError(field: string, errors?: Record<string, string>, fieldPrefix?: string): string | undefined {
  return fieldPrefix && errors?.[`${fieldPrefix}.${field}`];
}

function ec(field: string, errors?: Record<string, string>, fieldPrefix?: string, base = ''): string {
  const err = fieldError(field, errors, fieldPrefix);
  return `${base}${err ? ' border-destructive' : ''}`;
}

function ErrorText({ field, errors, fieldPrefix }: { field: string; errors?: Record<string, string>; fieldPrefix?: string }) {
  const msg = fieldError(field, errors, fieldPrefix);
  if (!msg) return null;
  return <p className="text-xs text-destructive mt-1">{msg}</p>;
}

export const IntakeAddressBlock = memo(function IntakeAddressBlock({ value, onChange, label, errors, fieldPrefix }: Props) {
  const [showManual, setShowManual] = useState(false);

  const selectedRegion = psgc.find(r => r.code === value.region);
  const selectedProvince = selectedRegion?.provinces.find(p => p.code === value.province);
  const selectedMuncity = selectedProvince?.muncities.find(m => m.code === value.city);
  const isNcr = value.region === '13';
  const regionName = selectedRegion?.name || value.region;
  const provinceName = selectedProvince?.name || value.province;
  const cityName = selectedMuncity?.name || value.city;

  function handleRegionChange(code: string) {
    onChange('region', code);
    onChange('province', '');
    onChange('city', '');
    onChange('barangay', '');
    onChange('psgcCode', '');
  }

  function handleProvinceChange(code: string) {
    onChange('province', code);
    if (isNcr) {
      const prov = selectedRegion?.provinces.find(p => p.code === code);
      onChange('city', prov?.muncities[0]?.code || '');
    } else {
      onChange('city', '');
    }
    onChange('barangay', '');
    onChange('psgcCode', '');
  }

  function handleMuncityChange(code: string) {
    onChange('city', code);
    onChange('barangay', '');
    onChange('psgcCode', '');
    const muncity = selectedProvince?.muncities.find(m => m.code === code);
    if (muncity) {
      const name = muncity.name.trim();
      if (POSTAL_CODES[name]) {
        onChange('postalCode', POSTAL_CODES[name]);
      }
    }
  }

  function handleBarangayChange(code: string) {
    const brgy = selectedMuncity?.barangays.find(b => b.code === code);
    onChange('barangay', brgy?.name || '');
    onChange('psgcCode', code);
  }

  if (showManual) {
    return (
      <div className="space-y-3">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-2">
            <label className="text-sm font-medium">Region</label>
            <Input className={ec('region', errors, fieldPrefix)} value={regionName} onChange={e => onChange('region', e.target.value)} aria-label={`${label} Region`} />
            <ErrorText field="region" errors={errors} fieldPrefix={fieldPrefix} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Province</label>
            <Input className={ec('province', errors, fieldPrefix)} value={provinceName} onChange={e => onChange('province', e.target.value)} aria-label={`${label} Province`} />
            <ErrorText field="province" errors={errors} fieldPrefix={fieldPrefix} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">City/Municipality</label>
            <Input className={ec('city', errors, fieldPrefix)} value={cityName} onChange={e => onChange('city', e.target.value)} aria-label={`${label} City`} />
            <ErrorText field="city" errors={errors} fieldPrefix={fieldPrefix} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Barangay</label>
            <Input className={ec('barangay', errors, fieldPrefix)} value={value.barangay} onChange={e => onChange('barangay', e.target.value)} aria-label={`${label} Barangay`} />
            <ErrorText field="barangay" errors={errors} fieldPrefix={fieldPrefix} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">House/Unit No., Street</label>
            <Input className={ec('street', errors, fieldPrefix)} value={value.street} onChange={e => onChange('street', e.target.value)} aria-label={`${label} Street`} />
            <ErrorText field="street" errors={errors} fieldPrefix={fieldPrefix} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Postal Code</label>
            <Input type="number" className={ec('postalCode', errors, fieldPrefix)} value={value.postalCode} onChange={e => onChange('postalCode', e.target.value)} aria-label={`${label} Postal Code`} />
            <ErrorText field="postalCode" errors={errors} fieldPrefix={fieldPrefix} />
          </div>
        </div>
        <Button variant="ghost" type="button" onClick={() => setShowManual(false)} className="text-xs text-primary hover:underline">
          Pick from list
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-2">
          <label className="text-sm font-medium">Region</label>
          <Select key={`region:${value.region}`} value={value.region} onValueChange={handleRegionChange}>
            <SelectTrigger aria-label={`${label} Region`}>
              <SelectValue placeholder="Select..." />
            </SelectTrigger>
            <SelectContent>
              {psgc.map(r => <SelectItem key={r.code} value={r.code}>{r.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <ErrorText field="region" errors={errors} fieldPrefix={fieldPrefix} />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">{isNcr ? 'City' : 'Province'}</label>
          <Select key={`prov:${value.province}`} value={value.province} onValueChange={handleProvinceChange} disabled={!selectedRegion}>
            <SelectTrigger aria-label={`${label} ${isNcr ? 'City' : 'Province'}`}>
              <SelectValue placeholder="Select..." />
            </SelectTrigger>
            <SelectContent>
              {selectedRegion?.provinces.map(p => <SelectItem key={p.code} value={p.code}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <ErrorText field="province" errors={errors} fieldPrefix={fieldPrefix} />
        </div>
        {!isNcr && (
          <div className="space-y-2">
            <label className="text-sm font-medium">City/Municipality</label>
            <Select key={`city:${value.city}`} value={value.city} onValueChange={handleMuncityChange} disabled={!selectedProvince}>
              <SelectTrigger aria-label={`${label} City`}>
                <SelectValue placeholder="Select..." />
              </SelectTrigger>
              <SelectContent>
                {selectedProvince?.muncities.map(m => <SelectItem key={m.code} value={m.code}>{m.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <ErrorText field="city" errors={errors} fieldPrefix={fieldPrefix} />
          </div>
        )}
        <div className="space-y-2">
          <label className="text-sm font-medium">Barangay</label>
          <Select key={`bgy:${value.barangay}`} value={value.barangay ? (selectedMuncity?.barangays.find(b => b.name === value.barangay)?.code ?? '') : ''} onValueChange={handleBarangayChange} disabled={!selectedMuncity}>
            <SelectTrigger aria-label={`${label} Barangay`}>
              <SelectValue placeholder="Select..." />
            </SelectTrigger>
            <SelectContent>
              {selectedMuncity?.barangays.map(b => <SelectItem key={b.code} value={b.code}>{b.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <ErrorText field="barangay" errors={errors} fieldPrefix={fieldPrefix} />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">House/Unit No., Street</label>
          <Input className={ec('street', errors, fieldPrefix)} value={value.street} onChange={e => onChange('street', e.target.value)} aria-label={`${label} Street`} />
          <ErrorText field="street" errors={errors} fieldPrefix={fieldPrefix} />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Postal Code</label>
          <Input type="number" className={ec('postalCode', errors, fieldPrefix)} value={value.postalCode} onChange={e => onChange('postalCode', e.target.value)} aria-label={`${label} Postal Code`} />
          <ErrorText field="postalCode" errors={errors} fieldPrefix={fieldPrefix} />
        </div>
      </div>

      <Button variant="ghost" type="button" onClick={() => setShowManual(true)} className="text-xs text-primary hover:underline">
        Barangay not listed? Enter manually
      </Button>
    </div>
  );
});

import { useState, memo } from 'react';
import { Input } from '@/components/ui/input';
import psgcRaw from '@/lib/psgc.json';
import { POSTAL_CODES } from '@/lib/postal-codes';

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

const selectClass = 'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50';

function ErrorText({ field, errors, fieldPrefix }: { field: string; errors?: Record<string, string>; fieldPrefix?: string }) {
  const msg = fieldPrefix && errors?.[`${fieldPrefix}.${field}`];
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
            <Input value={regionName} onChange={e => onChange('region', e.target.value)} aria-label={`${label} Region`} />
            <ErrorText field="region" errors={errors} fieldPrefix={fieldPrefix} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Province</label>
            <Input value={provinceName} onChange={e => onChange('province', e.target.value)} aria-label={`${label} Province`} />
            <ErrorText field="province" errors={errors} fieldPrefix={fieldPrefix} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">City/Municipality</label>
            <Input value={cityName} onChange={e => onChange('city', e.target.value)} aria-label={`${label} City`} />
            <ErrorText field="city" errors={errors} fieldPrefix={fieldPrefix} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Barangay</label>
            <Input value={value.barangay} onChange={e => onChange('barangay', e.target.value)} aria-label={`${label} Barangay`} />
            <ErrorText field="barangay" errors={errors} fieldPrefix={fieldPrefix} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">House/Unit No., Street</label>
            <Input value={value.street} onChange={e => onChange('street', e.target.value)} aria-label={`${label} Street`} />
            <ErrorText field="street" errors={errors} fieldPrefix={fieldPrefix} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Postal Code</label>
            <Input type="number" value={value.postalCode} onChange={e => onChange('postalCode', e.target.value)} aria-label={`${label} Postal Code`} />
            <ErrorText field="postalCode" errors={errors} fieldPrefix={fieldPrefix} />
          </div>
        </div>
        <button type="button" onClick={() => setShowManual(false)} className="text-xs text-primary hover:underline">
          Pick from list
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-2">
          <label className="text-sm font-medium">Region</label>
          <select className={selectClass} value={value.region} onChange={e => handleRegionChange(e.target.value)} aria-label={`${label} Region`}>
            <option value="">Select...</option>
            {psgc.map(r => <option key={r.code} value={r.code}>{r.name}</option>)}
          </select>
          <ErrorText field="region" errors={errors} fieldPrefix={fieldPrefix} />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">{isNcr ? 'City' : 'Province'}</label>
          <select className={selectClass} value={value.province} onChange={e => handleProvinceChange(e.target.value)} disabled={!selectedRegion} aria-label={`${label} ${isNcr ? 'City' : 'Province'}`}>
            <option value="">Select...</option>
            {selectedRegion?.provinces.map(p => <option key={p.code} value={p.code}>{p.name}</option>)}
          </select>
          <ErrorText field="province" errors={errors} fieldPrefix={fieldPrefix} />
        </div>
        {!isNcr && (
          <div className="space-y-2">
            <label className="text-sm font-medium">City/Municipality</label>
            <select className={selectClass} value={value.city} onChange={e => handleMuncityChange(e.target.value)} disabled={!selectedProvince} aria-label={`${label} City`}>
              <option value="">Select...</option>
              {selectedProvince?.muncities.map(m => <option key={m.code} value={m.code}>{m.name}</option>)}
            </select>
            <ErrorText field="city" errors={errors} fieldPrefix={fieldPrefix} />
          </div>
        )}
        <div className="space-y-2">
          <label className="text-sm font-medium">Barangay</label>
          <select className={selectClass} value={value.barangay ? (selectedMuncity?.barangays.find(b => b.name === value.barangay)?.code ?? '') : ''} onChange={e => handleBarangayChange(e.target.value)} disabled={!selectedMuncity} aria-label={`${label} Barangay`}>
            <option value="">Select...</option>
            {selectedMuncity?.barangays.map(b => <option key={b.code} value={b.code}>{b.name}</option>)}
          </select>
          <ErrorText field="barangay" errors={errors} fieldPrefix={fieldPrefix} />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">House/Unit No., Street</label>
          <Input value={value.street} onChange={e => onChange('street', e.target.value)} aria-label={`${label} Street`} />
          <ErrorText field="street" errors={errors} fieldPrefix={fieldPrefix} />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Postal Code</label>
          <Input type="number" value={value.postalCode} onChange={e => onChange('postalCode', e.target.value)} aria-label={`${label} Postal Code`} />
          <ErrorText field="postalCode" errors={errors} fieldPrefix={fieldPrefix} />
        </div>
      </div>

      <button type="button" onClick={() => setShowManual(true)} className="text-xs text-primary hover:underline">
        Barangay not listed? Enter manually
      </button>
    </div>
  );
});

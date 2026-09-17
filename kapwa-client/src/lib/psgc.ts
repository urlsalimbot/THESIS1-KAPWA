import psgcRaw from './psgc.json';

type PsgcBarangay = { code: string; name: string };
type PsgcMuncity = { code: string; name: string; barangays: PsgcBarangay[] };
type PsgcProvince = { code: string; name: string; muncities: PsgcMuncity[] };
type PsgcRegion = { code: string; name: string; provinces: PsgcProvince[] };

const psgc = psgcRaw as PsgcRegion[];

const nameByCode = new Map<string, string>();

for (const region of psgc) {
  nameByCode.set(region.code, region.name);
  for (const province of region.provinces) {
    nameByCode.set(province.code, province.name);
    for (const muncity of province.muncities) {
      nameByCode.set(muncity.code, muncity.name);
      for (const barangay of muncity.barangays) {
        nameByCode.set(barangay.code, barangay.name);
      }
    }
  }
}

export function psgcNameFor(value?: string | null): string {
  if (!value) return '';
  const trimmed = String(value).trim();
  if (!/^\d+$/.test(trimmed)) return trimmed;
  return nameByCode.get(trimmed) ?? trimmed;
}

export function addressNames(
  address?: { barangay?: string | null; city?: string | null; province?: string | null } | null,
): string {
  if (!address) return '';
  return [address.barangay, address.city, address.province]
    .map(part => psgcNameFor(part))
    .filter(Boolean)
    .join(', ');
}

import psgcRaw from './psgc.json';

type PsgcBarangay = { code: string; name: string };
type PsgcMuncity = { code: string; name: string; barangays: PsgcBarangay[] };
type PsgcProvince = { code: string; name: string; muncities: PsgcMuncity[] };
type PsgcRegion = { code: string; name: string; provinces: PsgcProvince[] };

const psgc = psgcRaw as PsgcRegion[];

/** Norzagaray, Bulacan — the municipality this deployment covers. */
export const NORZAGARAY_MUNCITY_CODE = '0301413000';

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

/**
 * The barangay names of one municipality, in PSGC order.
 *
 * Forms that must produce a barangay value the intake address block can resolve
 * should offer these rather than free text: `IntakeAddressBlock` matches its
 * options by name, so a misspelt or invented barangay prefills as an empty
 * select and the mismatch is invisible until the worker opens the case.
 * Returns names, not codes, because that is what the address records store.
 */
export function barangayNamesForMuncity(muncityCode: string): string[] {
  for (const region of psgc) {
    for (const province of region.provinces) {
      for (const muncity of province.muncities) {
        if (muncity.code === muncityCode) return muncity.barangays.map(b => b.name);
      }
    }
  }
  return [];
}

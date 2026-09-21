import type { ReactElement } from 'react';

export interface Agency {
  id: string;
  code: string;
  name: string;
  type?: string;
}

export type ReferralStatus = 'referred' | 'received' | 'actioned' | 'closed' | 'declined';

export interface InterAgencyReferral {
  id: string;
  personId: string;
  caseId?: string | null;
  fromAgencyId: string;
  toAgencyId: string;
  status: ReferralStatus;
  reason: string;
  notes?: string;
  legalBasisCode: string;
  outcome?: string;
  declinedReason?: string;
  fromAgency?: Agency;
  toAgency?: Agency;
  /**
   * @deprecated Prefer the flattened identity fields below. `person` is still
   * serialized by the API for backward compatibility, but it carries no middle
   * name and reading it drops part of the person's name.
   */
  person?: { id: string; surname: string; firstName: string };
  // Flattened identity surface, mirroring the barangay Referral payload and the
  // persons name schema. Prefer these over `person`.
  surname?: string;
  firstName?: string;
  middleName?: string;
  extension?: string;
  gender?: string;
  dob?: string;
  phone?: string;
  /** Structured address; `currentAddress` is the same shape under an explicit name. */
  address?: Record<string, string>;
  currentAddress?: Record<string, string>;
  /** Raw display string — the only place `street` is stored. */
  addressLine?: string;
  case?: { controlNo?: string };
  createdAt: string;
}

export const LEGAL_BASIS_OPTIONS = ['public_authority_sec13', 'consent_verified', 'emergency_situation'];

export interface NameParts {
  surname?: string;
  firstName?: string;
  middleName?: string;
  extension?: string;
}

/** `"Dela Cruz Jr., Juan Miguel"` — table and dialog form. */
export function referralListName(p?: NameParts | null): string {
  if (!p) return '';
  const surname = [p.surname, p.extension].filter(Boolean).join(' ');
  const given = [p.firstName, p.middleName].filter(Boolean).join(' ');
  return [surname, given].filter(Boolean).join(', ');
}

/** `"Juan Miguel Dela Cruz Jr."` — inline sentence form. */
export function referralFullName(p?: NameParts | null): string {
  if (!p) return '';
  return [p.firstName, p.middleName, p.surname, p.extension].filter(Boolean).join(' ');
}

const NAME_EXTENSIONS = ['N/A', 'Jr.', 'Sr.', 'II', 'III', 'IV'];
const PH_MOBILE = /^09\d{9}$/;

export interface ReferralPrefillSource extends NameParts {
  gender?: string;
  dob?: string;
  phone?: string;
  /** Structured address as exposed on both referral payloads. */
  address?: Record<string, string>;
  currentAddress?: Record<string, string>;
  /** Raw-backed display string; the only place street is stored. */
  addressLine?: string;
  reason?: string;
}

/**
 * Build the Intake prefill from a referral payload.
 *
 * Only values the intake will actually accept are emitted: the server validates
 * `extension` against a fixed list and `cellularNumber` against /^09\d{9}$/, so
 * a free-text referral value that does not match is dropped rather than
 * pre-filling an input the worker could never submit.
 */
export function referralPrefill(src: ReferralPrefillSource) {
  const barangay = src.currentAddress?.barangay ?? src.address?.barangay ?? '';
  const rawAddress = src.addressLine ?? '';
  // person_addresses has no street column: street only exists inside the
  // comma-joined raw string, and is only trustworthy when a structured barangay
  // anchors it. Region/province/city keep the intake defaults (Norzagaray,
  // Bulacan), which are already correct for barangay referrals.
  const street = barangay && rawAddress ? rawAddress.split(',')[0].trim() : '';
  const phoneDigits = (src.phone ?? '').replace(/\D/g, '');

  return {
    prefill: {
      surname: src.surname ?? '',
      firstName: src.firstName ?? '',
      middleName: src.middleName ?? '',
      extension: NAME_EXTENSIONS.includes(src.extension ?? '') ? src.extension : '',
      gender: src.gender ?? '',
      dob: src.dob ?? '',
      cellularNumber: PH_MOBILE.test(phoneDigits) ? phoneDigits : '',
      currentAddress: { street, barangay },
    },
    reason: src.reason ?? '',
  };
}

/**
 * Route state for handing a referral off to the intake form. All three call
 * sites (worker list, review page, inter-agency detail) use this, so the payload
 * cannot drift between entry points.
 */
export function referralIntakeState(
  type: 'barangay' | 'inter_agency',
  src: { id: string } & ReferralPrefillSource,
) {
  const { prefill, reason } = referralPrefill(src);
  return { prefill, sourceReferral: { type, id: src.id, reason } };
}

export function StatusTimeline({ status }: { status: ReferralStatus }): ReactElement {
  const steps: ReferralStatus[] = ['referred', 'received', 'actioned', 'closed'];
  const activeIndex = status === 'declined' ? -1 : steps.indexOf(status);
  return (
    <div className="flex items-center gap-1" role="img" aria-label="status-timeline">
      {steps.map((s, i) => (
        <div key={s} className="flex items-center gap-1">
          <span
            className={`h-2 w-2 rounded-full ${i <= activeIndex ? 'bg-primary' : 'bg-muted'}`}
          />
          {i < steps.length - 1 && (
            <span className={`h-px w-4 ${i < activeIndex ? 'bg-primary' : 'bg-muted'}`} />
          )}
        </div>
      ))}
    </div>
  );
}

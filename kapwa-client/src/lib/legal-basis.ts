/**
 * The legal bases MSWDO accepts as grounds for handling a protected IRF field:
 * unmasking the parties' names, decrypting the victim's narration, or exporting
 * the form. This is the single list the UI offers and the only set the client
 * will send.
 *
 * The value is a free string in `useIrfOperations` and reaches the API as
 * `?legalBasis=...` or in a request body, so the option list and a predicate
 * over it live together — a caller that can offer a basis can also check one.
 */
export interface LegalBasisOption {
  value: string;
  labelKey: string;
  label: string;
}

export const IRF_LEGAL_BASIS_OPTIONS: LegalBasisOption[] = [
  { value: 'court-order', labelKey: 'irf.lbCourtOrder', label: 'Court Order' },
  { value: 'subpoena', labelKey: 'irf.lbSubpoena', label: 'Subpoena' },
  { value: 'data-subject-consent', labelKey: 'irf.lbConsent', label: 'Written Consent of Data Subject' },
  { value: 'official-investigation', labelKey: 'irf.lbInvestigation', label: 'Official Investigation (DPA)' },
  { value: 'inter-agency-referral', labelKey: 'irf.lbInterAgency', label: 'Inter-Agency Referral' },
  { value: 'foi-request', labelKey: 'irf.lbFoi', label: 'Freedom of Information Request' },
  { value: 'supervisory-review', labelKey: 'irf.lbSupervisory', label: 'Supervisory Review' },
  { value: 'data-privacy-complaint', labelKey: 'irf.lbComplaint', label: 'Data Privacy Complaint' },
];

/**
 * Whether a value is one of the recognised bases. Guards the three requests
 * that are made in a legal basis's name: an unrecognised or tampered value must
 * never be put on the wire. A disabled button is only an affordance — the
 * callers have to check too.
 */
export function isKnownLegalBasis(value: string | null | undefined): boolean {
  if (!value) return false;
  return IRF_LEGAL_BASIS_OPTIONS.some((o) => o.value === value);
}

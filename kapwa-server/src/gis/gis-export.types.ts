export interface GisAddressData {
  street: string;
  barangay: string;
  city: string;
  province: string;
  region: string;
}

export interface GisPersonData {
  surname: string;
  firstName: string;
  middleName?: string;
  extension?: string;
  sex: string;
  dob?: Date;
  age?: number;
  placeOfBirth?: string;
  civilStatus?: string;
  occupation?: string;
  income?: number;
  phone?: string | null;
  philsysNumber?: string;
  relationshipToBeneficiary?: string;
  address: GisAddressData;
  /** Optional provincial/home address, printed on the municipal form. */
  provincialAddress?: string;
}

export interface GisFamilyMemberData {
  fullName: string;
  relationship: string;
  age?: number;
  occupation?: string;
  income?: number;
}

export interface GisInterventionData {
  provided: string;
  amount?: number;
  fundSource?: string;
  /** 'Cash' | 'In-kind' — feeds the Municipal GIS mode-of-assistance boxes. */
  modeOfDelivery?: string;
}

export interface GisPdfData {
  controlNo: string;
  caseId: string;
  createdAt: Date;
  hasRenewal: boolean;
  clientCategory?: string | null;
  referrals: Array<{ reason: string }>;
  assignedWorkerName?: string | null;
  approvedByRole?: string | null;
  officeName?: string | null;
  /** Social worker's assessment (cases.social_worker_assessment). */
  assessment?: string;
  /** cases.problems_presented — Municipal GIS "13a. Problem/s Presented". */
  problemsPresented?: string;
  /** cases.nature_of_service — Municipal GIS "15. Nature of Service/Assistance". */
  natureOfService?: string[];
  /** Financial assistance mode (assistances.mode). */
  modeFinancialAssistance?: string;
  /** Financial assistance fund source (assistances.source_of_fund). */
  sourceOfFund?: string;
  /** Free-text legislator when the fund source is legislative. */
  legislatorSpecify?: string;
  /** Non-financial assistance flags (cases.other_assistance). */
  otherAssistance?: Record<string, unknown>;
  beneficiary: GisPersonData;
  claimant: GisPersonData;
  familyMembers: GisFamilyMemberData[];
  interventions: GisInterventionData[];
}

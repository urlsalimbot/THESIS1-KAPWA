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
  philhealthNumber?: string;
  relationshipToBeneficiary?: string;
  address: GisAddressData;
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
}

export interface GisPdfData {
  controlNo: string;
  caseId: string;
  createdAt: Date;
  hasRenewal: boolean;
  clientCategory?: string | null;
  referrals: Array<{ reason: string }>;
  assignedWorkerName?: string | null;
  beneficiary: GisPersonData;
  claimant: GisPersonData;
  familyMembers: GisFamilyMemberData[];
  interventions: GisInterventionData[];
}

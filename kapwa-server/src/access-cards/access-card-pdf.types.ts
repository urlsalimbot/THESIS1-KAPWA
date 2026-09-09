export interface AccessCardPdfData {
  code: string;
  barangay: string;
  contact: string;
  client: {
    surname: string;
    firstName: string;
    middleName?: string;
    gender: 'Male' | 'Female' | '';
    dob?: Date | string;
    address: string;
  };
  familyMembers: Array<{
    fullName: string;
    relationship: string;
    age?: number;
    status?: string;
    income?: number;
  }>;
  services: Array<{
    date: string;
    rendered: string;
    agency: string;
    worker: string;
  }>;
}

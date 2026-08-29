import type { FamilyMemberInput } from './dto/intake.zod';
import { computeAgeFromDob } from './compute-age';

export interface MemberPersonData {
  surname: string;
  firstName: string;
  middleName?: string;
  extension?: string;
  gender: 'Male' | 'Female';
  dob: Date;
  age?: number;
  occupation?: string;
  estimatedMonthlyIncome?: number;
}

export function memberToPerson(fm: FamilyMemberInput): MemberPersonData {
  return {
    surname: fm.surname,
    firstName: fm.firstName,
    middleName: fm.middleName,
    extension: fm.extension,
    gender: fm.gender,
    dob: new Date(fm.dob),
    age: computeAgeFromDob(fm.dob),
    occupation: fm.occupation,
    estimatedMonthlyIncome: fm.income,
  };
}

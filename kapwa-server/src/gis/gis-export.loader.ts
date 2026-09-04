import { NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { Case } from '../cases/case.entity';
import { CaseIntervention } from '../case-interventions/case-intervention.entity';
import { BeneficiaryClaimant } from '../beneficiaries/beneficiary-claimant.entity';
import { GisPdfData, GisAddressData } from './gis-export.types';

export interface GisCaseLoaderDeps {
  caseRepo: Repository<Case>;
  claimantRepo: Repository<BeneficiaryClaimant>;
  interventionRepo: Repository<CaseIntervention>;
}

function asText(v: unknown): string {
  return typeof v === 'string' ? v : v != null ? String(v) : '';
}

function addressOf(person: any): GisAddressData {
  const addr = Array.isArray(person?.addresses) ? person.addresses.find((a: any) => a.addressType === 'current') : null;
  return {
    street: addr?.raw || asText(person?.address) || '',
    barangay: addr?.barangay || '',
    city: addr?.city || '',
    province: addr?.province || '',
    region: '',
  };
}

export async function loadGisData(deps: GisCaseLoaderDeps, caseId: string): Promise<GisPdfData> {
  const c = await deps.caseRepo.findOne({
    where: { id: caseId },
    relations: [
      'beneficiary',
      'beneficiary.person',
      'beneficiary.household',
      'beneficiary.household.members',
      'beneficiary.household.members.person',
      'assignedWorker',
    ],
  });
  if (!c) throw new NotFoundException('Case not found');

  const ben = c.beneficiary as any;
  const person = ben?.person;
  const household = ben?.household;

  let claimantLink: any = null;
  if (ben?.personId) {
    claimantLink = await deps.claimantRepo.findOne({
      where: { beneficiaryId: ben.personId, isPrimary: true },
      relations: ['claimant'],
    });
  }

  const interventions = await deps.interventionRepo.find({
    where: { caseId },
    order: { deliveryDate: 'ASC', createdAt: 'ASC' },
  });

  const mapPerson = (p: any): { sex: string; dob?: Date; address: GisAddressData } => ({
    sex: asText(p?.gender),
    dob: p?.dob ? new Date(p.dob) : undefined,
    address: addressOf(p),
  });

  const beneficiaryPerson = mapPerson(person);
  const claimantPerson = mapPerson(claimantLink?.claimant);

  const familyMembers = ((household?.members as any[]) || [])
    .filter((m: any) => m?.person)
    .map((m: any) => {
      const p = m.person;
      const fullName = [asText(p.surname), asText(p.firstName), asText(p.middleName)]
        .filter(s => s.trim().length > 0)
        .join(', ')
        .replace(/, ([^,]*),/, ', $1');
      return {
        fullName,
        relationship: asText(m.relationship),
        age: p.dob ? Math.floor((Date.now() - new Date(p.dob).getTime()) / 31557600000) : undefined,
        occupation: asText(p.occupation) || undefined,
        income: p.estimatedMonthlyIncome != null ? Number(p.estimatedMonthlyIncome) : undefined,
      };
    });

  return {
    controlNo: asText(c.controlNo) || caseId,
    caseId,
    createdAt: c.createdAt instanceof Date ? c.createdAt : new Date(c.createdAt),
    hasRenewal: !!c.renewalOfCaseId,
    clientCategory: asText(c.clientCategory) || null,
    referrals: (c.referralRows || []).map((r: any) => ({ reason: asText(r.reason) })),
    assignedWorkerName: asText(c.assignedWorkerName) || c.assignedWorker?.fullName || null,
    approvedByRole: asText(c.approvedByRole) || null,
    beneficiary: {
      surname: asText(person?.surname),
      firstName: asText(person?.firstName),
      middleName: asText(person?.middleName) || undefined,
      extension: asText(person?.extension) || undefined,
      sex: beneficiaryPerson.sex,
      dob: beneficiaryPerson.dob,
      age: person?.dob ? Math.floor((Date.now() - new Date(person.dob).getTime()) / 31557600000) : undefined,
      placeOfBirth: asText(person?.placeOfBirth) || undefined,
      civilStatus: asText(person?.civilStatus) || undefined,
      occupation: asText(person?.occupation) || undefined,
      income: person?.estimatedMonthlyIncome != null ? Number(person.estimatedMonthlyIncome) : undefined,
      phone: person?.phone ?? null,
      philhealthNumber: asText(person?.philhealthNumber) || undefined,
      address: beneficiaryPerson.address,
    },
    claimant: {
      surname: asText(claimantLink?.claimant?.surname),
      firstName: asText(claimantLink?.claimant?.firstName),
      middleName: asText(claimantLink?.claimant?.middleName) || undefined,
      extension: asText(claimantLink?.claimant?.extension) || undefined,
      sex: claimantPerson.sex,
      dob: claimantPerson.dob,
      age: claimantLink?.claimant?.dob ? Math.floor((Date.now() - new Date(claimantLink.claimant.dob).getTime()) / 31557600000) : undefined,
      civilStatus: asText(claimantLink?.claimant?.civilStatus) || undefined,
      occupation: asText(claimantLink?.claimant?.occupation) || undefined,
      income: claimantLink?.claimant?.estimatedMonthlyIncome != null ? Number(claimantLink.claimant.estimatedMonthlyIncome) : undefined,
      phone: claimantLink?.claimant?.phone ?? null,
      address: claimantPerson.address,
      relationshipToBeneficiary: asText(claimantLink?.relationship) || undefined,
    },
    familyMembers,
    interventions: (interventions || []).map((i: any) => ({
      provided: asText(i.serviceName) || asText(i.programId),
      amount: i.amount != null ? Number(i.amount) : undefined,
      fundSource: asText(i.fundSource) || undefined,
    })),
  };
}

import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Case } from '../cases/case.entity';
import { BeneficiaryClaimant } from '../beneficiaries/beneficiary-claimant.entity';
import { Person } from '../beneficiaries/person.entity';
import { User, UserRole } from '../auth/user.entity';
import { OrgService } from '../common/org.service';
import { buildScsrPdf, ScsrFamilyRow, ScsrKind } from './scsr-pdf.builder';

const FILIPINO_MONTHS = [
  'Enero', 'Peb', 'Marso', 'Abril', 'Mayo', 'Hunyo',
  'Hulyo', 'Agosto', 'Setyembre', 'Oktubre', 'Nobyembre', 'Disyembre',
];

/**
 * Social Case Study Report for burial and medical assistance — the office's two
 * paper forms (pdf-samples/SCSR-Buryal, SCSR-Medikal) generated from the case.
 *
 * Everything the database knows is filled in; everything only the social worker
 * can answer is left as a rule to write on, like the paper form. In Filipino,
 * because the form is.
 */
@Injectable()
export class ScsrExportService {
  constructor(
    @InjectRepository(Case) private readonly caseRepo: Repository<Case>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(BeneficiaryClaimant) private readonly claimantRepo: Repository<BeneficiaryClaimant>,
    @InjectRepository(Person) private readonly personRepo: Repository<Person>,
    private readonly org: OrgService,
  ) {}

  async generateScsrPdf(caseId: string, kind: ScsrKind): Promise<Buffer> {
    const c = await this.caseRepo.findOne({
      where: { id: caseId },
      relations: [
        'beneficiary', 'beneficiary.person', 'beneficiary.household',
        'beneficiary.household.members', 'beneficiary.household.members.person',
        'assignedWorker',
      ],
    });
    if (!c) throw new NotFoundException('Case not found');

    const ben = c.beneficiary as any;
    const person: Person | undefined = ben?.person;
    // The claimant's person is reached by id: the link row carries claimant_id,
    // and the entity maps no relation for it.
    const claimantLink = await this.claimantRepo.findOne({
      where: { beneficiaryId: ben?.id },
      order: { isPrimary: 'DESC' as const },
    });
    const claimantPerson = claimantLink
      ? await this.personRepo.findOne({ where: { id: claimantLink.claimantId } })
      : null;
    const claimantName = fullName(claimantPerson);

    return buildScsrPdf({
      kind,
      officeName: await this.org.officeName(),
      controlNo: c.controlNo,
      // Uppercase, as the office's template prints it.
      petsa: filipinoDate(new Date()).toUpperCase(),
      client: {
        pangalan: upper(fullName(person)),
        edad: ageText(person?.dob),
        kaarawan: upper(filipinoDate(person?.dob)),
        lugar: upper(person?.placeOfBirth ?? ''),
        // No education column exists on the person: the social worker writes it.
        natapos: '',
        tirahan: upper(addressText(person)),
        estado: upper(person?.civilStatus ?? ''),
        kasarian: person?.gender === 'Female' ? 'BABAE' : 'LALAKE',
        hanapbuhay: upper(person?.occupation ?? ''),
        // No religion is recorded either.
        relihiyon: '',
        // Who the case study came from: the claimant if one signed, otherwise
        // the client themselves.
        pinagkunan: upper(claimantName || fullName(person)),
        contact: person?.phone ?? claimantPerson?.phone ?? '',
      },
      family: familyRows(ben?.household),
      preparedByName: upper(fullName(c.assignedWorker) || c.assignedWorkerName || ''),
      preparedByRole: 'SOCIAL WORKER',
      notedByName: upper(fullName(await this.firstActiveAdmin())),
      notedByRole: 'MSWDO HEAD',
    });
  }

  // Case number for export filenames (`SCSR-Buryal <controlNo>-<date>.pdf`).
  async controlNo(caseId: string): Promise<string> {
    const c = await this.caseRepo.findOne({ where: { id: caseId } });
    if (!c) throw new NotFoundException('Case not found');
    return c.controlNo || caseId;
  }

  private async firstActiveAdmin(): Promise<User | null> {
    try {
      return await this.userRepo.findOne({ where: { role: UserRole.ADMIN, isActive: true }, order: { createdAt: 'ASC' } });
    } catch {
      return null;
    }
  }
}

function fullName(p: Person | any | null | undefined): string {
  if (!p) return '';
  return [p.surname, p.firstName, p.middleName].filter(Boolean).join(' ');
}

function upper(v: string): string {
  return (v ?? '').toString().toUpperCase();
}

function ageText(dob: Date | string | null | undefined): string {
  if (!dob) return '';
  const ms = Date.now() - new Date(dob).getTime();
  if (!(ms > 0)) return '';
  return `${Math.floor(ms / 31557600000)} TAONG GULANG`;
}

function addressText(person: Person | any | null | undefined): string {
  const addr = Array.isArray(person?.currentAddress) ? person.currentAddress[0] : person?.currentAddress;
  if (!addr) return person?.address ?? '';
  return [addr.barangay, addr.city, addr.province].filter(Boolean).join(', ');
}

function filipinoDate(d: Date | string | null | undefined): string {
  if (!d) return '';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return '';
  return `${FILIPINO_MONTHS[dt.getMonth()]} ${dt.getDate()}, ${dt.getFullYear()}`;
}

function familyRows(household: any): ScsrFamilyRow[] {
  const members = (household?.members as any[]) ?? [];
  return members
    .filter((m) => m?.person)
    .map((m) => ({
      name: upper(fullName(m.person)),
      age: ageText(m.person?.dob).replace(' TAONG GULANG', ''),
      relationship: upper(m.relationship ?? ''),
      occupation: upper(m.person?.occupation ?? ''),
      // No peso sign in Helvetica: the column is an amount, so it prints bare.
      income: m.person?.estimatedMonthlyIncome != null ? Number(m.person.estimatedMonthlyIncome).toLocaleString('en-US') : '',
    }));
}

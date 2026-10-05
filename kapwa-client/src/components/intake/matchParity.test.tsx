import { describe, it, expect } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { vi } from 'vitest';
import { MatchProbeDialog } from './MatchProbeDialog';
import { MatchCandidateCard, type MatchCandidate, type MatchIntakeFields } from './MatchCardSections';
import { IntakeReviewPage } from '@/pages/IntakeReviewPage';

vi.mock('@/lib/api', () => ({ api: { post: vi.fn(), get: vi.fn() } }));
vi.mock('@/lib/auth-context', () => ({ useAuth: () => ({ user: { id: 'user-1' } }) }));
vi.mock('@/hooks/useIntakeAutosave', () => ({ clearDraft: vi.fn() }));
vi.mock('@/lib/intake-id-photo', () => ({ uploadIntakeIdPhotos: vi.fn().mockResolvedValue(true) }));
vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), info: vi.fn() }),
}));

const intake: MatchIntakeFields = {
  surname: 'Dela Cruz',
  firstName: 'Ana',
  dob: '2015-03-30',
  cellularNumber: '09171234567',
  email: 'ana@example.com',
  philsysNumber: '12-3456789012-3',
  currentAddress: { barangay: 'Bigte' },
};

// A deliberately rich candidate: a member match inside a roster of three, with
// match reasons, a household case, and PII on both sides.
const candidate: MatchCandidate = {
  householdId: 'hh-1',
  score: 0.92,
  matchedOn: ['phone', 'both_names'],
  caseExistsWithin30Days: true,
  primaryBeneficiary: {
    id: 'ben-1',
    surname: 'Dela Cruz',
    firstName: 'Juan',
    gender: 'Male',
    age: 48,
    dob: '1978-01-02',
    phone: '09171234567',
    email: 'juan@example.com',
    occupation: 'Farmer',
    estimatedMonthlyIncome: 8000,
    civilStatus: 'Married',
    currentAddress: { barangay: 'Bigte' },
    philsysNumber: '12-3456789012-3',
  },
  matchedPerson: {
    id: 'person-ana',
    role: 'member',
    relationship: 'Child',
    surname: 'Dela Cruz',
    firstName: 'Ana',
    gender: 'Female',
    age: 11,
    dob: '2015-03-30',
    phone: '09171234567',
    email: 'ana@example.com',
    occupation: 'Student',
    estimatedMonthlyIncome: 0,
    civilStatus: 'Single',
    currentAddress: { barangay: 'Bigte' },
  },
  allBeneficiaries: [{ id: 'ben-1', surname: 'Dela Cruz', firstName: 'Juan' }],
  familyMembers: [
    { id: 'person-maria', fullName: 'Maria Dela Cruz', surname: 'Dela Cruz', firstName: 'Maria', middleName: 'Santos', gender: 'Female', dob: '1980-05-06', civilStatus: 'Married', relationship: 'Spouse', age: 46, occupation: 'Vendor', income: 4000, status: 'active' },
    { id: 'person-ana', fullName: 'Ana Dela Cruz', surname: 'Dela Cruz', firstName: 'Ana', gender: 'Female', dob: '2015-03-30', civilStatus: 'Single', relationship: 'Child', age: 11, occupation: 'Student', income: 0, status: 'active' },
    { id: 'person-tom', fullName: 'Tom Dela Cruz', surname: 'Dela Cruz', firstName: 'Tom', gender: 'Male', dob: '2018-09-09', civilStatus: 'Single', relationship: 'Child', age: 8, occupation: 'Student', income: 0, status: 'active' },
  ],
  pastCases: [{ controlNo: 'KAPWA-2026-00021', beneficiaryName: 'Juan Dela Cruz', status: 'active', createdAt: '2026-09-20T00:00:00Z' }],
  lastApprovedCaseDate: '2026-09-20T00:00:00.000Z',
};

function renderProbe() {
  return render(
    <MemoryRouter>
      <MatchProbeDialog candidates={[candidate]} intake={intake} onConfirm={() => {}} onDismiss={() => {}} />
    </MemoryRouter>
  );
}

function renderReview() {
  return render(
    <MemoryRouter initialEntries={[{ pathname: '/intake/review', state: { candidates: [candidate], intakeData: { beneficiary: intake, familyMembers: [], case: {} } } }]}>
      <Routes>
        <Route path="/intake/review" element={<IntakeReviewPage />} />
      </Routes>
    </MemoryRouter>
  );
}

// Every fact a worker needs to judge a match. Both surfaces must show all of
// them — this is the parity contract, kept here so the two cannot drift.
const FACTS: Array<[string, RegExp]> = [
  ['who matched', /Is this/i],
  ['matched name', /Ana Dela Cruz/],
  ['member role', /Household member · Child/i],
  ['household head', /Household of: Juan Dela Cruz/i],
  ['barangay', /Barangay: Bigte/i],
  ['why flagged', /Why this was flagged/i],
  ['phone reason', /Phone match/i],
  ['both-names reason', /Both names/i],
  ['entered column', /You entered/i],
  ['existing column', /Existing record/i],
  ['phone comparison', /09171234567/],
  ['email comparison', /ana@example\.com/],
  ['case outcome', /new case will be opened/i],
  ['members section', /Household members \(3\)/i],
  ['spouse in roster', /Maria S\. Dela Cruz/],
  ['member age', /46 y\/o/],
  // Probing "is this the same family?" needs the attributes that distinguish a
  // relative, not just a name and a relationship.
  ['member sex', /Female/],
  ['member civil status', /Married/],
  ['member occupation', /Vendor/],
  ['member household status', /active/],
  ['past cases', /Past cases/i],
  ['control number', /KAPWA-2026-00021/],
];

describe('match card parity: pop-up vs review page', () => {
  it.each([
    ['match pop-up', renderProbe],
    ['review page', renderReview],
  ])('%s shows every match fact', (_surface, renderSurface) => {
    renderSurface();
    for (const [fact, pattern] of FACTS) {
      expect(screen.getAllByText(pattern).length, `missing ${fact}`).toBeGreaterThan(0);
    }
    cleanup();
  });

  it('pop-up and review page show the same facts for the same candidate', () => {
    renderProbe();
    const inProbe = FACTS.filter(([, p]) => screen.queryAllByText(p).length > 0).map(([f]) => f);
    cleanup();
    renderReview();
    const inReview = FACTS.filter(([, p]) => screen.queryAllByText(p).length > 0).map(([f]) => f);
    cleanup();
    expect(inReview).toEqual(inProbe);
  });

  it('omits the comparison block when no entered details are supplied', () => {
    render(
      <MemoryRouter>
        <MatchProbeDialog candidates={[candidate]} onConfirm={() => {}} onDismiss={() => {}} />
      </MemoryRouter>
    );
    expect(screen.queryByText('You entered')).toBeNull();
    // The rest of the card is unaffected.
    expect(screen.getByText(/Household members \(3\)/i)).toBeDefined();
  });

  it('marks the matched person inside the roster so they are not lost in a long list', () => {
    render(
      <MemoryRouter>
        <MatchCandidateCard candidate={candidate} />
      </MemoryRouter>
    );
    const roster = screen.getByRole('list', { name: /Household members/i });
    const matchedRow = within(roster).getByText('Ana Dela Cruz').closest('li');
    const otherRow = within(roster).getByText('Tom Dela Cruz').closest('li');
    expect(matchedRow?.className).toContain('text-primary');
    expect(otherRow?.className).not.toContain('text-primary');
  });

  it('carries the probing detail on one roster row instead of scattered columns', () => {
    render(
      <MemoryRouter>
        <MatchCandidateCard candidate={candidate} />
      </MemoryRouter>
    );
    const roster = screen.getByRole('list', { name: /Household members/i });
    const spouseRow = within(roster).getByText('Maria S. Dela Cruz').closest('li');
    // One meta line, so a long roster stays scannable and the attributes stay
    // attached to the person they describe.
    expect(within(spouseRow as HTMLElement).getByText('46 y/o · Female · Married · Vendor · active')).toBeTruthy();
  });

  it('drops unknown member attributes instead of rendering a row of separators', () => {
    const sparse = {
      ...candidate,
      familyMembers: [
        { id: 'p1', fullName: 'Ana Dela Cruz', surname: 'Dela Cruz', firstName: 'Ana', gender: '', civilStatus: undefined, relationship: 'Child', age: 0, occupation: '', income: 0, status: '' },
      ],
    };
    render(
      <MemoryRouter>
        <MatchCandidateCard candidate={sparse} />
      </MemoryRouter>
    );
    const roster = screen.getByRole('list', { name: /Household members/i });
    const row = within(roster).getByText(/Ana Dela Cruz/).closest('li');
    // Only the relationship separator survives; no empty fields and no
    // dangling "· ·" where the dropped attributes used to sit.
    expect(row?.textContent).toBe('Ana Dela Cruz· Child');
  });

  it('lists a case once even when it arrives as both the household case and the person’s own', () => {
    const dupe = {
      ...candidate,
      pastCases: [
        candidate.pastCases[0],
        { ...candidate.pastCases[0] },
      ],
    };
    render(
      <MemoryRouter>
        <MatchCandidateCard candidate={dupe} />
      </MemoryRouter>
    );
    const caseList = screen.getByRole('list', { name: /Past cases/i });
    expect(within(caseList).getAllByText('KAPWA-2026-00021')).toHaveLength(1);
  });
});

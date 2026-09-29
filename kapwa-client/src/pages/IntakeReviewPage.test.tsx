import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Toaster } from 'sonner';
import { IntakeReviewPage } from './IntakeReviewPage';
import { uploadIntakeIdPhotos } from '@/lib/intake-id-photo';
import { api } from '../lib/api';
import { axe } from 'vitest-axe';

vi.mock('@/lib/intake-id-photo', () => ({
  uploadIntakeIdPhotos: vi.fn().mockResolvedValue(true),
  setPendingBeneficiaryIdPhoto: vi.fn(),
  getPendingBeneficiaryIdPhoto: vi.fn(),
  setPendingClaimantIdPhoto: vi.fn(),
  getPendingClaimantIdPhoto: vi.fn(),
  clearPendingIdPhoto: vi.fn(),
}));

const mockNavigate = vi.fn();

let mockLocationState: any = {
  candidates: [
    {
      householdId: 'hh-1',
      score: 0.92,
      matchedOn: ['phone', 'both_names'],
      caseExistsWithin30Days: false,
      primaryBeneficiary: {
        id: 'ben-1', surname: 'Dela Cruz', firstName: 'Juan',
        gender: 'Male', age: 40, phone: '09171234567',
        occupation: 'Farmer', estimatedMonthlyIncome: 8500,
        civilStatus: 'Married', currentAddress: { barangay: 'Bigte', street: '123 Purok 1' },
        philhealthNumber: '123456789', category: 'Family',
          dob: '1985-01-20',
          email: 'juan.delacruz@example.com',
      },
      matchedPerson: {
            id: 'ben-1', role: 'beneficiary', surname: 'Dela Cruz', firstName: 'Juan',
            gender: 'Male', age: 40, dob: '1985-01-20', phone: '09171234567',
            email: 'juan.delacruz@example.com',
            occupation: 'Farmer', estimatedMonthlyIncome: 8500, civilStatus: 'Married',
            currentAddress: { barangay: 'Bigte', street: '123 Purok 1' },
            philhealthNumber: '123456789',
          },
          allBeneficiaries: [{ id: 'ben-1', surname: 'Dela Cruz', firstName: 'Juan' }],
      familyMembers: [
        { id: 'fm-1', fullName: 'Maria Dela Cruz', relationship: 'Spouse', age: 35, occupation: 'Housewife', income: 0, status: 'Unemployed' },
      ],
      lastApprovedCaseDate: '2025-01-20T00:00:00.000Z',
    },
    {
      householdId: 'hh-2',
      score: 0.45,
      caseExistsWithin30Days: false,
      primaryBeneficiary: {
        id: 'ben-2', surname: 'Cruz', firstName: 'Rosa',
        gender: 'Female', age: 38, phone: '09171234599',
        occupation: 'Vendor', estimatedMonthlyIncome: 5000,
        civilStatus: 'Married', currentAddress: null,
        philhealthNumber: undefined, category: undefined,
      },
      matchedPerson: {
            id: 'ben-2', role: 'member', relationship: 'Child', surname: 'Cruz', firstName: 'Rosa',
            gender: 'Female', age: 38, phone: '09171234599',
            occupation: 'Vendor', estimatedMonthlyIncome: 5000,
            civilStatus: 'Married', currentAddress: null,
            philhealthNumber: undefined,
          },
          allBeneficiaries: [{ id: 'ben-2', surname: 'Cruz', firstName: 'Rosa' }],
      familyMembers: [],
      lastApprovedCaseDate: new Date().toISOString(),
    },
  ],
  intakeData: {
    beneficiary: { surname: 'Dela Cruz', firstName: 'Juan', age: 40, currentAddress: { barangay: 'Bigte' }, gender: 'Male', estimatedMonthlyIncome: 8500, occupation: 'Farmer', cellularNumber: '09171234567', dob: '1985-01-20', email: 'juan.delacruz@example.com' },
    familyMembers: [{ surname: 'Dela Cruz', firstName: 'Maria', relationship: 'Spouse' }],
  },
};

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...(actual as object),
    useNavigate: () => mockNavigate,
    useLocation: () => ({ state: mockLocationState }),
  };
});

vi.mock('../lib/api', () => ({
  api: { post: vi.fn().mockResolvedValue({ caseCreated: true, caseId: 'case-1', controlNo: 'CTRL-001', message: 'Info updated and new case created.' }) },
}));

// The review step is where the intake draft is retired, so it needs a user id.
vi.mock('@/lib/auth-context', () => ({
  useAuth: () => ({ user: { id: 'u1' } }),
}));

const DRAFT_KEY = 'kapwa:intake:draft:u1';

describe('IntakeReviewPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockLocationState = {
      candidates: [
        {
          householdId: 'hh-1',
          score: 0.92,
      matchedOn: ['phone', 'both_names'],
          caseExistsWithin30Days: false,
          primaryBeneficiary: {
            id: 'ben-1', surname: 'Dela Cruz', firstName: 'Juan',
            gender: 'Male', age: 40, phone: '09171234567',
            occupation: 'Farmer', estimatedMonthlyIncome: 8500,
            civilStatus: 'Married', currentAddress: { barangay: 'Bigte', street: '123 Purok 1' },
            philhealthNumber: '123456789', category: 'Family',
          dob: '1985-01-20',
          email: 'juan.delacruz@example.com',
          },
          matchedPerson: {
            id: 'ben-1', role: 'beneficiary', surname: 'Dela Cruz', firstName: 'Juan',
            gender: 'Male', age: 40, dob: '1985-01-20', phone: '09171234567',
            email: 'juan.delacruz@example.com',
            occupation: 'Farmer', estimatedMonthlyIncome: 8500, civilStatus: 'Married',
            currentAddress: { barangay: 'Bigte', street: '123 Purok 1' },
            philhealthNumber: '123456789',
          },
          allBeneficiaries: [{ id: 'ben-1', surname: 'Dela Cruz', firstName: 'Juan' }],
          familyMembers: [
            { id: 'fm-1', fullName: 'Maria Dela Cruz', relationship: 'Spouse', age: 35, occupation: 'Housewife', income: 0, status: 'Unemployed' },
          ],
          lastApprovedCaseDate: '2025-01-20T00:00:00.000Z',
        },
        {
          householdId: 'hh-2',
          score: 0.45,
          caseExistsWithin30Days: false,
          primaryBeneficiary: {
            id: 'ben-2', surname: 'Cruz', firstName: 'Rosa',
            gender: 'Female', age: 38, phone: '09171234599',
            occupation: 'Vendor', estimatedMonthlyIncome: 5000,
            civilStatus: 'Married', currentAddress: null,
            philhealthNumber: undefined, category: undefined,
          },
          matchedPerson: {
            id: 'ben-2', role: 'member', relationship: 'Child', surname: 'Cruz', firstName: 'Rosa',
            gender: 'Female', age: 38, phone: '09171234599',
            occupation: 'Vendor', estimatedMonthlyIncome: 5000,
            civilStatus: 'Married', currentAddress: null,
            philhealthNumber: undefined,
          },
          allBeneficiaries: [{ id: 'ben-2', surname: 'Cruz', firstName: 'Rosa' }],
          familyMembers: [],
          lastApprovedCaseDate: new Date().toISOString(),
        },
      ],
      intakeData: {
        beneficiary: { surname: 'Dela Cruz', firstName: 'Juan', age: 40, currentAddress: { barangay: 'Bigte' }, gender: 'Male', estimatedMonthlyIncome: 8500, occupation: 'Farmer', cellularNumber: '09171234567', dob: '1985-01-20', email: 'juan.delacruz@example.com' },
        familyMembers: [{ surname: 'Dela Cruz', firstName: 'Maria', relationship: 'Spouse' }],
      },
    };
  });

  it('should render match cards with plain-language labels', async () => {
    render(
      <MemoryRouter>
        <IntakeReviewPage />
      </MemoryRouter>
    );
    expect(screen.getByText(/Very likely the same person/i)).toBeDefined();
    expect(screen.getByText(/Some similarities/i)).toBeDefined();
  });

  it('should not render percentage scores', async () => {
    render(
      <MemoryRouter>
        <IntakeReviewPage />
      </MemoryRouter>
    );
    expect(screen.queryByText('92%')).toBeNull();
    expect(screen.queryByText(/Score/i)).toBeNull();
  });

  it('should show side-by-side comparison', async () => {
    render(
      <MemoryRouter>
        <IntakeReviewPage />
      </MemoryRouter>
    );
    expect(screen.getAllByText('You entered').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Existing record').length).toBeGreaterThanOrEqual(1);
  });

  it('should show context-aware buttons', async () => {
    render(
      <MemoryRouter>
        <IntakeReviewPage />
      </MemoryRouter>
    );
    const btns = screen.getAllByRole('button', { name: /update info/i });
    expect(btns.length).toBeGreaterThanOrEqual(1);
  });

  it('states the active-case outcome conditionally, not as a fixed promise', async () => {
    mockLocationState = {
      candidates: [
        {
          householdId: 'hh-active', score: 0.9, matchedOn: ['both_names'], caseExistsWithin30Days: true,
          primaryBeneficiary: { id: 'ben-1', surname: 'Dela Cruz', firstName: 'Juan', gender: 'Male', age: 40, occupation: 'Farmer', estimatedMonthlyIncome: 8500, civilStatus: 'Married', currentAddress: { barangay: 'Bigte' } },
          matchedPerson: { id: 'ben-1', role: 'beneficiary', surname: 'Dela Cruz', firstName: 'Juan', gender: 'Male', age: 40, occupation: 'Farmer', estimatedMonthlyIncome: 8500, civilStatus: 'Married', currentAddress: { barangay: 'Bigte' } },
          allBeneficiaries: [{ id: 'ben-1', surname: 'Dela Cruz', firstName: 'Juan' }],
          familyMembers: [],
          pastCases: [], lastApprovedCaseDate: null,
        },
      ],
      intakeData: { beneficiary: { surname: 'Dela Cruz', firstName: 'Juan' }, claimant: {}, familyMembers: [], case: {} },
    };
    render(
      <MemoryRouter>
        <IntakeReviewPage />
      </MemoryRouter>
    );
    // The worker chooses the outcome, so the note must not assert that no new
    // case will be created (a different household member may still register).
    expect(screen.queryByText(/no new case will be created/i)).toBeNull();
    expect(screen.getAllByText(/choosing "Yes, update info"/i).length).toBeGreaterThanOrEqual(1);
  });

  it('should show "Not this person" buttons per card', async () => {
    render(
      <MemoryRouter>
        <IntakeReviewPage />
      </MemoryRouter>
    );
    const rejectBtns = screen.getAllByRole('button', { name: /not this person/i });
    expect(rejectBtns.length).toBeGreaterThanOrEqual(1);
  });

  it('should show "None of these match" escape hatch', async () => {
    render(
      <MemoryRouter>
        <IntakeReviewPage />
      </MemoryRouter>
    );
    expect(screen.getByText(/None of these match/i)).toBeDefined();
  });

  it('should show eligibility info on cards', async () => {
    render(
      <MemoryRouter>
        <IntakeReviewPage />
      </MemoryRouter>
    );
    expect(screen.getByText(/eligible for a new case/i)).toBeDefined();
  });

  it('should handle confirm success and navigate', async () => {
    render(
      <MemoryRouter>
        <IntakeReviewPage />
      </MemoryRouter>
    );
    const confirmBtn = screen.getAllByRole('button', { name: /update info/i })[0];
    fireEvent.click(confirmBtn);
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalled();
    });
  });

  it('inverts household relationships when confirming a member match', async () => {
    mockLocationState = {
      candidates: [
        {
          householdId: 'hh-querubin', score: 0.9, matchedOn: ['both_names'], caseExistsWithin30Days: false,
          primaryBeneficiary: {
            id: 'ben-pablo', surname: 'Querubin', firstName: 'Pablo', gender: 'Male', age: 48,
            dob: '1978-12-01', occupation: 'Farmer', estimatedMonthlyIncome: 8000,
            civilStatus: 'Married', currentAddress: { barangay: 'Partida' },
          },
          matchedPerson: {
            id: 'person-liza', role: 'member', relationship: 'Child', surname: 'Querubin', firstName: 'Liza',
            gender: 'Female', age: 11, dob: '2015-03-30', occupation: 'Student', estimatedMonthlyIncome: 0,
            civilStatus: 'Single', currentAddress: { barangay: 'Partida' },
          },
          allBeneficiaries: [{ id: 'ben-pablo', surname: 'Querubin', firstName: 'Pablo' }],
          familyMembers: [
            { id: 'fm-liza', fullName: 'Liza Querubin', surname: 'Querubin', firstName: 'Liza', gender: 'Female', dob: '2015-03-30', relationship: 'Child', age: 11, occupation: 'Student', income: 0, status: 'Active' },
            { id: 'fm-consuelo', fullName: 'Consuelo Querubin', surname: 'Querubin', firstName: 'Consuelo', gender: 'Female', dob: '1985-05-05', relationship: 'Spouse', age: 41, occupation: 'Housewife', income: 0, status: 'Active' },
          ],
          pastCases: [], lastApprovedCaseDate: null,
        },
      ],
      intakeData: {
        beneficiary: { surname: 'Querubin', firstName: 'Liza', gender: 'Female', dob: '2015-03-30', currentAddress: { barangay: 'Partida' } },
        claimant: { surname: 'Querubin', firstName: 'Consuelo', relationshipToBeneficiary: 'Parent' },
        familyMembers: [],
        case: {},
      },
    };
    render(
      <MemoryRouter>
        <IntakeReviewPage />
      </MemoryRouter>
    );

    const confirmBtn = screen.getAllByRole('button', { name: /update info/i })[0];
    fireEvent.click(confirmBtn);
    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/intake/confirm/hh-querubin', expect.anything());
    });
    const call = (api.post as ReturnType<typeof vi.fn>).mock.calls.find(
      (c: unknown[]) => c[0] === '/intake/confirm/hh-querubin',
    );
    const fm = (call![1] as { familyMembers: Array<{ firstName: string; relationship: string }> }).familyMembers;
    expect(fm.map(m => ({ firstName: m.firstName, relationship: m.relationship }))).toEqual([
      { firstName: 'Pablo', relationship: 'Parent' },
      { firstName: 'Consuelo', relationship: 'Parent' },
    ]);
    expect(fm.some(m => m.firstName === 'Liza')).toBe(false);
  });

  it('uploads the pending ID photo once a case is confirmed', async () => {
    render(
      <MemoryRouter>
        <IntakeReviewPage />
      </MemoryRouter>
    );
    const confirmBtn = screen.getAllByRole('button', { name: /update info/i })[0];
    fireEvent.click(confirmBtn);
    await waitFor(() => {
      expect(uploadIntakeIdPhotos).toHaveBeenCalledWith('case-1');
    });
  });

  it('uploads the pending ID photo when registering as a new client', async () => {
    render(
      <MemoryRouter>
        <IntakeReviewPage />
      </MemoryRouter>
    );
    fireEvent.click(screen.getByRole('button', { name: /register as new client/i }));
    await waitFor(() => {
      expect(uploadIntakeIdPhotos).toHaveBeenCalledWith('case-1');
    });
  });

  it('should show empty state when no candidates', async () => {
    mockLocationState = { candidates: [], intakeData: {} };
    render(
      <MemoryRouter>
        <IntakeReviewPage />
      </MemoryRouter>
    );
    expect(screen.getByText(/No prior records found/i)).toBeDefined();
  });

  it('has no a11y violations', async () => {
    const { container } = render(
      <MemoryRouter>
        <IntakeReviewPage />
      </MemoryRouter>
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should show multiple match cards', async () => {
    render(
      <MemoryRouter>
        <IntakeReviewPage />
      </MemoryRouter>
    );
    const matchCards = screen.getAllByText(/Is this/i);
    expect(matchCards.length).toBe(2);
  });

  it('retires the intake draft once an existing case is updated', async () => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ data: {}, savedAt: new Date().toISOString() }));
    render(
      <MemoryRouter>
        <IntakeReviewPage />
      </MemoryRouter>
    );
    fireEvent.click(screen.getAllByRole('button', { name: /update info/i })[0]);
    await waitFor(() => expect(localStorage.getItem(DRAFT_KEY)).toBeNull());
  });

  it('retires the intake draft when registering as a new client', async () => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ data: {}, savedAt: new Date().toISOString() }));
    render(
      <MemoryRouter>
        <IntakeReviewPage />
      </MemoryRouter>
    );
    fireEvent.click(screen.getByRole('button', { name: /register as new client/i }));
    await waitFor(() => expect(localStorage.getItem(DRAFT_KEY)).toBeNull());
  });

  it('dismisses a card via "Not this person" and restores it with Undo', async () => {
    render(
      <>
        <MemoryRouter>
          <IntakeReviewPage />
        </MemoryRouter>
        <Toaster position="bottom-right" />
      </>
    );

    expect(screen.getAllByText(/Is this/i)).toHaveLength(2);
    fireEvent.click(screen.getAllByRole('button', { name: /not this person/i })[0]);
    expect(screen.getAllByText(/Is this/i)).toHaveLength(1);

    await waitFor(() => expect(screen.getByRole('button', { name: /undo/i })).toBeDefined());
    fireEvent.click(screen.getByRole('button', { name: /undo/i }));
    await waitFor(() => expect(screen.getAllByText(/Is this/i)).toHaveLength(2));
  });

  it('shows the continue-as-new state after the last card is dismissed', async () => {
    render(
      <>
        <MemoryRouter>
          <IntakeReviewPage />
        </MemoryRouter>
        <Toaster position="bottom-right" />
      </>
    );

    const dismissButtons = screen.getAllByRole('button', { name: /not this person/i });
    fireEvent.click(dismissButtons[0]);
    fireEvent.click(screen.getAllByRole('button', { name: /not this person/i })[0]);

    expect(screen.getByText(/No possible matches left to review/i)).toBeDefined();
    expect(screen.getByRole('button', { name: /Continue as new client/i })).toBeDefined();
    expect(screen.queryByText(/none of these match/i)).toBeNull();
  });

  it('labels a candidate matched as a household member', async () => {
    render(
      <MemoryRouter>
        <IntakeReviewPage />
      </MemoryRouter>
    );
    expect(screen.getByText(/Household member · Child/i)).toBeDefined();
  });

  it('reveals why a candidate was flagged', async () => {
    render(
      <MemoryRouter>
        <IntakeReviewPage />
      </MemoryRouter>
    );
    expect(screen.getByText(/Why this was flagged/i)).toBeDefined();
    expect(screen.getByText(/Phone match/i)).toBeDefined();
    expect(screen.getByText(/Both names/i)).toBeDefined();
  });
});

describe('IntakeReviewPage — member-match case semantics', () => {
  it('offers "create case" and the member note even when the household has a recent case', async () => {
    mockLocationState = {
      candidates: [
        {
          householdId: 'hh-member', score: 0.9, matchedOn: ['both_names'], caseExistsWithin30Days: false,
          primaryBeneficiary: { id: 'ben-pablo', surname: 'Querubin', firstName: 'Pablo', gender: 'Male', age: 48, occupation: 'Farmer', estimatedMonthlyIncome: 8000, civilStatus: 'Married', currentAddress: { barangay: 'Partida' } },
          matchedPerson: { id: 'person-liza', role: 'member', relationship: 'Child', surname: 'Querubin', firstName: 'Liza', gender: 'Female', age: 11, dob: '2015-03-30', occupation: 'Student', estimatedMonthlyIncome: 0, civilStatus: 'Single', currentAddress: { barangay: 'Partida' } },
          allBeneficiaries: [{ id: 'ben-pablo', surname: 'Querubin', firstName: 'Pablo' }],
          familyMembers: [],
          pastCases: [{ controlNo: 'KAPWA-2026-00026', beneficiaryName: 'Pablo Querubin', status: 'active', createdAt: '2026-09-20T00:00:00Z' }],
          lastApprovedCaseDate: '2026-09-20T00:00:00.000Z',
        },
      ],
      intakeData: { beneficiary: { surname: 'Querubin', firstName: 'Liza' }, claimant: {}, familyMembers: [], case: {} },
    };
    render(
      <MemoryRouter>
        <IntakeReviewPage />
      </MemoryRouter>
    );

    expect(screen.getAllByRole('button', { name: /Yes, update info & create case/i }).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Matched as a household member — a new case will be opened/i)).toBeDefined();
  });
});

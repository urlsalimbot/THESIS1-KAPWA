import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { IntakeReviewPage } from './IntakeReviewPage';
import { axe } from 'vitest-axe';

const mockNavigate = vi.fn();

let mockLocationState: any = {
  candidates: [
    {
      householdId: 'hh-1',
      score: 0.92,
      caseExistsWithin30Days: false,
      primaryBeneficiary: {
        id: 'ben-1', surname: 'Dela Cruz', firstName: 'Juan',
        gender: 'Male', age: 40, phone: '09171234567',
        occupation: 'Farmer', estimatedMonthlyIncome: 8500,
        civilStatus: 'Married', currentAddress: { barangay: 'Bigte', street: '123 Purok 1' },
        philhealthNumber: '123456789', category: 'Family',
      },
      allBeneficiaries: [{ id: 'ben-1', surname: 'Dela Cruz', firstName: 'Juan' }],
      familyMembers: [
        { id: 'fm-1', fullName: 'Maria Dela Cruz', relationship: 'Spouse', age: 35, occupation: 'Housewife', income: 0, status: 'Unemployed' },
      ],
      lastApprovedCaseDate: '2025-01-20T00:00:00.000Z',
    },
    {
      householdId: 'hh-2',
      score: 0.65,
      caseExistsWithin30Days: true,
      primaryBeneficiary: {
        id: 'ben-2', surname: 'Cruz', firstName: 'Rosa',
        gender: 'Female', age: 38, phone: '09171234599',
        occupation: 'Vendor', estimatedMonthlyIncome: 5000,
        civilStatus: 'Married', currentAddress: null,
        philhealthNumber: undefined, category: undefined,
      },
      allBeneficiaries: [{ id: 'ben-2', surname: 'Cruz', firstName: 'Rosa' }],
      familyMembers: [],
      lastApprovedCaseDate: new Date().toISOString(),
    },
  ],
  intakeData: {
    beneficiary: { surname: 'Dela Cruz', firstName: 'Juan', age: 40, currentAddress: { barangay: 'Bigte' }, gender: 'Male', estimatedMonthlyIncome: 8500, occupation: 'Farmer', cellularNumber: '09171234567' },
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

describe('IntakeReviewPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLocationState = {
      candidates: [
        {
          householdId: 'hh-1',
          score: 0.92,
          caseExistsWithin30Days: false,
          primaryBeneficiary: {
            id: 'ben-1', surname: 'Dela Cruz', firstName: 'Juan',
            gender: 'Male', age: 40, phone: '09171234567',
            occupation: 'Farmer', estimatedMonthlyIncome: 8500,
            civilStatus: 'Married', currentAddress: { barangay: 'Bigte', street: '123 Purok 1' },
            philhealthNumber: '123456789', category: 'Family',
          },
          allBeneficiaries: [{ id: 'ben-1', surname: 'Dela Cruz', firstName: 'Juan' }],
          familyMembers: [
            { id: 'fm-1', fullName: 'Maria Dela Cruz', relationship: 'Spouse', age: 35, occupation: 'Housewife', income: 0, status: 'Unemployed' },
          ],
          lastApprovedCaseDate: '2025-01-20T00:00:00.000Z',
        },
        {
          householdId: 'hh-2',
          score: 0.65,
          caseExistsWithin30Days: true,
          primaryBeneficiary: {
            id: 'ben-2', surname: 'Cruz', firstName: 'Rosa',
            gender: 'Female', age: 38, phone: '09171234599',
            occupation: 'Vendor', estimatedMonthlyIncome: 5000,
            civilStatus: 'Married', currentAddress: null,
            philhealthNumber: undefined, category: undefined,
          },
          allBeneficiaries: [{ id: 'ben-2', surname: 'Cruz', firstName: 'Rosa' }],
          familyMembers: [],
          lastApprovedCaseDate: new Date().toISOString(),
        },
      ],
      intakeData: {
        beneficiary: { surname: 'Dela Cruz', firstName: 'Juan', age: 40, currentAddress: { barangay: 'Bigte' }, gender: 'Male', estimatedMonthlyIncome: 8500, occupation: 'Farmer', cellularNumber: '09171234567' },
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

  it('should show "No, different person" buttons per card', async () => {
    render(
      <MemoryRouter>
        <IntakeReviewPage />
      </MemoryRouter>
    );
    const rejectBtns = screen.getAllByRole('button', { name: /different person/i });
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
});

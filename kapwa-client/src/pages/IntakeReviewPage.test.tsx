import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { IntakeReviewPage } from './IntakeReviewPage';
import { axe } from 'vitest-axe';

const mockNavigate = vi.fn();

let mockLocationState: any = {
  candidates: [
    {
      householdId: 'hh-1',
      score: 0.92,
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
  ],
  intakeData: {
    beneficiary: { surname: 'Dela Cruz', firstName: 'Juan', currentAddress: { barangay: 'Bigte' } },
    familyMembers: [{ fullName: 'Maria Dela Cruz', relationship: 'Spouse' }],
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
  api: { post: vi.fn().mockResolvedValue({ caseId: 'case-1', controlNo: 'CTRL-001' }) },
}));

describe('IntakeReviewPage', () => {
  beforeEach(() => {
    mockLocationState = {
      candidates: [
        {
          householdId: 'hh-1',
          score: 0.92,
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
      ],
      intakeData: {
        beneficiary: { surname: 'Dela Cruz', firstName: 'Juan', currentAddress: { barangay: 'Bigte' } },
        familyMembers: [{ fullName: 'Maria Dela Cruz', relationship: 'Spouse' }],
      },
    };
  });

  it('should render match candidate cards', async () => {
    render(
      <MemoryRouter>
        <IntakeReviewPage />
      </MemoryRouter>
    );
    expect(screen.getByText(/Match #1/i)).toBeDefined();
    expect(screen.getAllByText(/Dela Cruz, Juan/i).length).toBeGreaterThan(0);
  });

  it('should show 92% score bar', async () => {
    render(
      <MemoryRouter>
        <IntakeReviewPage />
      </MemoryRouter>
    );
    expect(screen.getByText('92%')).toBeDefined();
  });

  it('should show current intake summary', async () => {
    render(
      <MemoryRouter>
        <IntakeReviewPage />
      </MemoryRouter>
    );
    expect(screen.getByText(/Current Intake/i)).toBeDefined();
  });

  it('should have expand/collapse on match cards', async () => {
    render(
      <MemoryRouter>
        <IntakeReviewPage />
      </MemoryRouter>
    );
    const showMore = screen.getByText(/Show More/i);
    fireEvent.click(showMore);
    expect(screen.getByText(/Show Less/i)).toBeDefined();
    expect(screen.getByText(/PhilHealth/i)).toBeDefined();
  });

  it('should show Create New Client button', async () => {
    render(
      <MemoryRouter>
        <IntakeReviewPage />
      </MemoryRouter>
    );
    expect(screen.getByText('Create New Client')).toBeDefined();
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

  it('should show empty state when no candidates', async () => {
    mockLocationState = { candidates: [], intakeData: {} };

    render(
      <MemoryRouter>
        <IntakeReviewPage />
      </MemoryRouter>
    );
    expect(screen.getByText(/No prior records found/i)).toBeDefined();
  });
});

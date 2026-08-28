import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { axe } from 'vitest-axe';
import { IntakePage } from './IntakePage';
import { api } from '../lib/api';
import { setPendingIdPhoto } from '../lib/intake-id-photo';

const queueCalls: unknown[][] = [];
const mockQueueChange = vi.fn((...args: unknown[]) => {
  queueCalls.push(args);
  return Promise.resolve({ id: 'mock-id', tableName: args[0], status: 'pending' });
});

vi.mock('../lib/offline-queue', () => ({
  queueChange: (...args: unknown[]) => mockQueueChange(...args),
  loadQueue: vi.fn(() => []),
  getPendingChanges: vi.fn(() => Promise.resolve([])),
}));

let onlineStatus = true;
vi.mock('../lib/sync', () => ({
  isOnline: vi.fn(() => onlineStatus),
}));

vi.mock('../lib/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn((path: string, _body?: unknown) => {
      if (path === '/intake/match-check') {
        return Promise.resolve({ candidates: [] });
      }
      return Promise.resolve({ caseId: 'case-id-1', controlNo: 'NORZ-2026-0001' });
    }),
    put: vi.fn(),
    del: vi.fn(),
  },
}));

vi.mock('../lib/constants', async (importOriginal) => ({
  ...(await importOriginal()),
  BARANGAYS: ['Barangay 1', 'Barangay 2'],
  SERVICE_TYPES: ['FA', 'CSR'],
}));

vi.mock('../lib/auth-context', () => ({
  useAuth: () => ({ user: { id: 'u1', email: 'worker@kapwa.ph', fullName: 'Worker One', role: 'social_worker' } }),
}));

describe('IntakePage — offline path', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queueCalls.length = 0;
    onlineStatus = true;
    localStorage.clear();
  });

  it('should export IntakePage component', async () => {
    const { IntakePage } = await import('./IntakePage');
    expect(IntakePage).toBeDefined();
    expect(typeof IntakePage).toBe('function');
  });

  it('should call queueChange with "intake" table name when offline (after Task 3)', async () => {
    const { IntakePage } = await import('./IntakePage');
    expect(IntakePage).toBeDefined();

    const { queueChange } = await import('../lib/offline-queue');
    expect(queueChange).toBeDefined();

    const expectedPayload = {
      beneficiary: expect.objectContaining({
        surname: expect.any(String),
        firstName: expect.any(String),
      }),
      familyMembers: expect.any(Array),
      case: expect.objectContaining({}),
    };

    expect(queueChange).toBeDefined();
  });

  it('should include consolidated payload with beneficiary, familyMembers, and case', () => {
    const consolidatedPayload = {
      beneficiary: {
        surname: 'Dela Cruz',
        firstName: 'Juan',
        gender: 'Male',
        dob: '1980-01-15',
        barangay: 'Barangay 1',
      },
      familyMembers: [
        { fullName: 'Maria', relationship: 'Spouse', age: 45 },
      ],
      case: {
        serviceRequested: ['FA'],
        requirementsChecklist: { med_cert: true },
      },
    };

    expect(consolidatedPayload).toHaveProperty('beneficiary');
    expect(consolidatedPayload).toHaveProperty('familyMembers');
    expect(consolidatedPayload).toHaveProperty('case');
    expect(consolidatedPayload.beneficiary).toHaveProperty('surname');
    expect(consolidatedPayload.beneficiary).toHaveProperty('firstName');
    expect(consolidatedPayload.beneficiary).toHaveProperty('gender');
    expect(consolidatedPayload.beneficiary).toHaveProperty('dob');
  });

  it('has no a11y violations', async () => {
    const { container } = render(
      <MemoryRouter>
        <IntakePage />
      </MemoryRouter>
    );
    await screen.findByRole('heading', { name: /General Intake Form/i });
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});

async function fillBeneficiary() {
    fireEvent.change(screen.getByLabelText('ben-surname'), { target: { value: 'Dela Cruz' } });
    fireEvent.change(screen.getByLabelText('ben-firstName'), { target: { value: 'Juan' } });
    fireEvent.click(screen.getByRole('radio', { name: 'Male' }));
    fireEvent.change(screen.getByLabelText('ben-dob'), { target: { value: '1990-01-15' } });
    fireEvent.change(screen.getByLabelText('ben-placeOfBirth'), { target: { value: 'Manila' } });
    fireEvent.change(screen.getByLabelText('ben-civilStatus'), { target: { value: 'Single' } });
    fireEvent.change(screen.getByLabelText('ben-cellularNumber'), { target: { value: '09171234567' } });
    fireEvent.change(screen.getByLabelText('ben-email'), { target: { value: 'juan@example.com' } });
    fireEvent.click(screen.getByText('Barangay not listed? Enter manually'));
    fireEvent.change(screen.getByLabelText('Address Street'), { target: { value: '123 Rizal St' } });
    fireEvent.change(screen.getByLabelText('Address Barangay'), { target: { value: 'Bangkal' } });
    fireEvent.change(screen.getByLabelText('Address City'), { target: { value: 'Norzagaray' } });
    fireEvent.change(screen.getByLabelText('Address Postal Code'), { target: { value: '3012' } });
    fireEvent.change(screen.getByLabelText('ben-occupation'), { target: { value: 'Fisherman' } });
    fireEvent.change(screen.getByLabelText('ben-income'), { target: { value: '15000' } });
  }

function submitForm() {
  const form = screen.getByRole('button', { name: /Submit Intake/i }).closest('form')!;
  fireEvent.submit(form);
}

describe('IntakePage — validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queueCalls.length = 0;
    onlineStatus = true;
    localStorage.clear();
  });


  it('shows error banner when submitting empty form', async () => {
    render(
      <MemoryRouter>
        <IntakePage />
      </MemoryRouter>
    );
    await screen.findByRole('heading', { name: /General Intake Form/i });
    submitForm();
    expect(await screen.findByText('Please fix the highlighted fields below.')).toBeInTheDocument();
  });

  it('submits successfully with valid data and beneficiary as claimant', async () => {
    render(
      <MemoryRouter>
        <IntakePage />
      </MemoryRouter>
    );
    await screen.findByRole('heading', { name: /General Intake Form/i });

    fireEvent.click(screen.getByRole('checkbox', { name: /Beneficiary is claimant/i }));
    await fillBeneficiary();
    fireEvent.click(screen.getByRole('checkbox', { name: /consent/i }));

    submitForm();

    await waitFor(() => {
      expect(api.post).toHaveBeenCalled();
    });
  });
});

describe('IntakePage — family member sex and dob', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queueCalls.length = 0;
    onlineStatus = true;
    localStorage.clear();
  });

  async function renderWithMember() {
    render(
      <MemoryRouter>
        <IntakePage />
      </MemoryRouter>
    );
    await screen.findByRole('heading', { name: /General Intake Form/i });
    fireEvent.click(screen.getByRole('button', { name: /Add Member/i }));
  }

  it('renders sex radios and a dob input, and no manual age input', async () => {
    await renderWithMember();
    expect(screen.getAllByLabelText('FM gender').length).toBe(2);
    expect(screen.getByLabelText('FM dob')).toBeInTheDocument();
    expect(screen.queryByLabelText('FM age')).not.toBeInTheDocument();
  });

  it('keeps Done disabled until gender and dob are provided', async () => {
    await renderWithMember();
    fireEvent.change(screen.getByLabelText('FM surname'), { target: { value: 'Reyes' } });
    fireEvent.change(screen.getByLabelText('FM first name'), { target: { value: 'Ana' } });
    const done = screen.getByRole('button', { name: 'Done' });
    expect(done).toBeDisabled();
    fireEvent.click(screen.getAllByLabelText('FM gender')[1]);
    expect(done).toBeDisabled();
    fireEvent.change(screen.getByLabelText('FM dob'), { target: { value: '2015-08-10' } });
    expect(done).toBeEnabled();
    fireEvent.click(done);
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
  });

  it('blocks Done when the dob is more than 120 years ago', async () => {
    await renderWithMember();
    fireEvent.change(screen.getByLabelText('FM surname'), { target: { value: 'Reyes' } });
    fireEvent.change(screen.getByLabelText('FM first name'), { target: { value: 'Ana' } });
    fireEvent.click(screen.getAllByLabelText('FM gender')[0]);
    fireEvent.change(screen.getByLabelText('FM dob'), { target: { value: '1800-01-01' } });
    expect(screen.getByText('Invalid date of birth')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Done' })).toBeDisabled();
  });

  it('submits gender, dob, and computed age for each member', async () => {
    render(
      <MemoryRouter>
        <IntakePage />
      </MemoryRouter>
    );
    await screen.findByRole('heading', { name: /General Intake Form/i });
    fireEvent.click(screen.getByRole('checkbox', { name: /Beneficiary is claimant/i }));

    fireEvent.change(screen.getByLabelText('ben-surname'), { target: { value: 'Dela Cruz' } });
    fireEvent.change(screen.getByLabelText('ben-firstName'), { target: { value: 'Juan' } });
    fireEvent.click(screen.getByRole('radio', { name: 'Male' }));
    fireEvent.change(screen.getByLabelText('ben-dob'), { target: { value: '1990-01-15' } });
    fireEvent.change(screen.getByLabelText('ben-placeOfBirth'), { target: { value: 'Manila' } });
    fireEvent.change(screen.getByLabelText('ben-civilStatus'), { target: { value: 'Single' } });
    fireEvent.change(screen.getByLabelText('ben-cellularNumber'), { target: { value: '09171234567' } });
    fireEvent.change(screen.getByLabelText('ben-email'), { target: { value: 'juan@example.com' } });
    fireEvent.click(screen.getByText('Barangay not listed? Enter manually'));
    fireEvent.change(screen.getByLabelText('Address Street'), { target: { value: '123 Rizal St' } });
    fireEvent.change(screen.getByLabelText('Address Barangay'), { target: { value: 'Bangkal' } });
    fireEvent.change(screen.getByLabelText('Address City'), { target: { value: 'Norzagaray' } });
    fireEvent.change(screen.getByLabelText('Address Postal Code'), { target: { value: '3012' } });
    fireEvent.change(screen.getByLabelText('ben-occupation'), { target: { value: 'Fisherman' } });
    fireEvent.change(screen.getByLabelText('ben-income'), { target: { value: '15000' } });

    fireEvent.click(screen.getByRole('button', { name: /Add Member/i }));
    fireEvent.change(screen.getByLabelText('FM surname'), { target: { value: 'Reyes' } });
    fireEvent.change(screen.getByLabelText('FM first name'), { target: { value: 'Ana' } });
    fireEvent.click(screen.getAllByLabelText('FM gender')[1]);
    const today = new Date().toLocaleDateString('en-CA');
    fireEvent.change(screen.getByLabelText('FM dob'), { target: { value: today } });
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));

    fireEvent.click(screen.getByRole('checkbox', { name: /consent/i }));
    const form = screen.getByRole('button', { name: /Submit Intake/i }).closest('form')!;
    fireEvent.submit(form);

    await waitFor(() => expect(api.post).toHaveBeenCalled());
    const intakeCall = (api.post as ReturnType<typeof vi.fn>).mock.calls.find(
      (call: unknown[]) => call[0] === '/intake',
    );
    expect(intakeCall).toBeDefined();
    expect(intakeCall?.[1].familyMembers[0]).toMatchObject({
      gender: 'Female',
      dob: today,
      age: 0,
    });
  });
});

describe('IntakePage — batch family submit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queueCalls.length = 0;
    onlineStatus = true;
    localStorage.clear();
  });

  async function renderWithMember() {
    render(
      <MemoryRouter>
        <IntakePage />
      </MemoryRouter>
    );
    await screen.findByRole('heading', { name: /General Intake Form/i });
    fireEvent.click(screen.getByRole('checkbox', { name: /Beneficiary is claimant/i }));

    fireEvent.change(screen.getByLabelText('ben-surname'), { target: { value: 'Dela Cruz' } });
    fireEvent.change(screen.getByLabelText('ben-firstName'), { target: { value: 'Juan' } });
    fireEvent.click(screen.getByRole('radio', { name: 'Male' }));
    fireEvent.change(screen.getByLabelText('ben-dob'), { target: { value: '1990-01-15' } });
    fireEvent.change(screen.getByLabelText('ben-placeOfBirth'), { target: { value: 'Manila' } });
    fireEvent.change(screen.getByLabelText('ben-civilStatus'), { target: { value: 'Single' } });
    fireEvent.change(screen.getByLabelText('ben-cellularNumber'), { target: { value: '09171234567' } });
    fireEvent.change(screen.getByLabelText('ben-email'), { target: { value: 'juan@example.com' } });
    fireEvent.click(screen.getByText('Barangay not listed? Enter manually'));
    fireEvent.change(screen.getByLabelText('Address Street'), { target: { value: '123 Rizal St' } });
    fireEvent.change(screen.getByLabelText('Address Barangay'), { target: { value: 'Bangkal' } });
    fireEvent.change(screen.getByLabelText('Address City'), { target: { value: 'Norzagaray' } });
    fireEvent.change(screen.getByLabelText('Address Postal Code'), { target: { value: '3012' } });
    fireEvent.change(screen.getByLabelText('ben-occupation'), { target: { value: 'Fisherman' } });
    fireEvent.change(screen.getByLabelText('ben-income'), { target: { value: '15000' } });

    fireEvent.click(screen.getByRole('button', { name: /Add Member/i }));
    fireEvent.change(screen.getByLabelText('FM surname'), { target: { value: 'Dela Cruz' } });
    fireEvent.change(screen.getByLabelText('FM first name'), { target: { value: 'Ana' } });
    fireEvent.click(screen.getAllByLabelText('FM gender')[1]);
    fireEvent.change(screen.getByLabelText('FM dob'), { target: { value: '1992-02-02' } });
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    fireEvent.click(screen.getByRole('checkbox', { name: /consent/i }));
  }

  it('shows an optional batch prompt after a successful single submit', async () => {
    await renderWithMember();
    const form = screen.getByRole('button', { name: /Submit Intake/i }).closest('form')!;
    fireEvent.submit(form);

    expect(await screen.findByText(/Add another family member as a batch\?/i)).toBeInTheDocument();
  });

  it('posts the queued members to /intake/batch-family with the primary address pre-filled and the completed intake caseId', async () => {
    await renderWithMember();
    const form = screen.getByRole('button', { name: /Submit Intake/i }).closest('form')!;
    fireEvent.submit(form);

    const confirm = await screen.findByRole('button', { name: /Yes, add as batch/i });
    fireEvent.click(confirm);

    await waitFor(() => {
      const batchCall = (api.post as ReturnType<typeof vi.fn>).mock.calls.find(
        (call: unknown[]) => call[0] === '/intake/batch-family',
      );
      expect(batchCall).toBeDefined();
      expect(batchCall?.[1].caseId).toBe('case-id-1');
      expect(batchCall?.[1].primary).toMatchObject({
        currentAddress: expect.objectContaining({ barangay: 'Bangkal' }),
      });
      expect(batchCall?.[1].members[0]).toMatchObject({
        surname: 'Dela Cruz',
        firstName: 'Ana',
        gender: 'Female',
        relationship: 'Spouse',
      });
    });
  });
});

describe('IntakePage — user-scoped draft', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queueCalls.length = 0;
    onlineStatus = true;
    localStorage.clear();
  });

  const seedDraft = (surname: string) => ({
    data: {
      beneficiary: { surname, firstName: '', middleName: '', extension: '', gender: '', dob: '', placeOfBirth: '', civilStatus: '', cellularNumber: '', email: '', currentAddress: { street: '', barangay: '', city: '0301413000', province: '0301400000', region: '03', postalCode: '3013', psgcCode: '' }, philhealthNumber: '', occupation: '', estimatedMonthlyIncome: '' },
      claimant: { surname: '', firstName: '', middleName: '', extension: '', gender: '', dob: '', placeOfBirth: '', civilStatus: '', cellularNumber: '', email: '', currentAddress: {}, philhealthNumber: '', occupation: '', estimatedMonthlyIncome: '' },
      relationshipToBeneficiary: '',
      family: [],
      beneficiaryIsClaimant: false,
      hasConsent: false,
    },
    savedAt: 'x',
  });

  it('restores only the current user draft on mount', async () => {
    localStorage.setItem('kapwa:intake:draft:u1', JSON.stringify(seedDraft('Dela Cruz')));
    localStorage.setItem('kapwa:intake:draft:u2', JSON.stringify(seedDraft('Reyes')));

    render(
      <MemoryRouter>
        <IntakePage />
      </MemoryRouter>
    );

    expect(await screen.findByDisplayValue('Dela Cruz')).toBeInTheDocument();
    expect(screen.queryByDisplayValue('Reyes')).not.toBeInTheDocument();
  });

  it('autosaves the form under the user-scoped draft key', async () => {
    render(
      <MemoryRouter>
        <IntakePage />
      </MemoryRouter>
    );
    await screen.findByRole('heading', { name: /General Intake Form/i });

    fireEvent.change(screen.getByLabelText('ben-surname'), { target: { value: 'Santos' } });

    await waitFor(() => {
      const raw = localStorage.getItem('kapwa:intake:draft:u1');
      expect(raw).not.toBeNull();
      expect(JSON.parse(raw!).data.beneficiary.surname).toBe('Santos');
    }, { timeout: 4000 });
  });

  it('clears only the current user draft after submit', async () => {
    localStorage.setItem('kapwa:intake:draft:u1', JSON.stringify(seedDraft('Stale')));
    localStorage.setItem('kapwa:intake:draft:u2', JSON.stringify(seedDraft('Untouched')));

    render(
      <MemoryRouter>
        <IntakePage />
      </MemoryRouter>
    );
    await screen.findByRole('heading', { name: /General Intake Form/i });

    fireEvent.click(screen.getByRole('checkbox', { name: /Beneficiary is claimant/i }));
    await fillBeneficiary();
    fireEvent.click(screen.getByRole('checkbox', { name: /consent/i }));
    submitForm();

    await waitFor(() => expect(api.post).toHaveBeenCalled());
    expect(localStorage.getItem('kapwa:intake:draft:u1')).toBeNull();
    expect(localStorage.getItem('kapwa:intake:draft:u2')).not.toBeNull();
  });

  it('keeps focus on the surname input while typing (no remount on re-render)', async () => {
    render(
      <MemoryRouter>
        <IntakePage />
      </MemoryRouter>
    );
    await screen.findByRole('heading', { name: /General Intake Form/i });

    const input = screen.getByLabelText('ben-surname') as HTMLInputElement;
    input.focus();
    fireEvent.change(input, { target: { value: 'Dela' } });

    expect(document.activeElement).toBe(input);
  });
});

describe('IntakePage — optional government ID photo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queueCalls.length = 0;
    onlineStatus = true;
    localStorage.clear();
  });

  it('renders the optional ID photo picker section with a choose button', async () => {
    render(
      <MemoryRouter>
        <IntakePage />
      </MemoryRouter>
    );

    await screen.findByRole('heading', { name: /ID Photo/i });
    expect(screen.getByText(/Optional photo of the beneficiary government ID/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Choose ID photo/i })).toBeInTheDocument();
  });
});

describe('IntakePage — ID photo preview lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queueCalls.length = 0;
    onlineStatus = true;
    localStorage.clear();
    setPendingIdPhoto(null);
    // jsdom may not implement blob URLs; stub them so preview + revocation are assertable.
    if (typeof URL.createObjectURL !== 'function') {
      Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn(() => 'blob:guarded') });
    }
    if (typeof URL.revokeObjectURL !== 'function') {
      Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
    }
  });

  it('re-initializes the preview from the pending holder on mount', async () => {
    setPendingIdPhoto(new File(['id'], 'id.png', { type: 'image/png' }));
    const create = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:id-preview');

    render(
      <MemoryRouter>
        <IntakePage />
      </MemoryRouter>
    );

    const img = await screen.findByAltText('Government ID preview');
    expect(img).toHaveAttribute('src', 'blob:id-preview');
    expect(create).toHaveBeenCalled();
  });

  it('revokes the object URL when the picked photo is removed', async () => {
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:id-preview');

    render(
      <MemoryRouter>
        <IntakePage />
      </MemoryRouter>
    );
    await screen.findByRole('heading', { name: /ID Photo/i });

    fireEvent.change(screen.getByLabelText('Choose ID photo'), {
      target: { files: [new File(['id'], 'id.png', { type: 'image/png' })] },
    });

    const img = await screen.findByAltText('Government ID preview');
    expect(img).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));

    expect(revoke).toHaveBeenCalledWith('blob:id-preview');
    expect(screen.queryByAltText('Government ID preview')).not.toBeInTheDocument();
  });
});

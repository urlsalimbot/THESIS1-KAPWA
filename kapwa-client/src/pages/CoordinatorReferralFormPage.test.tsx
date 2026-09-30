import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { CoordinatorReferralFormPage } from './CoordinatorReferralFormPage';

const { mockApiPost, mockNavigate, mockToast, mockUseAuth } = vi.hoisted(() => ({
  mockApiPost: vi.fn(),
  mockNavigate: vi.fn(),
  mockToast: vi.fn(),
  mockUseAuth: vi.fn(),
}));

vi.mock('@/lib/api', () => ({
  api: {
    post: (...args: unknown[]) => mockApiPost(...args),
  },
}));

vi.mock('@/lib/auth-context', () => ({
  // Defaults to a signed-out user so tests that do not care about the
  // coordinator's assignment still render; individual cases override it.
  useAuth: () => mockUseAuth() ?? { user: null },
}));

vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-router-dom')>()),
  useNavigate: () => mockNavigate,
}));

vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => mockToast('success', ...args),
    error: (...args: unknown[]) => mockToast('error', ...args),
  },
}));

function renderPage() {
  return render(
    <MemoryRouter>
      <CoordinatorReferralFormPage />
    </MemoryRouter>,
  );
}

/**
 * The form's field labels used to be keyed `coordinator.surname`,
 * `coordinator.firstName`, … whose `en` values were the raw camelCase field
 * names ("surname", "dob", "phone"). Because the keys existed, `t(key, fallback)`
 * returned those field names and the human fallbacks never rendered, so the
 * coordinator saw "surname" / "firstName" / "dob" above the inputs.
 *
 * These assertions pin the visible label text, so a regression to the field
 * names — or a silently dropped i18n key, which falls back to the code default —
 * fails here.
 */
describe('CoordinatorReferralFormPage labels', () => {
  beforeEach(() => {
    mockApiPost.mockReset();
    mockNavigate.mockReset();
    mockToast.mockReset();
  });

  it('labels every name field in words, not camelCase field names', () => {
    renderPage();
    expect(screen.getByText('Surname *')).toBeTruthy();
    expect(screen.getByText('First Name *')).toBeTruthy();
    expect(screen.getByText('Middle Name')).toBeTruthy();
    expect(screen.getByText('Extension')).toBeTruthy();
  });

  it('never renders a raw camelCase field name as a label', () => {
    const { container } = renderPage();
    const text = container.textContent ?? '';
    for (const raw of ['surname', 'firstName', 'middleName', 'extension', 'dob', 'phone', 'street']) {
      expect(text).not.toContain(raw);
    }
  });

  it('labels the sex, date, phone and address fields in words', () => {
    renderPage();
    expect(screen.getByText('Sex *')).toBeTruthy();
    expect(screen.getByText('Date of Birth *')).toBeTruthy();
    expect(screen.getByText('Phone')).toBeTruthy();
    expect(screen.getByText('Street / Purok')).toBeTruthy();
    expect(screen.getByText('Barangay')).toBeTruthy();
    expect(screen.getByText('Reason for Referral *')).toBeTruthy();
  });

  it('shows a visible error banner when submitting an incomplete form (no silent block)', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Submit Referral' }));
    expect(screen.getByText('Please fill in all required fields')).toBeTruthy();
    expect(mockApiPost).not.toHaveBeenCalled();
  });

  /**
   * Every label was a bare <span>, so it was not programmatically associated
   * with its control; the fields carried a separate, raw aria-label instead.
   * A <label for> is the association, so assert it directly.
   */
  it('associates each label with its control via htmlFor/id', () => {
    const { container } = renderPage();
    const expected: Array<[string, string]> = [
      ['Surname *', 'crf-surname'],
      ['First Name *', 'crf-firstName'],
      ['Middle Name', 'crf-middleName'],
      ['Extension', 'crf-extension'],
      ['Date of Birth *', 'crf-dob'],
      ['Phone', 'crf-phone'],
      ['Street / Purok', 'crf-street'],
      ['Barangay', 'crf-barangay'],
      ['Reason for Referral *', 'crf-reason'],
    ];
    for (const [labelText, id] of expected) {
      const label = screen.getByText(labelText);
      expect(label.getAttribute('for')).toBe(id);
      const control = container.querySelector(`#${id}`);
      expect(control, `no control with id ${id}`).toBeTruthy();
    }
  });

  it('groups the sex radios under their label', () => {
    renderPage();
    const legend = screen.getByText('Sex *');
    expect(legend.tagName).toBe('LEGEND');
    expect(screen.getByLabelText('Male')).toBeTruthy();
    expect(screen.getByLabelText('Female')).toBeTruthy();
  });

  it('drops the duplicated raw aria-labels now that labels are associated', () => {
    const { container } = renderPage();
    const withRaw = [...container.querySelectorAll('[aria-label]')].map(
      (el) => el.getAttribute('aria-label') ?? '',
    );
    for (const raw of ['surname', 'firstName', 'middleName', 'extension', 'dob', 'phone', 'street']) {
      expect(withRaw).not.toContain(raw);
    }
  });
});

/**
 * The extension dropdown hard-coded three suffixes and rendered "N/A" twice —
 * once as the placeholder and once as an empty-valued item — while the canonical
 * NAME_EXTENSIONS list carries five (Jr., Sr., II, III, IV). A resident named
 * "Santos II" could not be recorded.
 */
describe('CoordinatorReferralFormPage extension options', () => {
  beforeEach(() => {
    mockApiPost.mockReset();
    mockNavigate.mockReset();
    mockToast.mockReset();
  });

  async function openExtension() {
    renderPage();
    fireEvent.click(screen.getByText('Extension'));
    // Radix renders the list in a portal; wait for it to mount.
    return waitFor(() => {
      expect(screen.getByRole('listbox')).toBeTruthy();
    });
  }

  it('offers all five suffixes from the canonical list', async () => {
    await openExtension();
    const options = screen.getAllByRole('option').map((o) => o.textContent?.trim());
    expect(options).toEqual(['Jr.', 'Sr.', 'II', 'III', 'IV']);
  });

  it('does not duplicate N/A as both placeholder and option', async () => {
    await openExtension();
    const options = screen.getAllByRole('option').map((o) => o.textContent?.trim());
    expect(options).not.toContain('N/A');
    // The placeholder still communicates the empty selection.
    expect(screen.getByText('N/A')).toBeTruthy();
  });

  it('submits the chosen extension', async () => {
    mockApiPost.mockResolvedValue({ id: 'r1' });
    await openExtension();
    fireEvent.click(screen.getByRole('option', { name: 'II' }));

    fireEvent.change(screen.getByLabelText('Surname *'), { target: { value: 'Santos' } });
    fireEvent.change(screen.getByLabelText('First Name *'), { target: { value: 'Maria' } });
    fireEvent.click(screen.getByLabelText('Female'));
    fireEvent.change(screen.getByLabelText('Date of Birth *'), { target: { value: '1990-01-02' } });
    fireEvent.change(screen.getByLabelText('Barangay'), { target: { value: 'Bigte' } });
    fireEvent.change(screen.getByLabelText('Reason for Referral *'), { target: { value: 'Needs support' } });
    fireEvent.submit(screen.getByRole('button', { name: /submit referral/i }).closest('form')!);

    await waitFor(() => expect(mockApiPost).toHaveBeenCalled());
    const body = mockApiPost.mock.calls[0][1] as Record<string, unknown>;
    expect(body.extension).toBe('II');
  });
});

/**
 * The barangay field used to be free text. Its value becomes the intake's
 * `currentAddress.barangay`, and `IntakeAddressBlock` matches its options by
 * name — so a misspelt or invented barangay prefills as a silently empty
 * select, invisible until a worker opens the case. The options are now the same
 * 13 Norzagaray barangays the intake block offers.
 */
describe('CoordinatorReferralFormPage barangay options', () => {
  const NORZAGARAY_BARANGAYS = [
    'Bangkal', 'Baraka', 'Bigte', 'Bitungol', 'Friendship Village Resources',
    'Matictic', 'Minuyan', 'Partida', 'Pinagtulayan', 'Poblacion',
    'San Lorenzo', 'San Mateo', 'Tigbe',
  ];

  beforeEach(() => {
    mockApiPost.mockReset();
    mockNavigate.mockReset();
    mockToast.mockReset();
    mockUseAuth.mockReset();
    mockUseAuth.mockReturnValue({ user: null });
  });

  it('offers exactly the barangays the intake address block lists for Norzagaray', () => {
    renderPage();

    const options = [...(screen.getByLabelText('Barangay') as HTMLSelectElement).options]
      .map(o => o.value)
      .filter(Boolean);
    expect(options).toEqual(NORZAGARAY_BARANGAYS);
  });

  it('starts on the coordinator’s own barangay but still allows any of the 13', () => {
    // referrals.barangay is derived server-side from assignedBarangay, so this
    // field records the resident's address, not the routing key. A coordinator
    // does get walk-ins from a neighbouring barangay.
    mockUseAuth.mockReturnValue({ user: { id: '1', role: 'coordinator', assignedBarangay: 'Bigte' } });
    renderPage();

    const select = screen.getByLabelText('Barangay') as HTMLSelectElement;
    expect(select.value).toBe('Bigte');

    fireEvent.change(select, { target: { value: 'Tigbe' } });
    expect((screen.getByLabelText('Barangay') as HTMLSelectElement).value).toBe('Tigbe');
  });

  it('falls back to an unselected state when the assignment is not a Norzagaray barangay', () => {
    // Seeding the select with a value it has no option for renders a blank
    // control — legal markup, invisible mistake. Better to start unselected.
    mockUseAuth.mockReturnValue({ user: { id: '1', role: 'coordinator', assignedBarangay: 'San Jose' } });
    renderPage();

    expect((screen.getByLabelText('Barangay') as HTMLSelectElement).value).toBe('');
  });

  it('submits the chosen barangay as a name, matching what the address records store', async () => {
    mockUseAuth.mockReturnValue({ user: { id: '1', role: 'coordinator', assignedBarangay: 'Bigte' } });
    renderPage();

    fireEvent.change(screen.getByLabelText('Surname *'), { target: { value: 'Dela Cruz' } });
    fireEvent.change(screen.getByLabelText('First Name *'), { target: { value: 'Ana' } });
    fireEvent.click(screen.getByLabelText('Female'));
    fireEvent.change(screen.getByLabelText('Date of Birth *'), { target: { value: '2015-03-30' } });
    fireEvent.change(screen.getByLabelText('Barangay'), { target: { value: 'Minuyan' } });
    fireEvent.change(screen.getByLabelText('Reason for Referral *'), { target: { value: 'Medical' } });

    fireEvent.submit(screen.getByRole('button', { name: /Submit Referral/i }).closest('form') as HTMLFormElement);

    await waitFor(() => expect(mockApiPost).toHaveBeenCalled());
    const [path, body] = mockApiPost.mock.calls[0];
    expect(path).toBe('/referrals');
    expect(body.address.barangay).toBe('Minuyan');
  });

  it('stays optional, so a referral without a barangay still submits', async () => {
    // Behaviour preserved: barangay is not in the required set, and the
    // prefilled intake can still be completed there.
    mockUseAuth.mockReturnValue({ user: { id: '1', role: 'coordinator', assignedBarangay: 'Not A Barangay' } });
    renderPage();

    fireEvent.change(screen.getByLabelText('Surname *'), { target: { value: 'Dela Cruz' } });
    fireEvent.change(screen.getByLabelText('First Name *'), { target: { value: 'Ana' } });
    fireEvent.click(screen.getByLabelText('Female'));
    fireEvent.change(screen.getByLabelText('Date of Birth *'), { target: { value: '2015-03-30' } });
    fireEvent.change(screen.getByLabelText('Reason for Referral *'), { target: { value: 'Medical' } });

    fireEvent.submit(screen.getByRole('button', { name: /Submit Referral/i }).closest('form') as HTMLFormElement);

    await waitFor(() => expect(mockApiPost).toHaveBeenCalled());
    const [, body] = mockApiPost.mock.calls[0];
    expect(body.address.barangay).toBe('');
  });
});

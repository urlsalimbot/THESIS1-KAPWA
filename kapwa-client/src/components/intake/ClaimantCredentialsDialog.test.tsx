import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Toaster } from 'sonner';
import { ClaimantCredentialsDialog } from './ClaimantCredentialsDialog';

/**
 * The slip is the only place an office-issued password is ever readable — the
 * database keeps a hash — so what this component shows, and what it refuses to
 * invent, is the whole recovery story for a claimant with no email or mobile.
 */
const ACCOUNT = { username: 'CLM-000123', temporaryPassword: 'ABCD-EFGH' };

describe('ClaimantCredentialsDialog', () => {
  beforeEach(() => {
    // jsdom exposes `clipboard` as a getter-only property, so assigning to it
    // silently does nothing and `toHaveBeenCalledWith` fails on a real function.
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      configurable: true,
      writable: true,
    });
  });

  it('shows the claimant ID and the temporary password', () => {
    render(<ClaimantCredentialsDialog account={ACCOUNT} onDone={() => undefined} />);

    expect(screen.getByText('CLM-000123')).toBeTruthy();
    expect(screen.getByText('ABCD-EFGH')).toBeTruthy();
    // The worker is told why the slip exists and that it cannot be recovered.
    expect(screen.getByText(/shown once|cannot be recovered/i)).toBeTruthy();
  });

  it('prints only the slip', () => {
    // The dialog carries the id the print rule in index.css keys on; without it
    // the rule is inert and a print would include the entire intake form.
    render(<ClaimantCredentialsDialog account={ACCOUNT} onDone={() => undefined} />);
    // Radix renders the dialog in a portal, so it is not inside the container.
    expect(document.getElementById('claimant-slip')).toBeTruthy();
  });

  it('copies both lines, and says so when it cannot', async () => {
    // `userEvent.setup()` installs its own clipboard stub, so the spy goes on
    // whatever is there once it has run.
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);
    // Toasts need somewhere to land; the rest of the suite mounts one too.
    render(
      <>
        <Toaster />
        <ClaimantCredentialsDialog account={ACCOUNT} onDone={() => undefined} />
      </>,
    );

    await user.click(screen.getByRole('button', { name: /copy/i }));
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('CLM-000123'));
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('ABCD-EFGH'));

    writeText.mockRejectedValueOnce(new Error('denied'));
    await user.click(screen.getByRole('button', { name: /copy/i }));
    // The fallback is a toast, not a crash: the worker writes it down by hand.
    expect(await screen.findByText(/write the details down/i)).toBeTruthy();
  });

  it('hands control back only when the worker is done reading it', async () => {
    const user = userEvent.setup();
    const onDone = vi.fn();
    render(<ClaimantCredentialsDialog account={ACCOUNT} onDone={onDone} />);

    expect(onDone).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: /open the case/i }));
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { axe } from 'vitest-axe';
import { TermsPage } from './TermsPage';
import { AccessibilityPage } from './AccessibilityPage';
import { PrivacyPolicyPage } from './PrivacyPolicyPage';

function renderPage(ui: React.ReactNode) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe('public static pages', () => {
  it('TermsPage renders its title and a back-to-home link', () => {
    renderPage(<TermsPage />);
    expect(screen.getByRole('heading', { name: 'Terms of Use' })).toBeTruthy();
    expect(screen.getByRole('link', { name: /Back to home/i })).toBeTruthy();
  });

  it('AccessibilityPage renders its title', () => {
    renderPage(<AccessibilityPage />);
    expect(screen.getByRole('heading', { name: 'Accessibility' })).toBeTruthy();
  });

  it('PrivacyPolicyPage renders its title', () => {
    renderPage(<PrivacyPolicyPage />);
    expect(screen.getByRole('heading', { name: 'Privacy Policy' })).toBeTruthy();
  });

  it('static pages have no a11y violations', async () => {
    const { container } = renderPage(<TermsPage />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
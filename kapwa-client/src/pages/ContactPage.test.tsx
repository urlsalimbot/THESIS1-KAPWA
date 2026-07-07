import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { axe } from 'vitest-axe';
import { ContactPage } from './ContactPage';

describe('ContactPage', () => {
  it('renders hero heading', () => {
    render(<MemoryRouter><ContactPage /></MemoryRouter>);
    expect(screen.getByText('Get in Touch')).toBeTruthy();
  });

  it('has no a11y violations', async () => {
    const { container } = render(<MemoryRouter><ContactPage /></MemoryRouter>);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { axe } from 'vitest-axe';
import { LandingPage } from './LandingPage';

describe('LandingPage', () => {
  it('renders hero heading', () => {
    render(<BrowserRouter><LandingPage /></BrowserRouter>);
    expect(screen.getByText(/Compassionate social welfare services/i)).toBeTruthy();
  });

  it('renders hero subheading', () => {
    render(<BrowserRouter><LandingPage /></BrowserRouter>);
    expect(screen.getByText(/Empowering communities through accessible, transparent, and efficient/i)).toBeTruthy();
  });

  it('renders Access Services CTA button', () => {
    render(<BrowserRouter><LandingPage /></BrowserRouter>);
    expect(screen.getByText('Access Services')).toBeTruthy();
  });

  it('renders Learn More buttons (hero + about)', () => {
    render(<BrowserRouter><LandingPage /></BrowserRouter>);
    const learnMore = screen.getAllByText('Learn More');
    expect(learnMore.length).toBeGreaterThanOrEqual(1);
  });

  it('renders services section heading', () => {
    render(<BrowserRouter><LandingPage /></BrowserRouter>);
    expect(screen.getByText('Our Services')).toBeTruthy();
  });

  it('renders application steps heading', () => {
    render(<BrowserRouter><LandingPage /></BrowserRouter>);
    expect(screen.getByText('How to Avail Services')).toBeTruthy();
  });

  it('renders about section heading', () => {
    render(<BrowserRouter><LandingPage /></BrowserRouter>);
    expect(screen.getByText(/About MSWDO Norzagaray/i)).toBeTruthy();
  });

  it('renders contact section heading', () => {
    render(<BrowserRouter><LandingPage /></BrowserRouter>);
    expect(screen.getByText('Get in Touch')).toBeTruthy();
  });

  it('has no a11y violations', async () => {
    const { container } = render(<BrowserRouter><LandingPage /></BrowserRouter>);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});

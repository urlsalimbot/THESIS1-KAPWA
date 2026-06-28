import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { LandingPage } from '../../src/pages/LandingPage';

describe('LandingPage', () => {
  it('renders hero heading', () => {
    render(<BrowserRouter><LandingPage /></BrowserRouter>);
    expect(screen.getByText('MSWDO Norzagaray')).toBeTruthy();
  });

  it('renders hero subheading', () => {
    render(<BrowserRouter><LandingPage /></BrowserRouter>);
    expect(screen.getByText(/Empowering communities through compassionate/i)).toBeTruthy();
  });

  it('renders Access Services CTA button', () => {
    render(<BrowserRouter><LandingPage /></BrowserRouter>);
    expect(screen.getByText('Access Services')).toBeTruthy();
  });

  it('renders Learn More button', () => {
    render(<BrowserRouter><LandingPage /></BrowserRouter>);
    expect(screen.getByText('Learn More')).toBeTruthy();
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
});

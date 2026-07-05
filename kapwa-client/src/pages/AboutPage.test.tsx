import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { AboutPage } from './AboutPage';

describe('AboutPage', () => {
  it('renders about heading', () => {
    render(<BrowserRouter><AboutPage /></BrowserRouter>);
    expect(screen.getByText(/About MSWDO Norzagaray/i)).toBeTruthy();
  });

  it('renders mission heading', () => {
    render(<BrowserRouter><AboutPage /></BrowserRouter>);
    expect(screen.getByText('Our Mission')).toBeTruthy();
  });

  it('renders programs heading', () => {
    render(<BrowserRouter><AboutPage /></BrowserRouter>);
    expect(screen.getByText('Our Programs')).toBeTruthy();
  });
});

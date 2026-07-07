import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ContactPage } from './ContactPage';

describe('ContactPage', () => {
  it('renders hero heading', () => {
    render(<MemoryRouter><ContactPage /></MemoryRouter>);
    expect(screen.getByText('Get in Touch')).toBeTruthy();
  });
});

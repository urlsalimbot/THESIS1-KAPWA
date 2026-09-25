import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MethodologyNote } from './MethodologyNote';

describe('MethodologyNote', () => {
  it('renders a disclosure with the translated methodology text', () => {
    render(<MethodologyNote textKey="analytics.methodology.equity" />);
    expect(screen.getByText('How this is computed')).toBeTruthy();
    expect(screen.getByText(/coverage ratio/i)).toBeTruthy();
  });
});

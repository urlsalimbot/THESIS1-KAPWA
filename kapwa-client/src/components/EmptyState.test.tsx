import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { EmptyState } from './EmptyState';

function renderWithRouter(ui: React.ReactElement) {
  return render(<BrowserRouter>{ui}</BrowserRouter>);
}

describe('EmptyState', () => {
  it('renders no-data variant with correct message and CTA', () => {
    renderWithRouter(<EmptyState variant="no-data" />);
    expect(screen.getByText('No data found')).toBeTruthy();
    expect(screen.getByText('Add first record')).toBeTruthy();
  });

  it('renders no-results variant with correct message and CTA', () => {
    renderWithRouter(<EmptyState variant="no-results" />);
    expect(screen.getByText('No results match your search')).toBeTruthy();
    expect(screen.getByText('Clear filters')).toBeTruthy();
  });

  it('renders offline variant with correct message and CTA', () => {
    renderWithRouter(<EmptyState variant="offline" />);
    expect(screen.getByText('You appear to be offline')).toBeTruthy();
    expect(screen.getByText('Retry')).toBeTruthy();
    expect(screen.getByText('Please check your connection and try again')).toBeTruthy();
  });

  it('renders no-access variant with correct message and CTA', () => {
    renderWithRouter(<EmptyState variant="no-access" />);
    expect(screen.getByText("You don't have access to this section")).toBeTruthy();
    expect(screen.getByText('Go to Dashboard')).toBeTruthy();
  });

  it('renders an icon with aria-hidden for each variant', () => {
    renderWithRouter(<EmptyState variant="no-data" />);
    const icons = document.querySelectorAll('[aria-hidden="true"]');
    expect(icons.length).toBeGreaterThanOrEqual(1);
  });

  it('calls onAction for no-results variant when button clicked', () => {
    const onAction = vi.fn();
    renderWithRouter(<EmptyState variant="no-results" onAction={onAction} />);
    screen.getByText('Clear filters').click();
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('calls onAction for offline variant when button clicked', () => {
    const onAction = vi.fn();
    renderWithRouter(<EmptyState variant="offline" onAction={onAction} />);
    screen.getByText('Retry').click();
    expect(onAction).toHaveBeenCalledTimes(1);
  });
});

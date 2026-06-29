import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TableSkeleton } from './TableSkeleton';

describe('TableSkeleton', () => {
  it('renders 5 skeleton rows by default', () => {
    const { container } = render(<TableSkeleton />);
    // Header skeleton + 5 body row skeletons + pagination skeleton = 7 skeleton divs
    const skeletonElements = container.querySelectorAll('.animate-pulse');
    expect(skeletonElements.length).toBe(7);
  });

  it('renders custom number of rows', () => {
    const { container } = render(<TableSkeleton rows={3} />);
    // Header + 3 rows + pagination = 5
    const skeletonElements = container.querySelectorAll('.animate-pulse');
    expect(skeletonElements.length).toBe(5);
  });

  it('renders header skeleton', () => {
    const { container } = render(<TableSkeleton rows={1} />);
    // First skeleton should be the header (h-6)
    const skeletonElements = container.querySelectorAll('.animate-pulse');
    expect(skeletonElements.length).toBeGreaterThanOrEqual(1);
    expect(skeletonElements[0].className).toContain('h-6');
  });
});

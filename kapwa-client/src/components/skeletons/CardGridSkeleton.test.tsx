import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { CardGridSkeleton } from './CardGridSkeleton';

describe('CardGridSkeleton', () => {
  it('renders 4 cards by default', () => {
    const { container } = render(<CardGridSkeleton />);
    // 4 cards × 4 skeleton elements each = 16 skeleton divs
    const skeletonElements = container.querySelectorAll('.animate-pulse');
    expect(skeletonElements.length).toBe(16);
  });

  it('renders responsive grid columns', () => {
    const { container } = render(<CardGridSkeleton count={2} />);
    const grid = container.firstChild as HTMLElement;
    expect(grid.className).toContain('grid-cols-1');
    expect(grid.className).toContain('md:grid-cols-2');
  });

  it('renders card border and skeleton elements', () => {
    const { container } = render(<CardGridSkeleton count={1} />);
    // Should have 4 skeleton elements per card + border class
    const card = container.querySelector('.border');
    expect(card).toBeTruthy();
    const skeletonElements = container.querySelectorAll('.animate-pulse');
    expect(skeletonElements.length).toBe(4);
  });
});

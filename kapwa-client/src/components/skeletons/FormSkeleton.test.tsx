import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { FormSkeleton } from './FormSkeleton';

describe('FormSkeleton', () => {
  it('renders 4 fields by default', () => {
    const { container } = render(<FormSkeleton />);
    // 4 fields × 2 skeleton elements (label + input) + 1 button = 9 skeleton divs
    const skeletonElements = container.querySelectorAll('.animate-pulse');
    expect(skeletonElements.length).toBe(9);
  });

  it('renders with custom field count', () => {
    const { container } = render(<FormSkeleton fields={2} />);
    // 2 fields × 2 + 1 button = 5
    const skeletonElements = container.querySelectorAll('.animate-pulse');
    expect(skeletonElements.length).toBe(5);
  });

  it('renders submit button skeleton', () => {
    const { container } = render(<FormSkeleton fields={1} />);
    const skeletonElements = container.querySelectorAll('.animate-pulse');
    // The last skeleton should be the button (h-10 w-[140px])
    const lastSkeleton = skeletonElements[skeletonElements.length - 1];
    expect(lastSkeleton.className).toContain('w-[140px]');
  });
});

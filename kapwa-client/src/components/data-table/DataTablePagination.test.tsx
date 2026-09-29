import { describe, it, expect } from 'vitest';
import { getPaginationItems } from './DataTablePagination';

describe('getPaginationItems', () => {
  it('renders every page when there are few pages', () => {
    expect(getPaginationItems(0, 1)).toEqual([0]);
    expect(getPaginationItems(3, 7)).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it('windows around the current page with an ellipsis before the last page', () => {
    expect(getPaginationItems(0, 50)).toEqual([0, 1, 2, 'after', 49]);
  });

  it('shows the window plus ellipses on both sides in the middle', () => {
    expect(getPaginationItems(5, 50)).toEqual([0, 'before', 4, 5, 6, 'after', 49]);
  });

  it('keeps the last three pages when near the end', () => {
    expect(getPaginationItems(48, 50)).toEqual([0, 'before', 47, 48, 49]);
    expect(getPaginationItems(49, 50)).toEqual([0, 'before', 47, 48, 49]);
  });

  it('clamps out-of-range indexes', () => {
    expect(getPaginationItems(-5, 50)).toEqual([0, 1, 2, 'after', 49]);
    expect(getPaginationItems(999, 50)).toEqual([0, 'before', 47, 48, 49]);
  });

  it('never grows beyond a handful of items regardless of page count', () => {
    for (const pageCount of [8, 50, 500, 10_000]) {
      for (let i = 0; i < pageCount; i += Math.max(1, Math.floor(pageCount / 7))) {
        expect(getPaginationItems(i, pageCount).length).toBeLessThanOrEqual(7);
      }
    }
  });
});
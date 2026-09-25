export const MIN_CELL = 5;

export type Suppressed<T> = { value: T } | { suppressed: true };

export function suppressCount(count: number): Suppressed<number> {
  if (count < MIN_CELL) return { suppressed: true };
  return { value: count };
}

export function suppressRatio(ratio: number, baseCount: number): Suppressed<number> {
  if (baseCount < MIN_CELL) return { suppressed: true };
  return { value: ratio };
}

/**
 * Complementary suppression: when a partition of counts contains exactly one
 * suppressed cell, the published total would reveal that cell's exact value,
 * so hide the smallest remaining cell too. Partitions with zero or two-plus
 * suppressed cells are already non-invertible and stay untouched.
 */
export function complementSuppression(cells: Suppressed<number>[]): Suppressed<number>[] {
  if (cells.filter(c => 'suppressed' in c).length !== 1) return cells;
  let smallestIdx = -1;
  let smallest = Infinity;
  cells.forEach((cell, i) => {
    if ('value' in cell && cell.value < smallest) { smallest = cell.value; smallestIdx = i; }
  });
  if (smallestIdx >= 0) cells[smallestIdx] = { suppressed: true };
  return cells;
}

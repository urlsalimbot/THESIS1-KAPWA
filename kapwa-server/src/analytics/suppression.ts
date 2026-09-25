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

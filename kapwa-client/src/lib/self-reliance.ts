// Step 4 guide: the recorded self-reliance level decides the recommendation.
// Staff still choose the action; the level does not block either path.
export const SELF_RELIANCE_SUFFICIENT_MIN_LEVEL = 3;

export function isSelfSufficient(level: number | undefined): boolean {
  return typeof level === 'number' && level >= SELF_RELIANCE_SUFFICIENT_MIN_LEVEL;
}

export const DEFAULT_LIST_LIMIT = 100;
export const INTERVENTION_TYPES = ['FA', 'C', 'CSR', 'R', 'H', 'HV', 'Other'] as const;

export function paginate<T extends import('typeorm').ObjectLiteral>(qb: import('typeorm').SelectQueryBuilder<T>, page = 1, limit = DEFAULT_LIST_LIMIT) {
  return qb.skip((page - 1) * limit).take(limit);
}

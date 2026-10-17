import { PgTrgmAdapter } from './dedup-adapter';

/**
 * The candidate prefilter's ORDER BY is load-bearing. Ranking by
 * GREATEST(surname, first-name) tied a first-name-only match (1.00) with the
 * true full-name match (1.00); with a common first name the real person fell
 * outside the LIMIT and the row read as "no match". Measured on a 300-row
 * import against 275 persons: 49 of 60 known matches were lost. Ranking by the
 * sum gives a full-name match 2.0 and keeps it at the top.
 */
describe('PgTrgmAdapter prefilter', () => {
  it('ranks candidates by the combined surname + first-name similarity', async () => {
    const query = jest.fn().mockResolvedValue([]);
    const adapter = new PgTrgmAdapter({ query } as any);

    await adapter.searchSimilar({ lastName: 'Dela Cruz', firstName: 'Marisol' });

    const sql = String(query.mock.calls[0][0]);
    expect(sql).toContain('similarity(p.surname, $1) + similarity(p.first_name, $2)');
    expect(sql).not.toContain('GREATEST(similarity(p.surname');
  });
});

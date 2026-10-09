import { DataSource } from 'typeorm';
import { PersonRecord } from './dedup-match-sweep.service';

/**
 * The sweep's database-facing half: candidate prefilter (pg_trgm over surname
 * and first name — the same extension the intake matcher uses) and a
 * deterministic trigram-cosine similarity used for scoring. Kept behind an
 * interface so the operations service is unit-testable with a stub.
 */
export interface DedupAdapter {
  searchSimilar(input: { lastName: string; firstName: string }): Promise<PersonRecord[]>;
  sim(x: string, y: string): number;
}

const TRIGRAMS = (s: string): Record<string, number> => {
  const out: Record<string, number> = {};
  const padded = `  ${s.toLowerCase()} `;
  for (let i = 0; i < padded.length - 2; i++) {
    const g = padded.slice(i, i + 3);
    out[g] = (out[g] ?? 0) + 1;
  }
  return out;
};

/** Cosine similarity over character trigrams — pb equivalent of pg_trgm. */
export function trigramSim(a: string, b: string): number {
  if (!a || !b) return 0;
  const ga = TRIGRAMS(a);
  const gb = TRIGRAMS(b);
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (const k in ga) { dot += ga[k] * (gb[k] ?? 0); na += ga[k] * ga[k]; }
  for (const k in gb) nb += gb[k] * gb[k];
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}

export class PgTrgmAdapter implements DedupAdapter {
  constructor(private readonly dataSource: DataSource) {}

  async searchSimilar(input: { lastName: string; firstName: string }): Promise<PersonRecord[]> {
    if (!input.lastName && !input.firstName) return [];
    const rows: any[] = await this.dataSource.query(
      `SELECT p.id,
              p.surname AS "lastName",
              p.first_name AS "firstName",
              p.middle_name AS "middleName",
              to_char(p.dob, 'YYYY-MM-DD') AS dob,
              (SELECT a.barangay FROM person_addresses a
                WHERE a.person_id = p.id AND a.address_type = 'current'
                ORDER BY a.is_primary DESC NULLS LAST LIMIT 1) AS barangay,
              (SELECT c.value FROM person_contacts c
                WHERE c.person_id = p.id AND c.contact_type = 'phone'
                ORDER BY c.is_primary DESC NULLS LAST LIMIT 1) AS phone,
              p.philsys_number AS philsys,
              (SELECT h.id FROM household_memberships hm JOIN households h ON h.id = hm.household_id
                WHERE hm.person_id = p.id LIMIT 1) AS "householdId"
       FROM persons p
       WHERE similarity(p.surname, $1) > 0.3 OR similarity(p.first_name, $2) > 0.3
       ORDER BY GREATEST(similarity(p.surname, $1), similarity(p.first_name, $2)) DESC
       LIMIT 30`,
      [input.lastName ?? '', input.firstName ?? ''],
    );
    return rows;
  }

  sim(x: string, y: string): number {
    return trigramSim(x, y);
  }
}
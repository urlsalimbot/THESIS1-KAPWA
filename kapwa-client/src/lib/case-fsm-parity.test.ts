import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { CASE_TRANSITION_ROLES } from './role-access';
import { STATUS_INDEX, STEP_MIN_STATUS } from '@/components/case-view/CaseStepper';

/**
 * The client's copies of the server's case-FSM facts, asserted equal to the
 * server's actual source.
 *
 * Three constants are duplicated across the two apps on purpose — the apps are
 * separate packages and cannot import each other — and until this file they were
 * duplicated with *nothing* keeping them equal: `case-step-done-fixture.json`
 * covers the done-predicate only, no floors and no roles. That is the same shape
 * as the two worst bugs this feature has produced (the C2 deadlock, the
 * `requirementsMet` divergence): two copies of one rule, and the client quietly
 * wrong in a way only a user finds out.
 *
 * The values match today, which is exactly what makes it dangerous — it is one
 * edit from divergence in either direction, and a client's stale copy is worse
 * than none: it enables a control the server will refuse, or hides one it will
 * allow, and neither is visible until a real case is stuck.
 *
 * **This reads the server's source rather than a shared fixture** so that editing
 * either side turns the *client* suite red on the spot, instead of waiting for
 * someone to remember to refresh a fixture that a stale side would keep passing
 * against. It parses the literals rather than importing them because
 * `case.entity.ts` pulls in TypeORM and Nest, and a browser-side unit test cannot
 * load that.
 *
 * A parse that finds nothing fails loudly rather than comparing `undefined`: a
 * regex that silently stops matching would turn this into a test that passes
 * because both sides are empty.
 */
const SERVER_CASES = path.resolve(import.meta.dirname, '../../../kapwa-server/src/cases');

function serverSource(file: string): string {
  return readFileSync(path.join(SERVER_CASES, file), 'utf8');
}

/**
 * The body of `export const NAME: <type> = <literal>;`.
 *
 * Anchored on `export const ${name}` and then on the `=`, because both halves
 * have bitten: `CASE_STEP_MIN_STATUS` is named in the doc comment above its own
 * declaration, and `number[] = [0, 0, 0, 3, 4]` puts a `[` in the *type*
 * annotation, one character before the real array. A parser that finds the wrong
 * `{`/`[` gets `{}`/`[]`, and every assertion below then compares empty to
 * non-empty — or worse, empty to empty. So each of these throws instead, which
 * is what turned that bug into one failed line rather than a passing test.
 */
function literalOf(source: string, name: string): string {
  const decl = source.indexOf(`export const ${name}`);
  const assign = decl < 0 ? -1 : source.indexOf('=', decl);
  if (decl < 0 || assign < 0) {
    throw new Error(`could not find ` + "`export const ${name}`" + ` — the server's shape changed, or this parser is stale`);
  }
  return source.slice(assign + 1).trimStart();
}

/** The `{ … }` body of a declared object literal, or throw if it is not there. */
function objectLiteral(source: string, name: string): string {
  const after = literalOf(source, name);
  const open = after.indexOf('{');
  const close = after.indexOf('\n};', open);
  if (open !== 0 || close < 0) {
    throw new Error(`${name} is not a plain object literal at its declaration — this parser is stale`);
  }
  return after.slice(1, close);
}

/** The `[ … ]` body of a declared array literal, or throw if it is not there. */
function arrayLiteral(source: string, name: string): string {
  const after = literalOf(source, name);
  const open = after.indexOf('[');
  const close = after.indexOf(']', open);
  if (open !== 0 || close < 0) {
    throw new Error(`${name} is not a plain array literal at its declaration — this parser is stale`);
  }
  return after.slice(1, close);
}

/**
 * The server's `CaseStatus` enum as wire values, e.g. `{ IN_REVIEW: 'in_review' }`.
 *
 * Also the reason the role map below can be read by member name: every member's
 * value is its own name lowercased, which `describe` asserts on its own. If that
 * ever stops holding, `[CaseStatus.IN_REVIEW]` stops meaning `'in_review'` and
 * this parser would quietly compare the wrong keys.
 */
function serverStatusEnum(): Record<string, string> {
  const source = serverSource('case.entity.ts');
  const start = source.indexOf('export enum CaseStatus {');
  const close = source.indexOf('\n}', start);
  if (start < 0 || close < 0) throw new Error('could not find `export enum CaseStatus`');
  const entries = [...source.slice(start, close).matchAll(/([A-Z_]+)\s*=\s*'([^']+)'/g)];
  if (entries.length === 0) throw new Error('`enum CaseStatus` parsed to nothing');
  return Object.fromEntries(entries.map(([, member, value]) => [member, value]));
}

/** The server's `CASE_FSM_ROLES`, keyed by wire status. */
function serverTransitionRoles(enumValues: Record<string, string>): Record<string, string[]> {
  const body = objectLiteral(serverSource('case-fsm.ts'), 'CASE_FSM_ROLES');
  const out: Record<string, string[]> = {};
  for (const [, member, list] of body.matchAll(/\[CaseStatus\.([A-Z_]+)\]:\s*\[([^\]]*)\]/g)) {
    const key = enumValues[member];
    if (key === undefined) throw new Error(`CASE_FSM_ROLES names a CaseStatus member that does not exist: ${member}`);
    out[key] = [...list.matchAll(/'([^']+)'/g)].map(([, role]) => role);
  }
  if (Object.keys(out).length === 0) throw new Error('`CASE_FSM_ROLES` parsed to nothing');
  return out;
}

/** Sorted by key, so a compare cannot pass on object key ordering. */
function sorted<T>(record: Record<string, T>): Record<string, T> {
  return Object.fromEntries(Object.entries(record).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
}

describe('the client mirrors of the server case FSM', () => {
  const enumValues = serverStatusEnum();

  it('the server CaseStatus values are the member names lowercased, as the parsers assume', () => {
    for (const [member, value] of Object.entries(enumValues)) {
      expect(value).toBe(member.toLowerCase());
    }
  });

  it('CASE_TRANSITION_ROLES equals the server CASE_FSM_ROLES, key for key and value for value', () => {
    const server = serverTransitionRoles(enumValues);
    // Every status either side knows about, so a key present on one side only is
    // compared rather than skipped.
    const statuses = [...new Set([...Object.keys(CASE_TRANSITION_ROLES), ...Object.keys(server)])].sort();

    for (const status of statuses) {
      // Presence is its own assertion, spelled with an explicit boolean: `toEqual`
      // ignores `undefined` members, so comparing the arrays directly would let
      // `{ enrolled: [...] }` pass against `{ enrolled: undefined }`.
      expect({ status, present: CASE_TRANSITION_ROLES[status] !== undefined && server[status] !== undefined })
        .toEqual({ status, present: true });
      // `?? null` for the same reason, and the status rides along so a failure
      // names the row instead of printing `{ active: [], …(5) }`.
      expect({ status, roles: CASE_TRANSITION_ROLES[status] ?? null })
        .toEqual({ status, roles: server[status] ?? null });
    }

    expect(statuses.some((s) => s === undefined)).toBe(false);
    expect(statuses.length).toBeGreaterThan(0);
  });

  it('STEP_MIN_STATUS equals the server CASE_STEP_MIN_STATUS', () => {
    const body = arrayLiteral(serverSource('case-step-labels.ts'), 'CASE_STEP_MIN_STATUS');
    // No capture group here, so the whole match is `[0]` — `[, n]` would destructure
    // `undefined` and produce a row of NaN.
    const floors = [...body.matchAll(/-?\d+/g)].map((m) => Number(m[0]));
    expect(floors.length).toBeGreaterThan(0);
    expect(STEP_MIN_STATUS).toEqual(floors);
    // Length is the part `toEqual` would forgive: a client array with extra
    // trailing floors would otherwise pass with the extra steps demanded at every
    // status.
    expect(STEP_MIN_STATUS.length).toBe(floors.length);
  });

  it('STATUS_INDEX equals the server CASE_STATUS_INDEX', () => {
    const body = objectLiteral(serverSource('case-step-labels.ts'), 'CASE_STATUS_INDEX');
    const index: Record<string, number> = {};
    for (const [, key, value] of body.matchAll(/([A-Za-z_]+):\s*(\d+)/g)) index[key] = Number(value);
    expect(Object.keys(index).length).toBeGreaterThan(0);
    expect(sorted(STATUS_INDEX)).toEqual(sorted(index));
    expect(Object.keys(STATUS_INDEX).some((k) => !(k in index))).toBe(false);
  });
});
import { DataSource } from 'typeorm';
import { Program } from './program.entity';
import { ProgramService } from './program-service.entity';
import { ProgramFundSource } from './program-fund-source.entity';
import { ProgramRequiredDocument } from './program-required-document.entity';
import { FormVersionHistory } from './form-version-history.entity';

/**
 * The Program → Services relation, asserted against TypeORM's *built metadata*.
 *
 * A `@OneToMany` whose second argument returns a *column* instead of the
 * inverse *relation* compiles, typechecks, passes every mocked-repository spec
 * and every seed/migration check — and then fails at runtime on the first
 * `find()` with `Cannot read properties of undefined (reading 'joinColumns')`,
 * taking down every endpoint that lists programs (public programs page, admin
 * programs page, the New Intervention program select). That is exactly what
 * shipped and was caught by driving the dev server; this spec builds the same
 * metadata TypeORM builds at boot, so the mistake cannot ship again.
 */
describe('Program ↔ ProgramService relation', () => {
  let dataSource: DataSource;

  beforeAll(async () => {
    // buildMetadatas() resolves relations without opening a connection.
    dataSource = new DataSource({
      type: 'postgres',
      entities: [Program, ProgramService, ProgramFundSource, ProgramRequiredDocument, FormVersionHistory],
    });
    // buildMetadatas() resolves relations without opening a connection. It is
    // `protected` on the type but callable at runtime — the metadata it builds
    // is exactly what the app boots with, which is the point of this spec.
    await (dataSource as unknown as { buildMetadatas(): Promise<void> }).buildMetadatas();
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) await dataSource.destroy();
  });

  it('resolves Program.serviceRows to a many-to-one with join columns', () => {
    const meta = dataSource.entityMetadatas.find((m) => m.target === Program);
    const relation = meta?.relations.find((r) => r.propertyName === 'serviceRows');
    expect(relation).toBeDefined();
    expect(relation?.relationType).toBe('one-to-many');
    // The inverse relation TypeORM resolved. When the second argument is a
    // column rather than the relation property, this is undefined and the query
    // builder throws on `joinColumns` — the runtime 500 this spec guards.
    expect(relation?.inverseRelation?.propertyName).toBe('program');
    expect(relation?.inverseEntityMetadata?.target).toBe(ProgramService);
    // The owning side carries the FK, so the one-to-many join is resolvable.
    expect(relation?.inverseRelation?.joinColumns.map((c) => c.databaseName)).toEqual(['program_id']);
  });

  it('keeps program_id as a real column alongside the relation', () => {
    const meta = dataSource.entityMetadatas.find((m) => m.target === ProgramService);
    const column = meta?.columns.find((c) => c.propertyName === 'programId');
    expect(column?.databaseName).toBe('program_id');
    // And the relation maps the same column, so `programId` writes stay in sync
    // with the relation TypeORM joins on.
    const relation = meta?.relations.find((r) => r.propertyName === 'program');
    expect(relation?.joinColumns.map((c) => c.databaseName)).toEqual(['program_id']);
  });
});
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConflictResolver } from './conflict-resolver';
import { SyncQueue } from './sync-queue.entity';

describe('ConflictResolver', () => {
  let resolver: ConflictResolver;
  let queueRepoMock: Partial<Repository<SyncQueue>>;

  beforeEach(async () => {
    queueRepoMock = {
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConflictResolver,
        { provide: getRepositoryToken(SyncQueue), useValue: queueRepoMock },
      ],
    }).compile();

    resolver = module.get<ConflictResolver>(ConflictResolver);
  });

  // 1. Server wins for financial tables
  it('1/12: server_wins for financial tables (interventions)', () => {
    const server = { id: '1', amount: 5000, fund_source: 'Regular', updated_at: '2026-06-14T10:00:00Z' };
    const client = { id: '1', amount: 8000, fund_source: 'PDAF' };
    const result = resolver.resolve('interventions', server, client, '2026-06-15T10:00:00Z');
    expect(result.action).toBe('server_wins');
    expect(result.mergedPayload?.amount).toBe(5000);
    expect(result.reason).toContain('Financial');
  });

  // 2. Server wins for disbursements
  it('2/12: server_wins for financial tables (disbursements)', () => {
    const server = { id: '1', amount: 10000, status: 'completed' };
    const client = { id: '1', amount: 12000, status: 'pending' };
    const result = resolver.resolve('disbursements', server, client, '2026-06-15T10:00:00Z');
    expect(result.action).toBe('server_wins');
    expect(result.mergedPayload?.amount).toBe(10000);
  });

  // 3. Append notes for case_notes
  it('3/12: append_notes for case_notes', () => {
    const serverNotes = [{ id: 'n1', text: 'Initial assessment done' }];
    const clientNotes = [{ id: 'n1', text: 'Initial assessment done' }, { id: 'n2', text: 'Follow-up visit completed' }];
    const server = { id: '1', content: JSON.stringify(serverNotes) };
    const client = { id: '1', content: JSON.stringify(clientNotes) };
    const result = resolver.resolve('case_notes', server, client, '2026-06-15T10:00:00Z');
    expect(result.action).toBe('append_notes');
    expect(result.reason).toContain('Appended');
  });

  // 4. No new notes to append (duplicate only)
  it('4/12: server_wins when no new notes to append', () => {
    const serverNotes = [{ id: 'n1', text: 'Note one' }];
    const clientNotes = [{ id: 'n1', text: 'Note one' }];
    const server = { id: '1', content: JSON.stringify(serverNotes) };
    const client = { id: '1', content: JSON.stringify(clientNotes) };
    const result = resolver.resolve('case_notes', server, client, '2026-06-15T10:00:00Z');
    expect(result.action).toBe('server_wins');
  });

  // 5. Server wins when server version is newer (default)
  it('5/12: server_wins when server version newer (default)', () => {
    const server = { id: '1', name: 'Old name', updated_at: '2026-06-15T12:00:00Z' };
    const client = { id: '1', name: 'New name', updatedAt: '2026-06-14T12:00:00Z' };
    const result = resolver.resolve('beneficiaries', server, client, '2026-06-14T12:00:00Z');
    expect(result.action).toBe('server_wins');
    expect(result.mergedPayload?.name).toBe('Old name');
  });

  // 6. Client wins when client version is newer (default)
  it('6/12: client_wins when client version newer (default)', () => {
    const server = { id: '1', name: 'Old name', updated_at: '2026-06-14T12:00:00Z' };
    const client = { id: '1', name: 'New name' };
    const result = resolver.resolve('beneficiaries', server, client, '2026-06-15T12:00:00Z');
    expect(result.action).toBe('client_wins');
    expect(result.mergedPayload?.name).toBe('New name');
  });

  // 7. Client wins when no server record exists (create)
  it('7/12: client_wins when no server record', () => {
    const result = resolver.resolve('beneficiaries', null, { id: 'new-id', name: 'New record' }, '2026-06-15T12:00:00Z');
    expect(result.action).toBe('client_wins');
    expect(result.mergedPayload?.name).toBe('New record');
    expect(result.reason).toContain('No server record');
  });

  // 8. Append notes for activity_logs
  it('8/12: append_notes for activity_logs', () => {
    const serverLogs = [{ id: 'l1', text: 'Case opened' }];
    const clientLogs = [{ id: 'l1', text: 'Case opened' }, { id: 'l2', text: 'Documents submitted' }];
    const server = { id: '1', notes: JSON.stringify(serverLogs) };
    const client = { id: '1', notes: JSON.stringify(clientLogs) };
    const result = resolver.resolve('activity_logs', server, client, '2026-06-15T10:00:00Z');
    expect(result.action).toBe('append_notes');
  });

  // 9. Server wins for financial_assistance
  it('9/12: server_wins for financial_assistance table', () => {
    const server = { id: '1', amount: 3000, grant_type: 'medical' };
    const client = { id: '1', amount: 5000, grant_type: 'education' };
    const result = resolver.resolve('financial_assistance', server, client, '2026-06-15T10:00:00Z');
    expect(result.action).toBe('server_wins');
    expect(result.mergedPayload?.amount).toBe(3000);
  });

  // 10. Default resolve with equal timestamps — server wins
  it('10/12: server_wins when timestamps equal (default)', () => {
    const ts = '2026-06-15T12:00:00Z';
    const server = { id: '1', name: 'Server', updated_at: ts };
    const client = { id: '1', name: 'Client' };
    const result = resolver.resolve('programs', server, client, ts);
    expect(result.action).toBe('server_wins');
    expect(result.mergedPayload?.name).toBe('Server');
  });

  // 11. Parse notes from raw string when not JSON
  it('11/12: parse notes from raw string content', () => {
    const server = { id: '1', content: 'Single text note' };
    const client = { id: '1', content: 'Single text note' };
    const result = resolver.resolve('case_notes', server, client, '2026-06-15T10:00:00Z');
    expect(result.action).toBe('server_wins');
  });

  // 12. Append multi-note merge preserves server notes
  it('12/12: append_notes preserves server notes order', () => {
    const serverNotes = [
      { id: 'n1', text: 'Step 1', timestamp: '2026-06-01T00:00:00Z' },
      { id: 'n2', text: 'Step 2', timestamp: '2026-06-02T00:00:00Z' },
    ];
    const clientNotes = [
      { id: 'n1', text: 'Step 1', timestamp: '2026-06-01T00:00:00Z' },
      { id: 'n2', text: 'Step 2', timestamp: '2026-06-02T00:00:00Z' },
      { id: 'n3', text: 'Step 3', timestamp: '2026-06-03T00:00:00Z' },
    ];
    const server = { id: '1', content: JSON.stringify(serverNotes) };
    const client = { id: '1', content: JSON.stringify(clientNotes) };
    const result = resolver.resolve('case_notes', server, client, '2026-06-15T10:00:00Z');
    expect(result.action).toBe('append_notes');
    const mergedContent = JSON.parse(result.mergedPayload!.content);
    expect(mergedContent.length).toBe(3);
    expect(mergedContent[0].id).toBe('n1');
    expect(mergedContent[1].id).toBe('n2');
    expect(mergedContent[2].id).toBe('n3');
  });
});

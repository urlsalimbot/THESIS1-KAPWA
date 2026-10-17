import { DedupFinalizeWorker } from './dedup-finalize.worker';

/**
 * The queue behind the "Finalize" button: a claimed job runs off the request
 * path, one per process, and a failure leaves the operation answerable.
 */
describe('DedupFinalizeWorker', () => {
  const opsRepo = { query: jest.fn() };
  const dedup = { finalize: jest.fn(), recordFinalizeFailure: jest.fn() };
  let worker: DedupFinalizeWorker;

  beforeEach(() => {
    jest.clearAllMocks();
    worker = new DedupFinalizeWorker(opsRepo as any, dedup as any);
    worker['logger'].warn = jest.fn();
    worker['logger'].error = jest.fn();
    worker['logger'].log = jest.fn();
  });

  it('claims the oldest queued job atomically, with a lease and a stale window', async () => {
    opsRepo.query.mockResolvedValue([[{ id: 'op1', accomplisher: 'u1' }], 1]);

    await expect(worker.claim()).resolves.toEqual({ id: 'op1', accomplisher: 'u1' });

    const sql = String(opsRepo.query.mock.calls[0][0]);
    expect(sql).toContain("status = 'finalizing'");
    expect(sql).toContain('FOR UPDATE SKIP LOCKED');
    expect(sql).toContain("interval '10 minutes'");
    expect(sql).toContain('SET finalize_started_at = now()');
  });

  it('does nothing when the queue is empty', async () => {
    opsRepo.query.mockResolvedValue([[], 0]);

    await worker.tick();

    expect(dedup.finalize).not.toHaveBeenCalled();
  });

  it('runs the claimed batch as the operator who queued it', async () => {
    opsRepo.query.mockResolvedValue([[{ id: 'op1', accomplisher: 'u1' }], 1]);
    dedup.finalize.mockResolvedValue({ created: 2, updated: 0, deprioritized: 0, barangayUpdates: 0 });

    await worker.tick();

    expect(dedup.finalize).toHaveBeenCalledWith('op1', 'u1');
    expect(dedup.recordFinalizeFailure).not.toHaveBeenCalled();
  });

  it('returns the operation to review with the reason when the batch throws', async () => {
    opsRepo.query.mockResolvedValue([[{ id: 'op1', accomplisher: null }], 1]);
    dedup.finalize.mockRejectedValue(new Error('deadlock detected'));

    await worker.tick();

    expect(dedup.finalize).toHaveBeenCalledWith('op1', null);
    expect(dedup.recordFinalizeFailure).toHaveBeenCalledWith('op1', expect.any(Error));
  });

  it('never runs two batches at once in one process', async () => {
    opsRepo.query.mockResolvedValue([[{ id: 'op1', accomplisher: 'u1' }], 1]);
    let release!: () => void;
    dedup.finalize.mockImplementation(() => new Promise<void>((r) => { release = r as any; }));

    const first = worker.tick();
    await worker.tick(); // while the first is still running
    // let the first tick get past its claim before counting
    await new Promise((r) => setImmediate(r));
    expect(dedup.finalize).toHaveBeenCalledTimes(1);

    release();
    await first;
  });
});

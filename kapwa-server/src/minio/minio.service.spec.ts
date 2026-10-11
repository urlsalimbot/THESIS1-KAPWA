import { MinioService } from './minio.service';
import type { ConfigService } from '@nestjs/config';

function makeService(env: Record<string, string> = {}) {
  const config = {
    get: jest.fn((key: string, fallback?: string) => env[key] ?? fallback),
  } as unknown as ConfigService;
  const service = new MinioService(config, undefined);
  // No MinIO in unit tests: stub the client object entirely.
  const client = {
    putObject: jest.fn().mockResolvedValue({}),
    presignedGetObject: jest.fn().mockResolvedValue('https://minio/object'),
    listObjects: jest.fn(() => ({ on: () => undefined })),
    removeObject: jest.fn().mockResolvedValue({}),
  };
  (service as any).client = client;
  return { service, client };
}

describe('MinioService', () => {
  it('uploads into the documents bucket under the case id and returns a presigned URL', async () => {
    const { service, client } = makeService();
    const url = await service.uploadDocument('case-1', 'receipt.pdf', Buffer.from('x'), 'application/pdf');

    expect(client.putObject).toHaveBeenCalledWith(
      'documents', 'case-1/receipt.pdf', expect.any(Buffer), 1,
      { 'Content-Type': 'application/pdf' },
    );
    expect(client.presignedGetObject).toHaveBeenCalledWith('documents', 'case-1/receipt.pdf', 24 * 60 * 60);
    expect(url).toBe('https://minio/object');
  });

  it('namespaces physical buckets when MINIO_BUCKET_PREFIX is set', async () => {
    const { service, client } = makeService({ MINIO_BUCKET_PREFIX: 'kapwa-prod' });
    await service.uploadFile('documents', 'x.pdf', Buffer.from('x'), 'text/plain');
    expect(client.putObject).toHaveBeenCalledWith('kapwa-prod-documents', 'x.pdf', expect.anything(), 1, expect.anything());
  });

  it('deletes through the mapped bucket', async () => {
    const { service, client } = makeService({ MINIO_BUCKET_PREFIX: 'kapwa-prod' });
    await service.deleteFile('filing', 'old.pdf');
    expect(client.removeObject).toHaveBeenCalledWith('kapwa-prod-filing', 'old.pdf');
  });
});
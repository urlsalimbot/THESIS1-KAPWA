/**
 * Standalone script to initialize MinIO buckets.
 * Also called by MinioService.onModuleInit() on NestJS startup.
 *
 * Usage:
 *   npx ts-node src/minio/init-buckets.ts
 *   (or via npm script)
 */

import * as Minio from 'minio';

const REQUIRED_BUCKETS = [
  'worker-signatures',
  'client-receipts',
  'irf-attachments',
  'coa-exports',
  'backups',
  'documents',
];

async function initBuckets(): Promise<void> {
  const endPoint = process.env.MINIO_ENDPOINT || 'localhost';
  const port = parseInt(process.env.MINIO_PORT || '9000', 10);
  const useSSL = process.env.MINIO_USE_SSL === 'true';
  const accessKey = process.env.MINIO_ROOT_USER || '';
  const secretKey = process.env.MINIO_ROOT_PASSWORD || '';

  if (!accessKey || !secretKey) {
    console.error('ERROR: MINIO_ROOT_USER and MINIO_ROOT_PASSWORD must be set');
    process.exit(1);
  }

  const client = new Minio.Client({
    endPoint,
    port,
    useSSL,
    accessKey,
    secretKey,
  });

  console.log(`Connecting to MinIO at ${endPoint}:${port}...`);

  for (const bucket of REQUIRED_BUCKETS) {
    try {
      const exists = await client.bucketExists(bucket);
      if (!exists) {
        await client.makeBucket(bucket);
        console.log(`  ✓ Created bucket: ${bucket}`);
      } else {
        console.log(`  ✓ Bucket already exists: ${bucket}`);
      }
    } catch (err) {
      console.error(`  ✗ Failed to init bucket "${bucket}": ${(err as Error).message}`);
    }
  }

  console.log('Bucket initialization complete.');
}

initBuckets().catch((err) => {
  console.error('Bucket initialization failed:', err);
  process.exit(1);
});

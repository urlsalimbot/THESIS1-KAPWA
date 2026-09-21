import * as Minio from 'minio';
import { Injectable, Logger, OnModuleInit, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CircuitBreakerService } from '../common/circuit-breaker.service';

@Injectable()
export class MinioService implements OnModuleInit {
  private readonly logger = new Logger(MinioService.name);
  private client: Minio.Client;

  constructor(
    private config: ConfigService,
    @Optional() private cb?: CircuitBreakerService,
  ) {
    const endPoint = this.config.get<string>('MINIO_ENDPOINT', 'minio');
    const port = parseInt(this.config.get<string>('MINIO_PORT', '9000'), 10) || 9000;
    const useSSL = this.config.get<string>('MINIO_USE_SSL', 'false') === 'true';
    const accessKey = this.config.get<string>('MINIO_ROOT_USER', '');
    const secretKey = this.config.get<string>('MINIO_ROOT_PASSWORD', '');
    // Required by AWS S3 for SigV4 signing; self-hosted MinIO ignores it.
    const region = this.config.get<string>('MINIO_REGION', '');

    this.client = new Minio.Client({
      endPoint,
      port,
      useSSL,
      accessKey,
      secretKey,
      ...(region ? { region } : {}),
    });
  }

  /**
   * Map a logical bucket name (what the app and API use) to its physical name.
   * S3 bucket names are globally unique, so cloud deployments set
   * MINIO_BUCKET_PREFIX (e.g. "kapwa-prod") to namespace them; self-hosted
   * MinIO leaves it empty and physical names equal logical names.
   */
  private resolveBucket(bucket: string): string {
    const prefix = this.config.get<string>('MINIO_BUCKET_PREFIX', '');
    return prefix ? `${prefix}-${bucket}` : bucket;
  }

  async onModuleInit(): Promise<void> {
    await this.initBuckets();
  }

  /**
   * Upload a file to a MinIO bucket and return a presigned GET URL.
   */
  async uploadFile(
    bucket: string,
    fileName: string,
    fileBuffer: Buffer,
    mimeType: string,
  ): Promise<string> {
    const fn = async () => {
      const physical = this.resolveBucket(bucket);
      await this.client.putObject(physical, fileName, fileBuffer, fileBuffer.length, {
        'Content-Type': mimeType,
      });
      return this.client.presignedGetObject(physical, fileName, 24 * 60 * 60);
    };
    return this.cb ? this.cb.call('minio', fn) : fn();
  }

  async getSignedUrl(
    bucket: string,
    fileName: string,
    expirySeconds = 86400,
  ): Promise<string> {
    const fn = () =>
      this.client.presignedGetObject(this.resolveBucket(bucket), fileName, expirySeconds);
    return this.cb ? this.cb.call('minio', fn) : fn();
  }

  async listObjects(bucket: string, prefix?: string): Promise<string[]> {
    const fn = () => {
      const objects: string[] = [];
      const stream = this.client.listObjects(this.resolveBucket(bucket), prefix, true);
      return new Promise<string[]>((resolve, reject) => {
        stream.on('data', (obj: { name?: string }) => {
          if (obj.name) objects.push(obj.name);
        });
        stream.on('error', (err: Error) => reject(err));
        stream.on('end', () => resolve(objects));
      });
    };
    return this.cb ? this.cb.call('minio', fn) : fn();
  }

  async deleteFile(bucket: string, fileName: string): Promise<void> {
    const fn = () => this.client.removeObject(this.resolveBucket(bucket), fileName);
    return this.cb ? this.cb.call('minio', fn) : fn();
  }

  /**
   * Upload a document associated with a case to the 'documents' bucket.
   * Called by FilingService for document vault uploads.
   */
  async uploadDocument(
    caseId: string,
    fileName: string,
    buffer: Buffer,
    mimeType: string,
  ): Promise<string> {
    const bucket = 'documents';
    const key = `${caseId}/${fileName}`;
    return this.uploadFile(bucket, key, buffer, mimeType);
  }

  /**
   * Initialize required buckets on startup.
   */
  private async initBuckets(): Promise<void> {
    const requiredBuckets = [
      'worker-signatures',
      'client-receipts',
      'irf-attachments',
      'coa-exports',
      'backups',
      'documents',
    ];

    for (const bucket of requiredBuckets) {
      try {
        const physical = this.resolveBucket(bucket);
        const exists = await this.client.bucketExists(physical);
        if (!exists) {
          await this.client.makeBucket(physical);
          this.logger.log(`Created bucket: ${physical}`);
        }
      } catch (err) {
        this.logger.error(`Failed to init bucket "${bucket}": ${(err as Error).message}`);
      }
    }
  }
}

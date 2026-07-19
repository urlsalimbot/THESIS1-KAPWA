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
    const port = this.config.get<number>('MINIO_PORT', 9000);
    const useSSL = this.config.get<string>('MINIO_USE_SSL', 'false') === 'true';
    const accessKey = this.config.get<string>('MINIO_ROOT_USER', '');
    const secretKey = this.config.get<string>('MINIO_ROOT_PASSWORD', '');

    this.client = new Minio.Client({
      endPoint,
      port,
      useSSL,
      accessKey,
      secretKey,
    });
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
      await this.client.putObject(bucket, fileName, fileBuffer, fileBuffer.length, {
        'Content-Type': mimeType,
      });
      return this.client.presignedGetObject(bucket, fileName, 24 * 60 * 60);
    };
    return this.cb ? this.cb.call('minio', fn) : fn();
  }

  async getSignedUrl(
    bucket: string,
    fileName: string,
    expirySeconds = 86400,
  ): Promise<string> {
    const fn = () => this.client.presignedGetObject(bucket, fileName, expirySeconds);
    return this.cb ? this.cb.call('minio', fn) : fn();
  }

  async listObjects(bucket: string, prefix?: string): Promise<string[]> {
    const fn = () => {
      const objects: string[] = [];
      const stream = this.client.listObjects(bucket, prefix, true);
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
    const fn = () => this.client.removeObject(bucket, fileName);
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
        const exists = await this.client.bucketExists(bucket);
        if (!exists) {
          await this.client.makeBucket(bucket);
          this.logger.log(`Created bucket: ${bucket}`);
        }
      } catch (err) {
        this.logger.error(`Failed to init bucket "${bucket}": ${(err as Error).message}`);
      }
    }
  }
}

import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IrfCase, KeyWrap } from './irf-case.entity';
import * as crypto from 'crypto';

@Injectable()
export class IrfKeyService {
  constructor(
    @InjectRepository(IrfCase) private irfRepo: Repository<IrfCase>,
  ) {}

  private getMasterKey(): Buffer {
    const keyHex = process.env.IRF_ENCRYPTION_KEY;
    if (!keyHex) throw new Error('IRF_ENCRYPTION_KEY not configured');
    return Buffer.from(keyHex, 'hex').subarray(0, 32);
  }

  async generatePerRecordKey(): Promise<string> {
    const result = await this.irfRepo.query(
      `SELECT encode(gen_random_bytes(32), 'hex') AS key_hex`
    );
    return result[0].key_hex;
  }

  async wrapKey(recordKeyHex: string): Promise<string> {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', this.getMasterKey(), iv);
    const encrypted = Buffer.concat([
      cipher.update(Buffer.from(recordKeyHex, 'hex')),
      cipher.final(),
    ]);
    return Buffer.concat([iv, encrypted]).toString('base64');
  }

  async unwrapKey(wrappedKeyBase64: string): Promise<string> {
    const data = Buffer.from(wrappedKeyBase64, 'base64');
    const iv = data.subarray(0, 16);
    const encrypted = data.subarray(16);
    const decipher = crypto.createDecipheriv('aes-256-cbc', this.getMasterKey(), iv);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString('hex');
  }

  async storeKeyWraps(irfId: string, encryptedRecordKey: string): Promise<void> {
    const wrap: KeyWrap = {
      userId: 'master',
      encryptedKey: encryptedRecordKey,
    };
    await this.irfRepo.update(irfId, {
      keyWraps: [wrap],
      keyVersion: 1,
    });
  }

  async getRecordKey(irfId: string): Promise<string> {
    const irf = await this.irfRepo.findOne({ where: { id: irfId } });
    if (!irf?.keyWraps?.length) throw new NotFoundException('No key wraps found for IRF');
    const masterWrap = irf.keyWraps.find(w => w.userId === 'master');
    if (!masterWrap) throw new NotFoundException('No master key wrap found');
    return this.unwrapKey(masterWrap.encryptedKey);
  }
}

import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ORG_LOCATION } from './constants';

export interface OrgProfile {
  officeName: string;
  country: string;
  region: string;
  province: string;
  municipality: string;
}

// Resolves the office identity stamped on generated PDFs from the agencies
// table (MSWDO row) so exports never print a hardcoded office name. Cached for
// the process lifetime — the row is effectively static.
@Injectable()
export class OrgService {
  private cached: OrgProfile | null = null;

  constructor(private readonly dataSource: DataSource) {}

  async profile(): Promise<OrgProfile> {
    if (this.cached) return this.cached;

    let officeName = '';
    try {
      const rows = await this.dataSource.query(
        `SELECT name FROM agencies WHERE code = 'MSWDO' LIMIT 1`,
      );
      officeName = rows?.[0]?.name ?? '';
    } catch {
      officeName = '';
    }

    this.cached = {
      officeName: officeName || 'Municipal Social Welfare and Development Office',
      ...ORG_LOCATION,
    };
    return this.cached;
  }

  async officeName(): Promise<string> {
    return (await this.profile()).officeName;
  }
}

import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { phTime } from './common/utils';

// Postgres hard-refuses DDL at 1600 columns (dropped-column tombstones count).
// Fail health well before migrate.js hits that wall, so the deploy gate and
// the container healthcheck surface schema drift instead of serving a schema
// that can no longer be migrated.
const MAX_TABLE_COLUMNS = 1500;

@Controller()
export class AppController {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  @Get()
  root() {
    return { name: 'KAPWA API', version: '1.0.0' };
  }

  @Get('health')
  async health() {
    try {
      await this.dataSource.query('SELECT 1');
      const [widest] = await this.dataSource.query(`
        SELECT c.relname AS table_name, count(*) AS columns
        FROM pg_class c
        JOIN pg_attribute a ON a.attrelid = c.oid
        WHERE c.relnamespace = 'public'::regnamespace
          AND c.relkind = 'r' AND a.attnum > 0
        GROUP BY c.oid, c.relname
        ORDER BY columns DESC
        LIMIT 1
      `);
      const columns = Number(widest && widest.columns);
      if (Number.isFinite(columns) && columns >= MAX_TABLE_COLUMNS) {
        throw new ServiceUnavailableException({
          status: 'degraded',
          db: 'connected',
          schema: { widestTable: widest?.table_name, columns },
        });
      }
      return { status: 'ok', db: 'connected', timestamp: phTime() };
    } catch (e) {
      if (e instanceof ServiceUnavailableException) throw e;
      throw new ServiceUnavailableException({ status: 'degraded', db: 'disconnected' });
    }
  }

  @Get('health/live')
  live() {
    return { status: 'ok', timestamp: phTime() };
  }

  @Get('health/ready')
  async ready() {
    try {
      await this.dataSource.query('SELECT 1');
      return { status: 'ready', db: 'connected', timestamp: phTime() };
    } catch {
      throw new ServiceUnavailableException({ status: 'not-ready', db: 'disconnected' });
    }
  }
}
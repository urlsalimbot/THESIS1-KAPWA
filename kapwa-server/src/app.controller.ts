import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { phTime } from './common/utils';

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
      return { status: 'ok', db: 'connected', timestamp: phTime() };
    } catch {
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
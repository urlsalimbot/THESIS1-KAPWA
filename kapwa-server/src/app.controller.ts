import { Controller, Get } from '@nestjs/common';
import { phTime } from './common/utils';

@Controller()
export class AppController {
  @Get()
  root() {
    return { name: 'KAPWA API', version: '1.0.0' };
  }

  @Get('health')
  health() {
    return { status: 'ok', timestamp: phTime() };
  }
}
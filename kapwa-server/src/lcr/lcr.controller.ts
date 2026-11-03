import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { ZodPipe } from '../common/pipes/zod.pipe.js';
import { ImportLcrRecordSchema } from './dto/lcr.zod.js';
import { LcrService } from './lcr.service.js';

@ApiTags('LCR')
@Controller('lcr')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class LcrController {
  constructor(private lcrService: LcrService) {}

  @Post('import')
  @Roles('admin')
  @ApiOperation({ summary: 'Import LCR record (birth/marriage/death)' })
  async importRecord(@Body(new ZodPipe(ImportLcrRecordSchema)) body: Record<string, unknown>) {
    return this.lcrService.importRecord(body as any);
  }

}

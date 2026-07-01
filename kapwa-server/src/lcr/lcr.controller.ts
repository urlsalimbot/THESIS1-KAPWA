import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ZodPipe } from '../common/pipes/zod.pipe';
import { ImportLcrRecordSchema, ImportLcrBatchSchema } from './dto/lcr.zod';
import { LcrService } from './lcr.service';

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

  @Post('import-batch')
  @Roles('admin')
  @ApiOperation({ summary: 'Batch import LCR records' })
  async importBatch(@Body(new ZodPipe(ImportLcrBatchSchema)) body: { records: Record<string, unknown>[] }) {
    return this.lcrService.importBatch(body.records);
  }
}

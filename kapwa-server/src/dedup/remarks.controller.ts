import { Controller, Get, Post, Param, Body, Query, UseGuards, Request, DefaultValuePipe, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ZodPipe } from '../common/pipes/zod.pipe';
import { AuthenticatedRequest } from '../auth/types';
import { BeneficiaryRemarksService } from './beneficiary-remarks.service';
import { AddRemarkSchema, AddRemarkInput } from './dto/dedup.zod';

/** The beneficiary view's Remarks History card reads and writes here. */
@ApiTags('Beneficiary Remarks')
@Controller('beneficiaries')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('admin', 'social_worker')
@ApiBearerAuth()
export class RemarksController {
  constructor(private readonly remarks: BeneficiaryRemarksService) {}

  @Get(':id/remarks')
  @ApiOperation({ summary: 'Remark history for a beneficiary (newest first)' })
  async list(@Param('id') id: string, @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number, @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number) {
    return this.remarks.list(id, page, limit);
  }

  @Post(':id/remarks')
  @ApiOperation({ summary: 'Add a manual remark' })
  async add(@Param('id') id: string, @Body(new ZodPipe(AddRemarkSchema)) body: AddRemarkInput, @Request() req: AuthenticatedRequest) {
    return this.remarks.add(id, body, req.user?.id);
  }
}

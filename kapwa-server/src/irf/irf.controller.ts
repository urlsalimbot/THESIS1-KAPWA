import { Controller, Get, Post, Patch, Param, Body, UseGuards, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { IrfService } from './irf.service';

@ApiTags('IRF')
@Controller('irf')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class IrfController {
  constructor(private irfService: IrfService) {}

  @Get()
  @ApiOperation({ summary: 'List IRF cases' })
  async findAll() {
    return this.irfService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get IRF case (narration masked)' })
  async findOne(@Param('id') id: string) {
    const irf = await this.irfService.findById(id);
    return { ...irf, narration: '[CONFIDENTIAL]' };
  }

  @Post()
  @ApiOperation({ summary: 'Submit IRF' })
  async create(@Body() body: any) {
    return this.irfService.create(body);
  }

  @Patch(':id/disposition')
  @ApiOperation({ summary: 'Update case disposition' })
  async updateStatus(
    @Param('id') id: string,
    @Body() body: { disposition: string }
  ) {
    return this.irfService.updateStatus(id, body.disposition);
  }

  @Get(':id/narration')
  @ApiOperation({ summary: 'Decrypt narration (requires legal basis)' })
  async getNarration(
    @Param('id') id: string,
    @Query('legalBasis') legalBasis: string
  ) {
    return this.irfService.getDecryptedNarr(id, legalBasis);
  }
}
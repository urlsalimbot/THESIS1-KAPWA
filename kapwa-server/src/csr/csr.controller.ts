import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Req, Res } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CsrService } from './csr.service';
import { createCsrSchema, updateCsrSchema } from './dto/csr.zod';
import { AuthenticatedRequest } from '../auth/types';
import { ZodPipe } from '../common/pipes/zod.pipe';
import { z } from 'zod';
import type { Response } from 'express';

@Controller('csr')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CsrController {
  constructor(private readonly csrService: CsrService) {}

  @Post()
  @Roles('admin', 'social_worker')
  async create(@Body(new ZodPipe(createCsrSchema)) data: z.infer<typeof createCsrSchema>, @Req() req: AuthenticatedRequest) {
    return this.csrService.create(data, req.user.id);
  }

  @Get()
  @Roles('admin', 'social_worker', 'coordinator', 'mayor', 'auditor')
  async findAll() {
    return this.csrService.findAll();
  }

  @Get(':id')
  @Roles('admin', 'social_worker', 'coordinator')
  async findOne(@Param('id') id: string) {
    return this.csrService.findById(id);
  }

  @Patch(':id')
  @Roles('admin', 'social_worker')
  async update(@Param('id') id: string, @Body(new ZodPipe(updateCsrSchema)) data: z.infer<typeof updateCsrSchema>) {
    return this.csrService.update(id, data);
  }

  @Delete(':id')
  @Roles('admin')
  async remove(@Param('id') id: string) {
    await this.csrService.remove(id);
    return { message: 'CSR record deleted' };
  }

  @Get(':controlNo/pdf')
  @Roles('admin', 'social_worker', 'coordinator')
  async downloadPdf(@Param('controlNo') controlNo: string, @Res() res: Response) {
    const buffer = await this.csrService.generatePdf(controlNo);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="CSR-${controlNo}.pdf"`,
      'Content-Length': buffer.length.toString(),
    });
    res.end(buffer);
  }
}

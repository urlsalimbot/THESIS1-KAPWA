import { Controller, Get, Post, Body, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CsrService } from './csr.service';
import { createCsrSchema } from './dto/csr.zod';
import { AuthenticatedRequest } from '../auth/types';
import { ZodPipe } from '../common/pipes/zod.pipe';
import { z } from 'zod';

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
  @Roles('admin', 'social_worker', 'coordinator')
  async findAll() {
    return this.csrService.findAll();
  }

}

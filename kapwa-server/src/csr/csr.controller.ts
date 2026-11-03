import { Controller, Get, Post, Body, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CsrService } from './csr.service.js';
import { createCsrSchema } from './dto/csr.zod.js';
import { AuthenticatedRequest } from '../auth/types.js';
import { ZodPipe } from '../common/pipes/zod.pipe.js';
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

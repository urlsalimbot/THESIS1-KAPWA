import { Controller, Get, Post, Param, Body, UseGuards, Request, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { InterventionsService } from './interventions.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AbacGuard } from '../auth/guards/abac.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ZodPipe } from '../common/pipes/zod.pipe';
import { CreateInterventionSchema, CreateInterventionInput } from './dto/interventions.zod';
import { AuthenticatedRequest } from '../auth/types';

@Controller('interventions')
@UseGuards(JwtAuthGuard, RolesGuard, AbacGuard)
export class InterventionsController {
  constructor(private intService: InterventionsService) {}

  @Get()
  @Roles('admin', 'social_worker', 'mayor', 'auditor')
  async findAll() {
    return this.intService.findAll();
  }

  @Get(':id')
  @Roles('admin', 'social_worker', 'auditor')
  async findOne(@Param('id') id: string) {
    return this.intService.findById(id);
  }

  @Post()
  @Roles('admin', 'social_worker')
  async create(@Request() req: AuthenticatedRequest, @Body(new ZodPipe(CreateInterventionSchema)) body: CreateInterventionInput) {
    return this.intService.create(body as any, req.user.id);
  }

  @Post('upload-signature')
  @Roles('admin', 'social_worker')
  @UseInterceptors(FileInterceptor('file'))
  async uploadSignature(@UploadedFile() file: any) {
    if (!file) throw new BadRequestException('File is required');
    const url = await this.intService.uploadSignature(file.buffer, `${Date.now()}-${file.originalname}`, file.mimetype);
    return { url };
  }

  @Post('upload-receipt')
  @Roles('admin', 'social_worker')
  @UseInterceptors(FileInterceptor('file'))
  async uploadReceipt(@UploadedFile() file: any) {
    if (!file) throw new BadRequestException('File is required');
    const url = await this.intService.uploadReceipt(file.buffer, `${Date.now()}-${file.originalname}`, file.mimetype);
    return { url };
  }

  @Get('case/:caseId')
  @Roles('admin', 'social_worker')
  async findByCase(@Param('caseId') caseId: string) {
    return this.intService.findByCase(caseId);
  }

  @Get('chain/:caseId')
  @Roles('admin')
  async getChain(@Param('caseId') caseId: string) {
    return this.intService.getChain(caseId);
  }
}

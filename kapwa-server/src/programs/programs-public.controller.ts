import { Controller, Get, Param, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ProgramsService } from './programs.service';

// Public read-only view of active programs. Guards nothing — the website's
// public visitors must see available assistance programs without an account.
// Sensitive internal fields (approval_workflow, form_template) are excluded.
@ApiTags('Programs (Public)')
@Controller('programs/public')
export class ProgramsPublicController {
  constructor(private readonly svc: ProgramsService) {}

  @Get()
  @ApiOperation({ summary: 'List active programs (public)' })
  async list() {
    const programs = await this.svc.findAll(true);
    return programs.map((p) => ({
      id: p.id,
      name: p.name,
      category: p.category ?? undefined,
      waitingPeriodDays: p.waitingPeriodDays ?? undefined,
      fundSources: p.fundSources,
      requiredDocuments: p.requiredDocuments,
      legalBasis: p.legalBasis ?? undefined,
    }));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an active program by id (public)' })
  async byId(@Param('id') id: string) {
    const p = await this.svc.findById(id);
    if (!p.isActive) throw new NotFoundException('Program not found');
    return {
      id: p.id,
      name: p.name,
      category: p.category ?? undefined,
      waitingPeriodDays: p.waitingPeriodDays ?? undefined,
      fundSources: p.fundSources,
      requiredDocuments: p.requiredDocuments,
      legalBasis: p.legalBasis ?? undefined,
    };
  }
}
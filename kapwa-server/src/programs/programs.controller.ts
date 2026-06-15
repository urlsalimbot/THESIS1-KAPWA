import { Controller, Get, Post, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ProgramsService } from './programs.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('programs')
@UseGuards(JwtAuthGuard)
export class ProgramsController {
  constructor(private progService: ProgramsService) {}

  @Get()
  async findAll(@Query('activeOnly') activeOnly?: string) {
    return this.progService.findAll(activeOnly !== 'false');
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.progService.findById(id);
  }

  @Post()
  async create(@Body() body: any) {
    return this.progService.create(body);
  }
}

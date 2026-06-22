import { Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ProgramsService } from './programs.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ZodPipe } from '../common/pipes/zod.pipe';
import { CreateProgramSchema, UpdateProgramSchema, CreateProgramInput, UpdateProgramInput } from './dto/programs.zod';

@ApiTags('Programs')
@ApiBearerAuth()
@Controller('programs')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProgramsController {
  constructor(private progService: ProgramsService) {}

  @Get()
  @Roles('admin')
  @ApiOperation({ summary: 'List all programs' })
  async findAll(@Query('activeOnly') activeOnly?: string) {
    return this.progService.findAll(activeOnly !== 'false');
  }

  @Get(':id')
  @Roles('admin')
  @ApiOperation({ summary: 'Get program by ID' })
  async findOne(@Param('id') id: string) {
    return this.progService.findById(id);
  }

  @Post()
  @Roles('admin')
  @ApiOperation({ summary: 'Create a new program' })
  async create(@Body(new ZodPipe(CreateProgramSchema)) body: CreateProgramInput) {
    return this.progService.create(body);
  }

  @Patch(':id')
  @Roles('admin')
  @ApiOperation({ summary: 'Update an existing program' })
  async update(
    @Param('id') id: string,
    @Body(new ZodPipe(UpdateProgramSchema)) body: UpdateProgramInput,
  ) {
    return this.progService.update(id, body);
  }

  @Delete(':id')
  @Roles('admin')
  @ApiOperation({ summary: 'Delete a program' })
  async delete(@Param('id') id: string) {
    return this.progService.delete(id);
  }
}

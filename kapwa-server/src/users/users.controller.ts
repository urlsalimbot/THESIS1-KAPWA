import { DEFAULT_PAGE_SIZE } from './constants';
import { Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { UsersService } from './users.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { ZodPipe } from '../common/pipes/zod.pipe';
import { CreateUserInputSchema, CreateUserInput, UpdateUserSchema, UpdateUserInput } from './dto/users.zod';

@ApiTags('Users')
@Controller('users')
@UseGuards(AuthGuard('jwt'))
@ApiBearerAuth()
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Post()
  @Roles('admin')
  @ApiOperation({ summary: 'Create a new user (admin only)' })
  async create(@Body(new ZodPipe(CreateUserInputSchema)) body: CreateUserInput) {
    const user = await this.usersService.createUser(body);
    return { user, message: 'User created successfully' };
  }

  @Get()
  @Roles('admin')
  @ApiOperation({ summary: 'List all users' })
  async findAll(@Query('search') search?: string, @Query('role') role?: string, @Query('page') page?: string, @Query('limit') limit?: string) {
    return this.usersService.findAll(search, role, page ? parseInt(page) : 1, limit ? parseInt(limit) : DEFAULT_PAGE_SIZE);
  }

  @Get(':id')
  @Roles('admin')
  @ApiOperation({ summary: 'Get user by ID' })
  async findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Patch(':id')
  @Roles('admin')
  @ApiOperation({ summary: 'Update user' })
  async update(@Param('id') id: string, @Body(new ZodPipe(UpdateUserSchema)) body: UpdateUserInput) {
    return this.usersService.update(id, body);
  }

  @Delete(':id')
  @Roles('admin')
  @ApiOperation({ summary: 'Deactivate user (soft delete)' })
  async remove(@Param('id') id: string) {
    return this.usersService.deactivateUser(id);
  }
}

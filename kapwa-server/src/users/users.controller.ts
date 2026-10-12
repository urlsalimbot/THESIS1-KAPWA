import { DEFAULT_PAGE_SIZE } from '../common/constants';
import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards, UseInterceptors, Request, ForbiddenException } from '@nestjs/common';
import { ClassSerializerInterceptor, SerializeOptions } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { UsersService } from './users.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ZodPipe } from '../common/pipes/zod.pipe';
import { AuthenticatedRequest } from '../auth/types';
import { CreateUserInputSchema, CreateUserInput, UpdateUserSchema, UpdateUserInput } from './dto/users.zod';

@ApiTags('Users')
@Controller('users')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@UseInterceptors(ClassSerializerInterceptor)
@SerializeOptions({ strategy: 'exposeAll' })
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
  @Roles('admin', 'social_worker')
  @ApiOperation({ summary: 'List users (admins see all; social workers see claimant accounts only)' })
  async findAll(
    @Query('search') search?: string,
    @Query('role') role?: string,
    @Query('status') status?: string,
    // Subtract one role from the list — the admin panel's staff tabs pass
    // `exclude=claimant`, which cannot be expressed with the exact-match
    // `role` param above.
    @Query('exclude') exclude?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Request() req?: AuthenticatedRequest,
  ) {
    // A social worker's user-management surface is the claimant accounts tab:
    // the list is coerced to claimant-only regardless of what the client asks.
    const isSocialWorker = req?.user?.role === 'social_worker';
    const effectiveRole = isSocialWorker ? 'claimant' : role;
    const effectiveExclude = isSocialWorker ? undefined : exclude;
    const isActive = status === 'active' ? true : status === 'inactive' ? false : undefined;
    return this.usersService.findAll(search, effectiveRole, isActive, page ? parseInt(page) : 1, limit ? parseInt(limit) : DEFAULT_PAGE_SIZE, effectiveExclude);
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

  // Accounts are never deleted — disabling removes all access while preserving
  // the user's history (audit trail, case attribution). Social workers may only
  // disable or re-enable claimant accounts (their management surface).
  @Patch(':id/disable')
  @Roles('admin', 'social_worker')
  @ApiOperation({ summary: 'Disable a user (no access, reversible)' })
  async disable(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
    await this.assertManageable(req, id);
    return this.usersService.setActive(id, false, req.user?.id);
  }

  @Patch(':id/enable')
  @Roles('admin', 'social_worker')
  @ApiOperation({ summary: 'Re-enable a disabled user' })
  async enable(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
    await this.assertManageable(req, id);
    return this.usersService.setActive(id, true, req.user?.id);
  }

  // A social worker may only manage claimant accounts; admins manage everyone.
  private async assertManageable(req: AuthenticatedRequest, id: string): Promise<void> {
    if (req.user?.role !== 'social_worker') return;
    const target = await this.usersService.findOne(id);
    if (!target || target.role !== 'claimant') {
      throw new ForbiddenException('Social workers can only manage claimant accounts');
    }
  }
}

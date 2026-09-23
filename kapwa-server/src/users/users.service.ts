import { DEFAULT_PAGE_SIZE } from '../common/constants';
import { Injectable, NotFoundException, ConflictException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike, FindOptionsWhere } from 'typeorm';
import { User, UserRole } from '../auth/user.entity';
import { UserBarangayAssignment } from '../auth/user-barangay-assignment.entity';
import { AccountProvisioningService } from '../accounts/account-provisioning.service';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

export interface CreateUserInput {
  email: string;
  password?: string;
  role: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  nameExtension?: string;
  phone?: string;
  assignedBarangay?: string;
  permittedBarangays?: string[];
  agencyId?: string;
}

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectRepository(User)
    private userRepo: Repository<User>,
    private accounts: AccountProvisioningService,
  ) {}

  private buildAssignments(assigned?: string, permitted: string[] = []): UserBarangayAssignment[] {
    const assignments: UserBarangayAssignment[] = [];
    if (assigned) assignments.push(Object.assign(new UserBarangayAssignment(), { userId: undefined as any, barangay: assigned, isPrimary: true }));
    for (const b of permitted) {
      assignments.push(Object.assign(new UserBarangayAssignment(), { userId: undefined as any, barangay: b, isPrimary: false }));
    }
    return assignments;
  }

  async findAll(search?: string, role?: string, isActive?: boolean, page = 1, limit = DEFAULT_PAGE_SIZE) {
    const where: FindOptionsWhere<User> = {};
    if (search) where.email = ILike(`%${search}%`);
    if (role) where.role = role as UserRole;
    if (isActive !== undefined) where.isActive = isActive;
    const [data, total] = await this.userRepo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    // JSON serialization ignores class getters, so materialize the flattened
    // barangay shape (assembled from user_barangay_assignments) explicitly —
    // otherwise the admin Users panel shows an empty Barangay column. Also
    // strip sensitive relations/properties (tokens, MFA secret) that the
    // @Exclude() decorators would hide only under a ClassSerializerInterceptor.
    return {
      data: data.map((user) => {
        const { password, tokens, mfaSecret, ...u } = user;
        return {
          ...u,
          fullName: user.fullName,
          assignedBarangay: user.assignedBarangay,
          permittedBarangays: user.permittedBarangays,
        };
      }),
      total,
      page,
      limit,
    };
  }

  async findOne(id: string) {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    const { password, tokens, mfaSecret, ...safe } = user;
    return { ...safe, fullName: user.fullName, assignedBarangay: user.assignedBarangay, permittedBarangays: user.permittedBarangays };
  }

  async createUser(dto: CreateUserInput) {
    const validRoles = Object.values(UserRole) as string[];
    if (!validRoles.includes(dto.role)) {
      throw new BadRequestException(`Invalid role: ${dto.role}. Must be one of: ${validRoles.join(', ')}`);
    }

    const existing = await this.userRepo.findOne({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException('A user with this email already exists');
    }

    // Admin-provisioned accounts get a one-time set-password link: an unusable
    // random password is stored, and the link is delivered by email/SMS.
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), salt);

    const user = this.userRepo.create({
      email: dto.email,
      password: hashedPassword,
      role: dto.role as UserRole,
      firstName: dto.firstName,
      middleName: dto.middleName,
      lastName: dto.lastName,
      nameExtension: dto.nameExtension,
      phone: dto.phone,
      agencyId: dto.agencyId,
      barangayAssignments: this.buildAssignments(dto.assignedBarangay, dto.permittedBarangays || []),
    });

    const saved = await this.userRepo.save(user);

    try {
      await this.accounts.deliverAccountCredentials({
        userId: saved.id,
        email: saved.email,
        phone: saved.phone ?? undefined,
        fullName: saved.fullName,
        role: saved.role,
      });
    } catch (e) {
      this.logger.warn(`Setup link delivery failed for ${saved.email}: ${(e as Error)?.message ?? e}`);
    }

    const { password, ...safe } = saved;
    return { ...safe, fullName: saved.fullName };
  }

  /**
   * Enable or disable an account. There is no hard delete: disabling keeps the
   * user's history intact while removing all access.
   *
   * Disabling revokes every live session (tokenVersion bump) and is refused when
   * it would lock the system out — an admin cannot disable their own account, and
   * the last active administrator cannot be disabled.
   */
  async setActive(id: string, isActive: boolean, actorId?: string) {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');

    if (!isActive) {
      if (actorId && actorId === user.id) {
        throw new BadRequestException('You cannot disable your own account');
      }
      if (user.role === UserRole.ADMIN && user.isActive) {
        const activeAdmins = await this.userRepo.count({ where: { role: UserRole.ADMIN, isActive: true } });
        if (activeAdmins <= 1) {
          throw new BadRequestException('At least one active administrator must remain');
        }
      }
      // Invalidate refresh tokens so a disabled account cannot mint new sessions.
      user.tokenVersion = (user.tokenVersion ?? 0) + 1;
    }

    user.isActive = isActive;
    const saved = await this.userRepo.save(user);
    this.logger.log(`User ${saved.email} ${isActive ? 'enabled' : 'disabled'}${actorId ? ` by ${actorId}` : ''}`);
    const { password, tokens, mfaSecret, ...safe } = saved;
    return { ...safe, fullName: saved.fullName, assignedBarangay: saved.assignedBarangay, permittedBarangays: saved.permittedBarangays };
  }

  async update(id: string, data: { firstName?: string; middleName?: string; lastName?: string; nameExtension?: string; role?: string; assignedBarangay?: string; permittedBarangays?: string[]; agencyId?: string }) {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    if (data.role) user.role = data.role as UserRole;
    if (data.firstName !== undefined) user.firstName = data.firstName;
    if (data.middleName !== undefined) user.middleName = data.middleName;
    if (data.lastName !== undefined) user.lastName = data.lastName;
    if (data.nameExtension !== undefined) user.nameExtension = data.nameExtension;
    if (data.agencyId !== undefined) user.agencyId = data.agencyId;
    if (data.assignedBarangay !== undefined || data.permittedBarangays !== undefined) {
      const assigned = data.assignedBarangay !== undefined ? data.assignedBarangay : user.assignedBarangay;
      const permitted = data.permittedBarangays !== undefined ? data.permittedBarangays : user.permittedBarangays;
      user.barangayAssignments = this.buildAssignments(assigned, permitted);
    }
    await this.userRepo.save(user);
    const { password, ...safe } = user;
    return { ...safe, fullName: user.fullName };
  }
}

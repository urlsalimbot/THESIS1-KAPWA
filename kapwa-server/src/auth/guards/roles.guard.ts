import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles || requiredRoles.length === 0) return true;

    const { user } = context.switchToHttp().getRequest();
    if (!user) throw new UnauthorizedException();
    if (requiredRoles.includes(user.role)) return true;
    // Naming the role and the required set is what lets the client say why it
    // was refused. A bare `false` here yields Nest's default "Forbidden
    // resource", which tells the user nothing they can act on.
    throw new ForbiddenException(
      `Your role (${user.role}) cannot perform this action. It requires: ${requiredRoles.join(', ')}.`,
    );
  }
}

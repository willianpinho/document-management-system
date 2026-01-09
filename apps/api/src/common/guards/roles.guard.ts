import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { ROLES_KEY, Role } from '../decorators/roles.decorator';
import type { CurrentUserPayload } from '../decorators/current-user.decorator';

// Define role hierarchy: higher roles include permissions of lower roles
const ROLE_HIERARCHY: Record<Role, number> = {
  [Role.VIEWER]: 1,
  [Role.EDITOR]: 2,
  [Role.ADMIN]: 3,
  [Role.OWNER]: 4,
};

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // No roles required, allow access
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user as CurrentUserPayload | undefined;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    const userRole = user.role as Role | undefined;
    if (!userRole) {
      throw new ForbiddenException('User has no role assigned');
    }

    // Check if user's role level is >= any of the required role levels
    const userRoleLevel = ROLE_HIERARCHY[userRole] || 0;
    const hasRequiredRole = requiredRoles.some((role) => {
      const requiredLevel = ROLE_HIERARCHY[role] || 0;
      return userRoleLevel >= requiredLevel;
    });

    if (!hasRequiredRole) {
      throw new ForbiddenException(
        `Insufficient permissions. Required: ${requiredRoles.join(' or ')}`,
      );
    }

    return true;
  }
}

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Request } from 'express';

import { PrismaService } from '../prisma/prisma.service';
import type { CurrentUserPayload } from '../decorators/current-user.decorator';

@Injectable()
export class OrganizationGuard implements CanActivate {
  private readonly logger = new Logger(OrganizationGuard.name);

  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const user = request.user as CurrentUserPayload | undefined;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    // Get organization ID from header or query param
    const organizationId =
      (request.headers['x-organization-id'] as string) ||
      (request.query.organizationId as string);

    if (!organizationId) {
      throw new ForbiddenException('Organization ID is required');
    }

    // Verify user belongs to organization
    const membership = await this.prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId,
          userId: user.id,
        },
      },
      include: {
        organization: true,
      },
    });

    if (!membership) {
      this.logger.warn(
        `User ${user.id} attempted to access organization ${organizationId} without membership`,
      );
      throw new ForbiddenException('You do not have access to this organization');
    }

    // Attach organization context to request
    (request.user as CurrentUserPayload).organizationId = organizationId;
    (request.user as CurrentUserPayload).role = membership.role;

    return true;
  }
}

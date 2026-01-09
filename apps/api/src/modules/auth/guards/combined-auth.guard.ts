import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';

import { IS_PUBLIC_KEY } from '@/common/decorators/public.decorator';

/**
 * Guard that accepts either JWT or API Key authentication
 */
@Injectable()
export class CombinedAuthGuard extends AuthGuard(['jwt', 'api-key']) {
  constructor(private reflector: Reflector) {
    super();
  }

  override canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    return super.canActivate(context);
  }

  override handleRequest<TUser>(err: Error | null, user: TUser, _info: Error | undefined): TUser {
    if (err || !user) {
      throw new UnauthorizedException('Authentication required (JWT or API Key)');
    }
    return user;
  }
}

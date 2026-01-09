import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class LocalAuthGuard extends AuthGuard('local') {
  override canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }

  override handleRequest<TUser>(err: Error | null, user: TUser, info: Error | undefined): TUser {
    if (err || !user) {
      throw new UnauthorizedException(info?.message || 'Invalid email or password');
    }
    return user;
  }
}

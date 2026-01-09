import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class ApiKeyAuthGuard extends AuthGuard('api-key') {
  override canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }

  override handleRequest<TUser>(err: Error | null, user: TUser, _info: Error | undefined): TUser {
    if (err || !user) {
      throw new UnauthorizedException('Invalid or expired API key');
    }
    return user;
  }
}

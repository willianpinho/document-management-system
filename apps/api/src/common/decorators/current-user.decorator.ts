import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

export interface CurrentUserPayload {
  id: string;
  email: string;
  organizationId?: string;
  role?: string;
}

export const CurrentUser = createParamDecorator(
  (data: keyof CurrentUserPayload | undefined, ctx: ExecutionContext): CurrentUserPayload | string | undefined => {
    const request = ctx.switchToHttp().getRequest<Request>();
    const user = request.user as CurrentUserPayload | undefined;

    if (!user) {
      return undefined;
    }

    return data ? user[data] : user;
  },
);

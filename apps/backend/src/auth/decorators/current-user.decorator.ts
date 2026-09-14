import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Role, TipoDispositivo } from '@prisma/client';

export interface UserPayload {
  sub: string;
  email: string;
  negocioId: string;
  role: Role;
  isDispositivo?: boolean;
  tipoDispositivo?: TipoDispositivo;
}

interface RequestWithUser {
  user: UserPayload;
}

export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): UserPayload => {
    const request = ctx.switchToHttp().getRequest<RequestWithUser>();
    return request.user;
  },
);

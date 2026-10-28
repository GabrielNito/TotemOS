import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Role, TipoDispositivo } from '@prisma/client';

export type PrincipalIdentity = 'USER' | 'DEVICE';

interface PrincipalBase {
  sub: string;
  email: string;
  negocioId: string;
}

export interface HumanUserPayload extends PrincipalBase {
  identity: 'USER';
  role: Role;
  isDispositivo: false;
  tipoDispositivo?: never;
}

export interface DeviceUserPayload extends PrincipalBase {
  identity: 'DEVICE';
  isDispositivo: true;
  tipoDispositivo: TipoDispositivo;
  role?: never;
}

export type UserPayload = HumanUserPayload | DeviceUserPayload;

interface RequestWithUser {
  user: UserPayload;
}

export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): UserPayload => {
    const request = ctx.switchToHttp().getRequest<RequestWithUser>();
    return request.user;
  },
);

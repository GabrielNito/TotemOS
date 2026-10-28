import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { TipoDispositivo } from '@prisma/client';
import { DEVICE_TYPES_KEY } from '../decorators/device-types.decorator';
import type { UserPayload } from '../decorators/current-user.decorator';

interface RequestWithUser {
  user?: UserPayload;
}

@Injectable()
export class DeviceTypeGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const allowedTypes = this.reflector.getAllAndOverride<TipoDispositivo[]>(
      DEVICE_TYPES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!allowedTypes?.length) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('Identidade não identificada');
    }

    if (user.identity === 'USER') {
      return true;
    }

    if (!user.tipoDispositivo || !allowedTypes.includes(user.tipoDispositivo)) {
      throw new ForbiddenException(
        'Tipo de dispositivo sem permissão para esta rota',
      );
    }

    return true;
  }
}

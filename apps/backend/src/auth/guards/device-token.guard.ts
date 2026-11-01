import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHmac } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import type { DeviceUserPayload } from '../decorators/current-user.decorator';

interface RequestWithUserAndHeaders {
  headers: Record<string, string | undefined>;
  user?: DeviceUserPayload;
}

@Injectable()
export class DeviceTokenGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<RequestWithUserAndHeaders>();
    const token = this.extractBearerToken(request.headers.authorization);
    const pepper = process.env.DEVICE_TOKEN_PEPPER;

    if (!pepper) {
      throw new UnauthorizedException('Falha de configuração do deviceToken');
    }

    const tokenHash = createHmac('sha256', pepper).update(token).digest('hex');
    const dispositivo = await this.prisma.dispositivo
      .findFirst({
        where: {
          tokenHash,
          ativo: true,
          revogadoEm: null,
        },
        select: {
          id: true,
          negocioId: true,
          tipo: true,
        },
      })
      .catch((error: unknown) => {
        if (
          error instanceof Prisma.PrismaClientInitializationError ||
          (error instanceof Prisma.PrismaClientKnownRequestError &&
            ['P1001', 'P1002', 'P1017', 'P2024', 'P2028'].includes(error.code))
        )
          throw new ServiceUnavailableException(
            'Persistência temporariamente indisponível.',
          );
        throw error;
      });

    if (!dispositivo) {
      throw new UnauthorizedException(
        'Token de dispositivo inválido, expirado ou revogado',
      );
    }

    const user: DeviceUserPayload = {
      sub: dispositivo.id,
      email: '',
      negocioId: dispositivo.negocioId,
      identity: 'DEVICE',
      isDispositivo: true,
      tipoDispositivo: dispositivo.tipo,
    };
    request.user = user;

    return true;
  }

  private extractBearerToken(authorization?: string): string {
    if (!authorization?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Token de dispositivo não fornecido');
    }

    const token = authorization.slice('Bearer '.length).trim();
    if (!token) {
      throw new UnauthorizedException('Token de dispositivo não fornecido');
    }

    return token;
  }
}

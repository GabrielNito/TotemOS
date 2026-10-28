import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import type {
  HumanUserPayload,
  PrincipalIdentity,
} from '../decorators/current-user.decorator';

interface UntrustedJwtPayload {
  sub?: string;
  email?: string;
  negocioId?: string;
  identity?: PrincipalIdentity;
  role?: Role;
  isDispositivo?: boolean;
}

interface RequestWithUserAndHeaders {
  headers: Record<string, string | undefined>;
  user?: HumanUserPayload;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<RequestWithUserAndHeaders>();
    const authHeader = request.headers['authorization'];

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Token de autenticação não fornecido');
    }

    const token = authHeader.split(' ')[1];
    const jwtSecret = process.env.JWT_SECRET;

    if (!jwtSecret) {
      throw new UnauthorizedException('Falha de configuração do servidor JWT');
    }

    try {
      const payload = await this.jwtService.verifyAsync<UntrustedJwtPayload>(
        token,
        {
          secret: jwtSecret,
        },
      );
      if (
        !payload.sub ||
        !payload.email ||
        !payload.negocioId ||
        !payload.role ||
        ![Role.DONO, Role.GERENTE].includes(payload.role) ||
        payload.identity === 'DEVICE' ||
        payload.isDispositivo
      ) {
        throw new UnauthorizedException('Identidade de usuário inválida');
      }

      request.user = {
        sub: payload.sub,
        email: payload.email,
        negocioId: payload.negocioId,
        identity: 'USER',
        isDispositivo: false,
        role: payload.role,
      };
      return true;
    } catch {
      throw new UnauthorizedException(
        'Token de autenticação inválido ou expirado',
      );
    }
  }
}

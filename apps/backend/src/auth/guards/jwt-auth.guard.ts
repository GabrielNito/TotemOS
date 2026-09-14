import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Optional,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { Role } from '@prisma/client';
import { UserPayload } from '../decorators/current-user.decorator';

interface RequestWithUserAndHeaders {
  headers: Record<string, string | undefined>;
  user?: UserPayload;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private jwtService: JwtService,
    @Optional() private prisma?: PrismaService,
  ) {}

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
      const payload = await this.jwtService.verifyAsync<UserPayload>(token, {
        secret: jwtSecret,
      });
      request.user = payload;
      return true;
    } catch {
      // Se não for JWT válido, verifica se é um token de dispositivo cadastrado
      if (this.prisma) {
        const dispositivo = await this.prisma.dispositivo.findUnique({
          where: { token },
        });

        if (dispositivo && dispositivo.ativo) {
          request.user = {
            sub: dispositivo.id,
            email: '',
            negocioId: dispositivo.negocioId,
            role: Role.GERENTE,
            isDispositivo: true,
            tipoDispositivo: dispositivo.tipo,
          };
          return true;
        }
      }

      throw new UnauthorizedException(
        'Token de autenticação inválido ou expirado',
      );
    }
  }
}

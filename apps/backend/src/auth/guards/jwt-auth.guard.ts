import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserPayload } from '../decorators/current-user.decorator';

interface RequestWithUserAndHeaders {
  headers: Record<string, string | undefined>;
  user?: UserPayload;
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
      const payload = await this.jwtService.verifyAsync<UserPayload>(token, {
        secret: jwtSecret,
      });
      request.user = payload;
      return true;
    } catch {
      throw new UnauthorizedException(
        'Token de autenticação inválido ou expirado',
      );
    }
  }
}

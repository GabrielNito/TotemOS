import {
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import {
  Prisma,
  Role,
  StatusCodigoPareamento,
  TipoDispositivo,
  ModoIdentificacao,
} from '@prisma/client';
import { createHash, createHmac, randomBytes, randomInt } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { GerarCodigoDto } from './dto/gerar-codigo.dto';

const PAIRING_CODE_TTL_MS = 15 * 60 * 1000;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_ATTEMPTS = 30;
const RATE_LIMIT_RETENTION_MS = 2 * 60 * 60 * 1000;
const MAX_CODE_GENERATION_ATTEMPTS = 10;
const SAFE_DEVICE_SELECT = {
  id: true,
  negocioId: true,
  nome: true,
  tipo: true,
  pareadoEm: true,
  ativo: true,
  revogadoEm: true,
  createdAt: true,
} satisfies Prisma.DispositivoSelect;

export interface SafeDevice {
  id: string;
  negocioId: string;
  nome: string;
  tipo: TipoDispositivo;
  pareadoEm: Date | null;
  ativo: boolean;
  revogadoEm: Date | null;
  createdAt: Date;
}

export interface ActivationResult {
  deviceToken: string;
  dispositivo: SafeDevice;
}

@Injectable()
export class DispositivosService implements OnModuleInit {
  constructor(private prisma: PrismaService) {}

  onModuleInit(): void {
    this.getRequiredSecret('PAIRING_CODE_PEPPER');
    this.getRequiredSecret('DEVICE_TOKEN_PEPPER');
  }

  async gerarCodigo(
    negocioId: string,
    criadoPorUsuarioId: string,
    dto: GerarCodigoDto,
  ) {
    const criador = await this.prisma.usuario.findFirst({
      where: {
        id: criadoPorUsuarioId,
        negocioId,
        role: Role.DONO,
      },
      select: { id: true },
    });

    if (!criador) {
      throw new ForbiddenException(
        'Usuário não pertence ao negócio ou não é DONO.',
      );
    }

    const pepper = this.getRequiredSecret('PAIRING_CODE_PEPPER');

    for (
      let attempt = 0;
      attempt < MAX_CODE_GENERATION_ATTEMPTS;
      attempt += 1
    ) {
      const codigo = randomInt(0, 1_000_000).toString().padStart(6, '0');
      const codigoHash = this.hashSecret(codigo, pepper);
      const criadoEm = new Date();
      const expiraEm = new Date(criadoEm.getTime() + PAIRING_CODE_TTL_MS);

      try {
        await this.prisma.$transaction(async (tx) => {
          await tx.codigoPareamento.updateMany({
            where: {
              status: StatusCodigoPareamento.ATIVO,
              expiraEm: { lte: criadoEm },
            },
            data: { status: StatusCodigoPareamento.EXPIRADO },
          });

          await tx.codigoPareamento.create({
            data: {
              negocioId,
              criadoPorUsuarioId,
              nome: dto.nome,
              tipo: dto.tipo,
              codigoHash,
              expiraEm,
              status: StatusCodigoPareamento.ATIVO,
            },
          });
        });

        return { codigo, expiraEm };
      } catch (error) {
        if (this.isPrismaError(error, 'P2002')) {
          continue;
        }
        throw error;
      }
    }

    throw new ConflictException(
      'Não foi possível gerar um código de pareamento. Tente novamente.',
    );
  }

  async ativar(codigo: string, ip: string): Promise<ActivationResult> {
    await this.verificarRateLimit(ip);

    const pepper = this.getRequiredSecret('PAIRING_CODE_PEPPER');
    const deviceTokenPepper = this.getRequiredSecret('DEVICE_TOKEN_PEPPER');
    const codigoHash = this.hashSecret(codigo, pepper);
    const agora = new Date();

    try {
      const result = await this.prisma.$transaction(
        async (tx): Promise<ActivationResult | null> => {
          const pairingCode = await tx.codigoPareamento.findFirst({
            where: {
              codigoHash,
              status: StatusCodigoPareamento.ATIVO,
            },
            orderBy: { createdAt: 'desc' },
          });

          if (!pairingCode) {
            return null;
          }

          if (pairingCode.expiraEm <= agora) {
            await tx.codigoPareamento.update({
              where: { id: pairingCode.id },
              data: { status: StatusCodigoPareamento.EXPIRADO },
            });
            return null;
          }

          const consumed = await tx.codigoPareamento.updateMany({
            where: {
              id: pairingCode.id,
              status: StatusCodigoPareamento.ATIVO,
              expiraEm: { gt: agora },
            },
            data: {
              status: StatusCodigoPareamento.CONSUMIDO,
              consumidoEm: agora,
            },
          });

          if (consumed.count !== 1) {
            return null;
          }

          const deviceToken = randomBytes(32).toString('base64url');
          const dispositivo = await tx.dispositivo.create({
            data: {
              negocioId: pairingCode.negocioId,
              nome: pairingCode.nome,
              tipo: pairingCode.tipo,
              tokenHash: this.hashSecret(deviceToken, deviceTokenPepper),
              pareadoEm: agora,
              ativo: true,
            },
            select: SAFE_DEVICE_SELECT,
          });

          return {
            deviceToken,
            dispositivo: this.toSafeDevice(dispositivo),
          };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );

      if (!result) {
        throw this.pairingUnavailable();
      }

      return result;
    } catch (error) {
      if (this.isPrismaError(error, 'P2034')) {
        throw new ConflictException({
          code: 'PAIRING_CODE_CONCURRENT_CONSUMPTION',
          message: 'O código está sendo ativado por outra requisição.',
        });
      }
      throw error;
    }
  }

  async listar(negocioId: string) {
    const dispositivos = await this.prisma.dispositivo.findMany({
      where: { negocioId },
      orderBy: { createdAt: 'desc' },
      select: SAFE_DEVICE_SELECT,
    });

    return {
      dispositivos: dispositivos.map((device) => this.toSafeDevice(device)),
    };
  }

  async revogar(negocioId: string, id: string): Promise<void> {
    const result = await this.prisma.dispositivo.updateMany({
      where: {
        id,
        negocioId,
        ativo: true,
      },
      data: {
        ativo: false,
        revogadoEm: new Date(),
      },
    });

    if (result.count !== 1) {
      throw new NotFoundException('Dispositivo não encontrado');
    }
  }

  async me(negocioId: string, id: string) {
    const dispositivo = await this.prisma.dispositivo.findFirst({
      where: { id, negocioId, ativo: true, revogadoEm: null },
      select: {
        ...SAFE_DEVICE_SELECT,
        mpPointDeviceId: true,
        negocio: {
          select: {
            id: true,
            nome: true,
            config: {
              select: { modoIdentificacao: true, mensagemBoasVindas: true },
            },
          },
        },
      },
    });

    if (!dispositivo || dispositivo.negocio.id !== negocioId) {
      throw new UnauthorizedException('Dispositivo inválido ou revogado');
    }

    return {
      dispositivo: this.toSafeDevice(dispositivo),
      negocio: {
        id: dispositivo.negocio.id,
        nome: dispositivo.negocio.nome,
        modoIdentificacao:
          dispositivo.negocio.config?.modoIdentificacao ??
          ModoIdentificacao.OPCIONAL,
        mensagemBoasVindas:
          dispositivo.negocio.config?.mensagemBoasVindas ?? null,
        pagamentoPointConfigurado: Boolean(dispositivo.mpPointDeviceId),
      },
    };
  }

  private async verificarRateLimit(ip: string): Promise<void> {
    const agora = Date.now();
    const janelaInicio = new Date(
      Math.floor(agora / RATE_LIMIT_WINDOW_MS) * RATE_LIMIT_WINDOW_MS,
    );
    const chave = createHash('sha256')
      .update(`device-pairing:${ip}:${janelaInicio.toISOString()}`)
      .digest('hex');

    await this.prisma.pareamentoRateLimit.deleteMany({
      where: {
        janelaInicio: {
          lt: new Date(agora - RATE_LIMIT_RETENTION_MS),
        },
      },
    });

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const bucket = await this.prisma.pareamentoRateLimit.upsert({
          where: { chave },
          create: { chave, janelaInicio, tentativas: 1 },
          update: { tentativas: { increment: 1 } },
        });

        if (bucket.tentativas > RATE_LIMIT_MAX_ATTEMPTS) {
          throw this.rateLimitExceeded();
        }

        return;
      } catch (error) {
        if (error instanceof HttpException && error.getStatus() === 429) {
          throw error;
        }
        if (!this.isPrismaError(error, 'P2002')) {
          throw error;
        }
      }
    }

    throw this.rateLimitExceeded();
  }

  private pairingUnavailable(): UnauthorizedException {
    return new UnauthorizedException({
      code: 'PAIRING_CODE_UNAVAILABLE',
      message: 'Código de pareamento inválido, expirado ou já utilizado.',
    });
  }

  private getRequiredSecret(
    name: 'PAIRING_CODE_PEPPER' | 'DEVICE_TOKEN_PEPPER',
  ) {
    const secret = process.env[name];
    if (!secret) {
      throw new Error(`Configuração crítica ausente: ${name}`);
    }
    return secret;
  }

  private hashSecret(value: string, pepper: string): string {
    return createHmac('sha256', pepper).update(value).digest('hex');
  }

  private isPrismaError(error: unknown, code: string): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === code
    );
  }

  private rateLimitExceeded(): HttpException {
    return new HttpException(
      'Muitas tentativas de ativação. Tente novamente em instantes.',
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }

  private toSafeDevice(device: {
    id: string;
    negocioId: string;
    nome: string;
    tipo: TipoDispositivo;
    pareadoEm: Date | null;
    ativo: boolean;
    revogadoEm: Date | null;
    createdAt: Date;
  }): SafeDevice {
    return {
      id: device.id,
      negocioId: device.negocioId,
      nome: device.nome,
      tipo: device.tipo,
      pareadoEm: device.pareadoEm,
      ativo: device.ativo,
      revogadoEm: device.revogadoEm,
      createdAt: device.createdAt,
    };
  }
}

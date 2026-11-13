import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { ModoIdentificacao, Prisma, Role } from '@prisma/client';
import type { UserPayload } from '../auth/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import {
  AtualizarConfiguracaoNegocioDto,
  ConfiguracaoNegocioResponseDto,
} from './dto/configuracao-negocio.dto';

const DEFAULT_TEMPO_PREPARO = 15;
const TRANSIENT_TX_RETRY_LIMIT = 3;

function isConnectionError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientInitializationError ||
    (error instanceof Prisma.PrismaClientKnownRequestError &&
      ['P1001', 'P1002', 'P1017', 'P2024', 'P2028'].includes(error.code))
  );
}

function isTransientConflictError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === 'P2034' ||
      (error.code === 'P2010' &&
        ['40001', '40P01'].includes(String(error.meta?.code))))
  );
}

@Injectable()
export class ConfiguracoesService {
  constructor(private readonly prisma: PrismaService) {}

  async obter(user: UserPayload): Promise<ConfiguracaoNegocioResponseDto> {
    if (
      user.identity !== 'USER' ||
      user.isDispositivo ||
      ![Role.DONO, Role.GERENTE].includes(user.role)
    ) {
      throw new ForbiddenException(
        'Leitura exclusiva para DONO ou GERENTE do estabelecimento.',
      );
    }

    try {
      const usuario = await this.prisma.usuario.findFirst({
        where: {
          id: user.sub,
          negocioId: user.negocioId,
          role: user.role,
        },
        select: { id: true },
      });

      if (!usuario) {
        throw new ForbiddenException(
          'Vínculo humano inválido ou perfil alterado.',
        );
      }

      const negocio = await this.prisma.negocio.findUnique({
        where: { id: user.negocioId },
        select: {
          id: true,
          config: {
            select: {
              modoIdentificacao: true,
              tempoPadraoPreparo: true,
              mensagemBoasVindas: true,
            },
          },
        },
      });

      if (!negocio) {
        throw new NotFoundException('Negócio não encontrado.');
      }

      return this.formatarResposta(negocio.id, negocio.config);
    } catch (error) {
      if (isConnectionError(error)) {
        throw new ServiceUnavailableException(
          'Persistência temporariamente indisponível.',
        );
      }
      throw error;
    }
  }

  async atualizar(
    user: UserPayload,
    dto: AtualizarConfiguracaoNegocioDto,
  ): Promise<ConfiguracaoNegocioResponseDto> {
    if (
      user.identity !== 'USER' ||
      user.isDispositivo ||
      user.role !== Role.DONO
    ) {
      throw new ForbiddenException(
        'Apenas o DONO do estabelecimento pode alterar configurações.',
      );
    }

    for (let attempt = 0; attempt < TRANSIENT_TX_RETRY_LIMIT; attempt++) {
      try {
        return await this.prisma.$transaction(
          async (tx) => {
            const usuarios = await tx.$queryRaw<
              { id: string }[]
            >`SELECT "id" FROM "Usuario" WHERE "id" = ${user.sub} AND "negocioId" = ${user.negocioId} AND "role" = 'DONO'::"Role" FOR UPDATE`;

            if (!usuarios.length) {
              throw new ForbiddenException(
                'Apenas o DONO ativo do estabelecimento pode alterar configurações.',
              );
            }

            const negocios = await tx.$queryRaw<
              { id: string; pinDonoHash: string | null }[]
            >`SELECT "id", "pinDonoHash" FROM "Negocio" WHERE "id" = ${user.negocioId} FOR UPDATE`;

            if (!negocios.length) {
              throw new NotFoundException('Negócio não encontrado.');
            }

            const pinHash = negocios[0].pinDonoHash;
            const pinValido =
              typeof pinHash === 'string' && pinHash.length > 0
                ? await bcrypt.compare(dto.pin, pinHash)
                : false;

            if (!pinValido) {
              throw new UnauthorizedException('PIN do dono inválido.');
            }

            const configAtualizada = await tx.negocioConfig.upsert({
              where: { negocioId: user.negocioId },
              create: {
                negocioId: user.negocioId,
                modoIdentificacao:
                  dto.modoIdentificacao ?? ModoIdentificacao.OPCIONAL,
                tempoPadraoPreparo:
                  dto.tempoPadraoPreparo ?? DEFAULT_TEMPO_PREPARO,
                mensagemBoasVindas: dto.mensagemBoasVindas ?? null,
                permitirPagamentoOffline: false,
              },
              update: {
                ...(dto.modoIdentificacao !== undefined && {
                  modoIdentificacao: dto.modoIdentificacao,
                }),
                ...(dto.tempoPadraoPreparo !== undefined && {
                  tempoPadraoPreparo: dto.tempoPadraoPreparo,
                }),
                ...(dto.mensagemBoasVindas !== undefined && {
                  mensagemBoasVindas: dto.mensagemBoasVindas,
                }),
                permitirPagamentoOffline: false,
              },
              select: {
                modoIdentificacao: true,
                tempoPadraoPreparo: true,
                mensagemBoasVindas: true,
              },
            });

            return this.formatarResposta(user.negocioId, configAtualizada);
          },
          { maxWait: 5000, timeout: 10000 },
        );
      } catch (error) {
        if (isConnectionError(error)) {
          throw new ServiceUnavailableException(
            'Persistência temporariamente indisponível.',
          );
        }
        if (!isTransientConflictError(error)) {
          throw error;
        }
        if (attempt === TRANSIENT_TX_RETRY_LIMIT - 1) {
          throw new ServiceUnavailableException(
            'Conflito transitório ao salvar configurações. Tente novamente.',
          );
        }
      }
    }

    throw new ServiceUnavailableException(
      'Não foi possível salvar as configurações.',
    );
  }

  private formatarResposta(
    negocioId: string,
    config: {
      modoIdentificacao: ModoIdentificacao;
      tempoPadraoPreparo: number;
      mensagemBoasVindas: string | null;
    } | null,
  ): ConfiguracaoNegocioResponseDto {
    // Flag legada permanece marcada como não operacional até existir serviço efetivo de pagamento offline.
    return {
      negocioId,
      modoIdentificacao:
        config?.modoIdentificacao ?? ModoIdentificacao.OPCIONAL,
      tempoPadraoPreparo: config?.tempoPadraoPreparo ?? DEFAULT_TEMPO_PREPARO,
      mensagemBoasVindas: config?.mensagemBoasVindas ?? null,
      permitirPagamentoOffline: false,
      pagamentoOfflineOperacional: false,
      pagamentoOfflineStatus: 'NAO_OPERACIONAL',
    };
  }
}

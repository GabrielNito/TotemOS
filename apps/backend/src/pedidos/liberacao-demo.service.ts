import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import * as bcrypt from 'bcryptjs';
import { Prisma, Role, StatusPedido } from '@prisma/client';
import { z } from 'zod';
import { PrismaService } from '../prisma/prisma.service';
import type { UserPayload } from '../auth/decorators/current-user.decorator';
import { demoEnvironmentFor } from './demo-policy';
import { LiberacaoDemoDto } from './dto/liberacao-demo.dto';

@Injectable()
export class LiberacaoDemoService {
  constructor(private readonly prisma: PrismaService) {}

  async liberar(
    user: UserPayload,
    pedidoId: string,
    dto: LiberacaoDemoDto,
    key?: string,
  ) {
    if (user.identity !== 'USER' || user.role !== Role.DONO)
      throw new ForbiddenException(
        'Somente um usuário DONO pode liberar DEMO.',
      );
    const ambiente = demoEnvironmentFor(user.negocioId);
    if (!ambiente)
      throw new ForbiddenException(
        'Liberação DEMO desabilitada neste ambiente ou negócio.',
      );
    if (!z.string().uuid().safeParse(key).success)
      throw new BadRequestException('Idempotency-Key deve ser um UUID.');
    const idempotencyKey = key!;
    const payloadHash = createHash('sha256')
      .update(
        JSON.stringify({
          pedidoId,
          motivo: dto.motivo,
          versaoEsperada: dto.versaoEsperada,
        }),
      )
      .digest('hex');
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await this.prisma.$transaction(
          async (tx) => {
            // Serialize with owner role changes/deletion, before locking the order.
            const owners = await tx.$queryRaw<{ id: string }[]>`
            SELECT "id" FROM "Usuario" WHERE "id" = ${user.sub} AND "negocioId" = ${user.negocioId} AND "role" = 'DONO' FOR UPDATE
          `;
            if (!owners.length)
              throw new ForbiddenException(
                'Vínculo DONO não está mais autorizado.',
              );
            const negocio = await tx.negocio.findFirst({
              where: { id: user.negocioId },
              select: { pinDonoHash: true },
            });
            if (
              !negocio ||
              !(await bcrypt.compare(dto.pin, negocio.pinDonoHash))
            )
              throw new UnauthorizedException('PIN do dono incorreto.');
            const locked = await tx.$queryRaw<{ id: string }[]>`
            SELECT "id" FROM "Pedido" WHERE "id" = ${pedidoId} AND "negocioId" = ${user.negocioId} FOR UPDATE
          `;
            if (!locked.length)
              throw new NotFoundException('Pedido não encontrado.');
            const pedido = await tx.pedido.findFirst({
              where: { id: pedidoId, negocioId: user.negocioId },
              include: {
                pagamentos: {
                  where: { pedido: { negocioId: user.negocioId } },
                  select: { id: true },
                },
                liberacaoDemo: { where: { negocioId: user.negocioId } },
              },
            });
            if (!pedido) throw new NotFoundException('Pedido não encontrado.');
            if (
              !pedido.demo ||
              pedido.demoAmbiente !== ambiente ||
              pedido.pagamentos.length
            )
              throw new ConflictException(
                'Pedido não é DEMO deste ambiente ou possui tentativa financeira.',
              );
            const replay = await tx.liberacaoDemo.findFirst({
              where: {
                negocioId: user.negocioId,
                usuarioId: user.sub,
                idempotencyKey,
              },
            });
            if (demoEnvironmentFor(user.negocioId) !== ambiente)
              throw new ForbiddenException(
                'Configuração DEMO alterada durante a operação.',
              );
            if (replay) {
              if (
                replay.pedidoId !== pedidoId ||
                replay.payloadHash !== payloadHash
              )
                throw new ConflictException(
                  'Chave de idempotência já utilizada com outro conteúdo.',
                );
              return this.response(pedido, true);
            }
            if (
              pedido.liberacaoDemo ||
              pedido.status !== StatusPedido.AGUARDANDO_PAGAMENTO ||
              pedido.senha !== null ||
              pedido.versao !== dto.versaoEsperada
            )
              throw new ConflictException(
                'Estado ou versão incompatível com a liberação DEMO.',
              );
            const status = pedido.preparoZero
              ? StatusPedido.PRONTO
              : StatusPedido.PENDENTE;
            const increment = pedido.preparoZero ? 2 : 1;
            const updated = await tx.pedido.updateMany({
              where: {
                id: pedidoId,
                negocioId: user.negocioId,
                demo: true,
                demoAmbiente: ambiente,
                status: StatusPedido.AGUARDANDO_PAGAMENTO,
                versao: dto.versaoEsperada,
                senha: null,
                pagamentos: { none: {} },
              },
              data: { status, versao: { increment } },
            });
            if (updated.count !== 1)
              throw new ConflictException(
                'Pedido alterado por outra operação.',
              );
            await tx.liberacaoDemo.create({
              data: {
                negocioId: user.negocioId,
                pedidoId,
                usuarioId: user.sub,
                idempotencyKey,
                payloadHash,
                motivo: dto.motivo,
                ambiente,
                versaoAnterior: pedido.versao,
                versaoLiberada: pedido.versao + increment,
                transicoes: [
                  StatusPedido.AGUARDANDO_PAGAMENTO,
                  StatusPedido.PENDENTE,
                  ...(pedido.preparoZero ? [StatusPedido.PRONTO] : []),
                ],
              },
            });
            return this.response(
              { ...pedido, status, versao: pedido.versao + increment },
              false,
            );
          },
          { maxWait: 5000, timeout: 10000 },
        );
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientInitializationError ||
          (error instanceof Prisma.PrismaClientKnownRequestError &&
            ['P1001', 'P1002', 'P1017', 'P2024', 'P2028'].includes(error.code))
        ) {
          // An uncertain result must be recovered by the client's persisted key.
          throw new ServiceUnavailableException(
            'Persistência temporariamente indisponível. Repita a mesma chave.',
          );
        }
        if (
          !(error instanceof Prisma.PrismaClientKnownRequestError) ||
          !['P2034', 'P2010'].includes(error.code) ||
          (error.code === 'P2010' &&
            !['40001', '40P01'].includes(String(error.meta?.code)))
        )
          throw error;
        if (attempt === 2)
          throw new ServiceUnavailableException(
            'Operação temporariamente indisponível. Repita a mesma chave.',
          );
        await new Promise((resolve) =>
          setTimeout(resolve, 20 + Math.random() * 30),
        );
      }
    }
    throw new ServiceUnavailableException('Liberação indisponível.');
  }

  private response(
    pedido: {
      id: string;
      status: StatusPedido;
      senha: number | null;
      versao: number;
      demoAmbiente: string | null;
    },
    repetida: boolean,
  ) {
    return {
      resultadoOperacao: { tipo: 'LIBERACAO_DEMO' as const, repetida },
      pedido: {
        id: pedido.id,
        status: pedido.status,
        senha: pedido.senha,
        versao: pedido.versao,
        demo: true as const,
        demoAmbiente: pedido.demoAmbiente!,
        elegivelCozinha: (
          [
            StatusPedido.PENDENTE,
            StatusPedido.EM_PREPARO,
            StatusPedido.PRONTO,
          ] as StatusPedido[]
        ).includes(pedido.status),
        autorizacaoOperacional: {
          tipo: 'DEMO' as const,
          financeira: false as const,
        },
      },
    };
  }
}

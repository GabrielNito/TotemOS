import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma, type Pedido } from '@prisma/client';
import { z } from 'zod';
import { PrismaService } from '../prisma/prisma.service';
import type { UserPayload } from '../auth/decorators/current-user.decorator';
import { autorizacaoCozinhaWhere } from './operacao-pedidos.service';
import { demoEnvironmentFor } from './demo-policy';

@Injectable()
export class SenhaPedidoService {
  constructor(private readonly prisma: PrismaService) {}

  // Relógio consultado somente depois do lock do pedido. A substituição nos
  // testes usa SQL no banco isolado, nunca entrada HTTP ou configuração cliente.
  protected async instante(tx: Prisma.TransactionClient) {
    const [row] = await tx.$queryRaw<{ instante: Date; dia: string }[]>`
      SELECT t AS instante,
        to_char(t AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD') AS dia
      FROM (SELECT clock_timestamp() AS t) clock`;
    return row;
  }

  async atribuir(user: UserPayload, id: string, key?: string) {
    if (user.identity !== 'DEVICE' || user.tipoDispositivo !== 'PAINEL')
      throw new ForbiddenException('Somente PAINEL pode solicitar senha.');
    const parsed = z.string().uuid().safeParse(key);
    if (!parsed.success)
      throw new BadRequestException('Idempotency-Key deve ser UUID.');
    const scope = {
      negocioId: user.negocioId,
      atorId: user.sub,
      idempotencyKey: parsed.data.toLowerCase(),
    };
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await this.prisma.$transaction(
          async (tx) => {
            const devices = await tx.$queryRaw<{ id: string }[]>`
            SELECT "id" FROM "Dispositivo"
            WHERE "id" = ${user.sub} AND "negocioId" = ${user.negocioId}
              AND "tipo" = 'PAINEL' AND "ativo" = true AND "revogadoEm" IS NULL
            FOR UPDATE`;
            if (!devices.length)
              throw new UnauthorizedException('PAINEL revogado ou inativo.');
            await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${JSON.stringify({ operacao: 'SENHA', ...scope })}, 0))::text`;
            const locked = await tx.$queryRaw<{ id: string }[]>`
            SELECT "id" FROM "Pedido" WHERE "id" = ${id} AND "negocioId" = ${user.negocioId} FOR UPDATE`;
            if (!locked.length)
              throw new NotFoundException('Pedido não encontrado.');
            const pedido = await tx.pedido.findFirstOrThrow({
              where: { id, negocioId: user.negocioId },
            });
            const replay = await tx.atribuicaoSenha.findFirst({ where: scope });
            if (replay && replay.pedidoId !== id)
              throw new ConflictException('Chave usada para outro pedido.');
            // Inclusive replays exigem a política operacional vigente, como #30.
            const autorizado = await tx.pedido.findFirst({
              where: { id, ...autorizacaoCozinhaWhere(user.negocioId) },
              select: { id: true },
            });
            if (!autorizado)
              throw new ConflictException(
                'Pedido sem autorização operacional válida.',
              );
            if (replay) return this.response(pedido, true);
            let saved = pedido;
            if (pedido.senha === null) {
              if (!['PENDENTE', 'EM_PREPARO', 'PRONTO'].includes(pedido.status))
                throw new ConflictException('Pedido inelegível para senha.');
              const { instante, dia } = await this.instante(tx);
              // UPSERT protege a inicialização concorrente. MAX inclui histórico
              // cancelado; a segunda instrução lê commits após esperar o contador.
              await tx.$executeRaw`
              INSERT INTO "ContadorSenha" ("negocioId", "dataOperacional", "ultimoNumero")
              SELECT ${user.negocioId}, ${dia}, COALESCE(MAX("senha"), 0)
              FROM "Pedido" WHERE "negocioId" = ${user.negocioId} AND "dataSequencial" = ${dia}
              ON CONFLICT ("negocioId", "dataOperacional") DO NOTHING`;
              await tx.$queryRaw`SELECT "ultimoNumero" FROM "ContadorSenha" WHERE "negocioId" = ${user.negocioId} AND "dataOperacional" = ${dia} FOR UPDATE`;
              const [counter] = await tx.$queryRaw<{ ultimoNumero: number }[]>`
              UPDATE "ContadorSenha" SET "ultimoNumero" = GREATEST("ultimoNumero",
                (SELECT COALESCE(MAX("senha"), 0) FROM "Pedido" WHERE "negocioId" = ${user.negocioId} AND "dataSequencial" = ${dia})) + 1
              WHERE "negocioId" = ${user.negocioId} AND "dataOperacional" = ${dia}
              RETURNING "ultimoNumero"`;
              await tx.pedido.updateMany({
                where: { id, negocioId: user.negocioId, senha: null },
                data: {
                  senha: counter.ultimoNumero,
                  dataSequencial: dia,
                  senhaAtribuidaEm: instante,
                  versao: { increment: 1 },
                },
              });
              saved = await tx.pedido.findFirstOrThrow({
                where: { id, negocioId: user.negocioId },
              });
            }
            await tx.atribuicaoSenha.create({
              data: {
                ...scope,
                pedidoId: id,
                senha: saved.senha!,
                dataOperacional: saved.dataSequencial,
                versaoAnterior: pedido.versao,
                versaoNova: saved.versao,
                primeiraAtribuicao: pedido.senha === null,
              },
            });
            if (demoEnvironmentFor(user.negocioId) !== pedido.demoAmbiente)
              throw new ConflictException('Configuração DEMO alterada.');
            return this.response(saved, pedido.senha !== null);
          },
          {
            maxWait: 5000,
            timeout: 10000,
            isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
          },
        );
      } catch (error) {
        const known = error instanceof Prisma.PrismaClientKnownRequestError;
        const sqlCode = known ? String(error.meta?.code) : '';
        const retry =
          known &&
          (error.code === 'P2034' ||
            (error.code === 'P2010' && ['40001', '40P01'].includes(sqlCode)));
        if (retry && attempt < 2) {
          await new Promise((resolve) =>
            setTimeout(resolve, 10 + Math.random() * 30),
          );
          continue;
        }
        if (
          retry ||
          error instanceof Prisma.PrismaClientInitializationError ||
          (known &&
            (['P1001', 'P1002', 'P1008', 'P1017', 'P2024', 'P2028'].includes(
              error.code,
            ) ||
              (error.code === 'P2010' &&
                ['08000', '08003', '08006', '57P01', '53300', '55P03'].includes(
                  sqlCode,
                ))))
        )
          throw new ServiceUnavailableException(
            'Persistência indisponível. Repita a mesma chave.',
          );
        throw error;
      }
    }
    throw new ServiceUnavailableException(
      'Senha temporariamente indisponível.',
    );
  }

  private response(p: Pedido, repetida: boolean) {
    return {
      resultadoOperacao: { tipo: 'ATRIBUICAO_SENHA' as const, repetida },
      pedido: {
        id: p.id,
        status: p.status,
        senha: p.senha!,
        dataOperacional: p.dataSequencial,
        versao: p.versao,
        demo: p.demo,
      },
    };
  }
}

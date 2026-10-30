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
import { Prisma, Role, StatusPedido, TipoDispositivo } from '@prisma/client';
import { z } from 'zod';
import { PrismaService } from '../prisma/prisma.service';
import type { UserPayload } from '../auth/decorators/current-user.decorator';
import { demoEnvironmentFor } from './demo-policy';
import { FilaQueryDto, TransicaoPedidoDto } from './dto/operacao-pedido.dto';
import type { ListarPedidosFiltro } from './pedidos.service';

const abertos: StatusPedido[] = ['PENDENTE', 'EM_PREPARO', 'PRONTO'];
// P0 possui autorização DEMO. Pagamento/offline/mesa precisam de evidência
// própria em seus contratos; status sozinho nunca concede autorização.
export function autorizacaoCozinhaWhere(
  negocioId: string,
): Prisma.PedidoWhereInput {
  const ambiente = demoEnvironmentFor(negocioId);
  if (!ambiente) return { negocioId, id: { in: [] } };
  return {
    negocioId,
    demo: true,
    demoAmbiente: ambiente,
    pagamentos: { none: {} },
    liberacaoDemo: { is: { negocioId, ambiente } },
  };
}
export function filaWhere(negocioId: string): Prisma.PedidoWhereInput {
  return {
    AND: [autorizacaoCozinhaWhere(negocioId), { status: { in: abertos } }],
  };
}
export const filaSelect = {
  id: true,
  status: true,
  senha: true,
  versao: true,
  demo: true,
  demoAmbiente: true,
  createdAt: true,
  preparoZero: true,
  itens: {
    select: {
      nomeProduto: true,
      quantidade: true,
      variacaoNome: true,
      observacao: true,
      adicionais: { select: { nomeAdicional: true, quantidade: true } },
      escolhas: { select: { nomeItem: true } },
    },
  },
} satisfies Prisma.PedidoSelect;

@Injectable()
export class OperacaoPedidosService {
  constructor(private readonly prisma: PrismaService) {}

  private async ler<T>(operation: PromiseLike<T>): Promise<T> {
    try {
      return await operation;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientInitializationError ||
        (error instanceof Prisma.PrismaClientKnownRequestError &&
          ['P1001', 'P1002', 'P1017', 'P2024', 'P2028'].includes(error.code))
      )
        throw new ServiceUnavailableException(
          'Persistência temporariamente indisponível.',
        );
      throw error;
    }
  }
  async listarLegado(user: UserPayload, filtro: ListarPedidosFiltro) {
    this.permitir(user);
    return this.ler(
      this.prisma.pedido.findMany({
        where: {
          AND: [
            filaWhere(user.negocioId),
            {
              negocioId: user.negocioId,
              ...(filtro.status && { status: filtro.status }),
              ...(filtro.dataSequencial && {
                dataSequencial: filtro.dataSequencial,
              }),
            },
          ],
        },
        select: filaSelect,
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      }),
    );
  }
  async detalharLegado(user: UserPayload, id: string) {
    this.permitir(user);
    const p = await this.ler(
      this.prisma.pedido.findFirst({
        where: {
          AND: [{ id, negocioId: user.negocioId }, filaWhere(user.negocioId)],
        },
        select: filaSelect,
      }),
    );
    if (!p) throw new NotFoundException('Pedido não encontrado.');
    return p;
  }

  private permitir(user: UserPayload) {
    if (
      user.identity === 'DEVICE'
        ? user.tipoDispositivo !== TipoDispositivo.PAINEL
        : ![Role.DONO, Role.GERENTE].includes(user.role)
    )
      throw new ForbiddenException(
        'Ação exclusiva de PAINEL, DONO ou GERENTE.',
      );
  }
  private async revalidar(tx: Prisma.TransactionClient, user: UserPayload) {
    if (user.identity === 'DEVICE') {
      const rows = await tx.$queryRaw<
        { id: string }[]
      >`SELECT "id" FROM "Dispositivo" WHERE "id" = ${user.sub} AND "negocioId" = ${user.negocioId} AND "tipo" = 'PAINEL' AND "ativo" = true AND "revogadoEm" IS NULL FOR UPDATE`;
      if (!rows.length)
        throw new UnauthorizedException('PAINEL revogado ou inativo.');
    } else {
      const rows = await tx.$queryRaw<
        { id: string }[]
      >`SELECT "id" FROM "Usuario" WHERE "id" = ${user.sub} AND "negocioId" = ${user.negocioId} AND "role" = ${user.role}::"Role" FOR UPDATE`;
      if (!rows.length)
        throw new ForbiddenException('Vínculo humano alterado.');
    }
  }
  async transicionar(
    user: UserPayload,
    id: string,
    dto: TransicaoPedidoDto,
    key?: string,
  ) {
    this.permitir(user);
    if (!z.string().uuid().safeParse(key).success)
      throw new BadRequestException('Idempotency-Key deve ser UUID.');
    const payloadHash = createHash('sha256')
      .update(
        JSON.stringify({
          id,
          status: dto.status,
          versaoEsperada: dto.versaoEsperada,
        }),
      )
      .digest('hex');
    const scope = {
      negocioId: user.negocioId,
      identidade: user.identity,
      atorId: user.sub,
      idempotencyKey: key!,
    };
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await this.prisma.$transaction(
          async (tx) => {
            await this.revalidar(tx, user);
            // Serializa mesma chave inclusive para pedidos distintos.
            await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${JSON.stringify(scope)}, 0))::text`;
            const locked = await tx.$queryRaw<
              { id: string }[]
            >`SELECT "id" FROM "Pedido" WHERE "id" = ${id} AND "negocioId" = ${user.negocioId} FOR UPDATE`;
            if (!locked.length)
              throw new NotFoundException('Pedido não encontrado.');
            const pedido = await tx.pedido.findFirstOrThrow({
              where: { id, negocioId: user.negocioId },
            });
            const autorizado = await tx.pedido.findFirst({
              where: { id, ...autorizacaoCozinhaWhere(user.negocioId) },
              select: { id: true },
            });
            if (!autorizado)
              throw new ConflictException(
                'Pedido sem autorização operacional válida.',
              );
            const replay = await tx.transicaoPedido.findFirst({ where: scope });
            if (replay) {
              if (replay.pedidoId !== id || replay.payloadHash !== payloadHash)
                throw new ConflictException('Chave usada com outro conteúdo.');
              if (demoEnvironmentFor(user.negocioId) !== pedido.demoAmbiente)
                throw new ConflictException('Configuração DEMO alterada.');
              return this.response(pedido, true);
            }
            const destinos: Partial<Record<StatusPedido, StatusPedido>> = {
              PENDENTE: 'EM_PREPARO',
              EM_PREPARO: 'PRONTO',
              PRONTO: 'ENTREGUE',
            };
            if (
              pedido.versao !== dto.versaoEsperada ||
              pedido.senha === null ||
              destinos[pedido.status] !== dto.status ||
              (pedido.preparoZero && pedido.status !== 'PRONTO')
            )
              throw new ConflictException(
                'Versão, senha ou transição incompatível.',
              );
            const updated = await tx.pedido.updateMany({
              where: {
                AND: [
                  {
                    id,
                    negocioId: user.negocioId,
                    status: pedido.status,
                    versao: dto.versaoEsperada,
                  },
                  autorizacaoCozinhaWhere(user.negocioId),
                ],
              },
              data: { status: dto.status, versao: { increment: 1 } },
            });
            if (updated.count !== 1)
              throw new ConflictException(
                'Pedido alterado por outra operação.',
              );
            await tx.transicaoPedido.create({
              data: {
                ...scope,
                pedidoId: id,
                payloadHash,
                statusAnterior: pedido.status,
                statusNovo: dto.status,
                versaoAnterior: pedido.versao,
                versaoNova: pedido.versao + 1,
              },
            });
            if (demoEnvironmentFor(user.negocioId) !== pedido.demoAmbiente)
              throw new ConflictException('Configuração DEMO alterada.');
            return this.response(
              { ...pedido, status: dto.status, versao: pedido.versao + 1 },
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
        )
          throw new ServiceUnavailableException(
            'Persistência indisponível. Repita a mesma chave.',
          );
        if (
          !(error instanceof Prisma.PrismaClientKnownRequestError) ||
          !(
            error.code === 'P2034' ||
            (error.code === 'P2010' &&
              ['40001', '40P01'].includes(String(error.meta?.code)))
          )
        )
          throw error;
        if (attempt === 2)
          throw new ServiceUnavailableException(
            'Conflito transitório. Repita a mesma chave.',
          );
      }
    }
    throw new ServiceUnavailableException('Transição indisponível.');
  }
  private response(
    p: {
      id: string;
      status: StatusPedido;
      senha: number | null;
      versao: number;
      demo: boolean;
      demoAmbiente: string | null;
    },
    repetida: boolean,
  ) {
    return {
      resultadoOperacao: { tipo: 'TRANSICAO' as const, repetida },
      pedido: {
        id: p.id,
        status: p.status,
        senha: p.senha,
        versao: p.versao,
        demo: p.demo,
        demoAmbiente: p.demoAmbiente,
        elegivelCozinha: abertos.includes(p.status),
      },
    };
  }
  async fila(user: UserPayload, query: FilaQueryDto) {
    this.permitir(user);
    let after: Prisma.PedidoWhereInput = {};
    if (query.cursor) {
      const parsed = z
        .object({
          negocioId: z.string().uuid(),
          id: z.string().uuid(),
          createdAt: z.string().datetime(),
        })
        .strict()
        .safeParse(
          (() => {
            try {
              return JSON.parse(
                Buffer.from(query.cursor, 'base64url').toString(),
              ) as unknown;
            } catch {
              return null;
            }
          })(),
        );
      if (!parsed.success || parsed.data.negocioId !== user.negocioId)
        throw new BadRequestException('Cursor inválido.');
      const c = parsed.data;
      const date = new Date(c.createdAt);
      after = {
        OR: [
          { createdAt: { gt: date } },
          { createdAt: date, id: { gt: c.id } },
        ],
      };
    }
    const rows = await this.ler(
      this.prisma.pedido.findMany({
        where: { AND: [filaWhere(user.negocioId), after] },
        select: filaSelect,
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        take: query.limite + 1,
      }),
    );
    const more = rows.length > query.limite;
    const pedidos = rows.slice(0, query.limite).map((p) => ({
      ...p,
      createdAt: p.createdAt.toISOString(),
      elegivelCozinha: true as const,
      autorizacaoOperacional: {
        tipo: 'DEMO' as const,
        financeira: false as const,
      },
    }));
    const last = pedidos.at(-1);
    return {
      pedidos,
      proximoCursor:
        more && last
          ? Buffer.from(
              JSON.stringify({
                negocioId: user.negocioId,
                id: last.id,
                createdAt: last.createdAt,
              }),
            ).toString('base64url')
          : null,
    };
  }
  async acompanhamento(user: UserPayload, id: string) {
    if (
      user.identity !== 'DEVICE' ||
      user.tipoDispositivo !== TipoDispositivo.TOTEM
    )
      throw new ForbiddenException('Somente TOTEM criador.');
    const p = await this.ler(
      this.prisma.pedido.findFirst({
        where: { id, negocioId: user.negocioId, dispositivoId: user.sub },
        select: {
          id: true,
          status: true,
          senha: true,
          versao: true,
          demo: true,
          demoAmbiente: true,
          valorTotal: true,
          liberacaoDemo: {
            where: { negocioId: user.negocioId },
            select: { id: true },
          },
        },
      }),
    );
    if (!p) throw new NotFoundException('Pedido não encontrado.');
    const { liberacaoDemo, valorTotal, ...resumo } = p;
    return {
      ...resumo,
      valorTotal: valorTotal.toFixed(2),
      autorizacaoOperacional: liberacaoDemo
        ? { tipo: 'DEMO' as const, financeira: false as const }
        : null,
    };
  }
}

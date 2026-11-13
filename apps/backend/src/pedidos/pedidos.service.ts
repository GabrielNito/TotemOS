import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CriarPedidoDto } from './dto/criar-pedido.dto';
import { StatusPedido, Prisma } from '@prisma/client';
import { demoEnvironmentFor } from './demo-policy';
import { inicioDiaSaoPaulo } from './periodo-criacao';

export interface CriarPedidoOptions {
  dispositivoId?: string;
  idempotencyKey?: string;
}

export interface ListarPedidosFiltro {
  status?: StatusPedido;
  dataSequencial?: string;
  dataIniciadaEm?: string;
  dataFinalizadaEm?: string;
  criadoEmInicio?: string;
  criadoEmFim?: string;
}

@Injectable()
export class PedidosService {
  constructor(private prisma: PrismaService) {}

  async criar(
    negocioId: string,
    dto: CriarPedidoDto,
    options?: CriarPedidoOptions,
  ) {
    const idempotencyKey = options?.idempotencyKey || dto.idempotencyKey;

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await this.prisma.$transaction(async (tx) => {
          // 0. Revalidação transacional do TOTEM (proteção contra revogação em trânsito)
          if (options?.dispositivoId && typeof tx.$queryRaw === 'function') {
            const devices = await tx.$queryRaw<{ id: string }[]>`
              SELECT "id" FROM "Dispositivo"
              WHERE "id" = ${options.dispositivoId}
                AND "negocioId" = ${negocioId}
                AND "tipo" = 'TOTEM'
                AND "ativo" = true
                AND "revogadoEm" IS NULL
              FOR UPDATE`;
            if (!devices.length) {
              throw new UnauthorizedException(
                'Dispositivo TOTEM revogado ou inativo.',
              );
            }
          }

          // 1. Serialização e verificação de idempotência
          if (idempotencyKey) {
            if (typeof tx.$queryRaw === 'function') {
              await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${JSON.stringify({ operacao: 'CRIAR_PEDIDO', idempotencyKey })}, 0))::text`;
            }

            const pedidoExistente = await tx.pedido.findFirst({
              where: { negocioId, idempotencyKey },
              include: {
                itens: {
                  include: {
                    adicionais: true,
                    escolhas: true,
                  },
                },
                pagamentos: true,
              },
            });

            if (pedidoExistente) {
              if (
                Array.isArray(pedidoExistente.itens) &&
                !this.replayCompativel(pedidoExistente, dto, options)
              ) {
                throw new ConflictException(
                  'Chave de idempotência já utilizada com outro conteúdo ou dispositivo.',
                );
              }
              return pedidoExistente;
            }

            if (typeof tx.$queryRaw === 'function') {
              const usadoOutroTenant = await tx.pedido.findFirst({
                where: { idempotencyKey },
                select: { id: true },
              });
              if (usadoOutroTenant) {
                throw new ConflictException(
                  'Chave de idempotência já utilizada.',
                );
              }
            }
          }

          // 2. Busca e validação dos produtos no banco (isolamento de tenant)
          const produtoIds = [
            ...new Set(dto.itens.map((item) => item.produtoId)),
          ];
          const produtosDb = await tx.produto.findMany({
            where: {
              id: { in: produtoIds },
              negocioId,
            },
            include: { variacoes: true },
          });

          const produtosMap = new Map(produtosDb.map((p) => [p.id, p]));

          // Verifica se todos os produtos foram encontrados e pertencem ao tenant
          for (const produtoId of produtoIds) {
            const produto = produtosMap.get(produtoId);
            if (!produto) {
              throw new NotFoundException(
                `Produto com ID ${produtoId} não encontrado neste estabelecimento`,
              );
            }
            if (!produto.ativo || produto.esgotado) {
              throw new BadRequestException(
                `Produto "${produto.nome}" está indisponível ou esgotado`,
              );
            }
          }

          // 3. Busca e validação de adicionais
          const todosAdicionaisEnviados = dto.itens.flatMap(
            (item) => item.adicionais || [],
          );
          const adicionalIds = [
            ...new Set(todosAdicionaisEnviados.map((a) => a.adicionalId)),
          ];

          const adicionaisDb = adicionalIds.length
            ? await tx.adicional.findMany({
                where: {
                  id: { in: adicionalIds },
                  produto: { negocioId },
                },
              })
            : [];

          const adicionaisMap = new Map(adicionaisDb.map((a) => [a.id, a]));

          // 4. Busca e validação de escolhas (combos)
          const todasEscolhasEnviadas = dto.itens.flatMap(
            (item) => item.escolhas || [],
          );
          const escolhaIds = [
            ...new Set(todasEscolhasEnviadas.map((e) => e.itemDoGrupoId)),
          ];

          const escolhasDb = escolhaIds.length
            ? await tx.itemDoGrupo.findMany({
                where: {
                  id: { in: escolhaIds },
                  grupo: { combo: { negocioId } },
                },
              })
            : [];

          const escolhasMap = new Map(escolhasDb.map((e) => [e.id, e]));

          // 5. Cálculo do total, snapshots e regra de preparo zero
          let valorTotalPedido = 0;
          let todosComPreparoZero = true;

          const itensParaCriar: Prisma.PedidoItemCreateWithoutPedidoInput[] =
            [];

          for (const item of dto.itens) {
            const produto = produtosMap.get(item.produtoId)!;

            if (produto.tempoEstimadoPreparo > 0) {
              todosComPreparoZero = false;
            }

            const variacoes = produto.variacoes ?? [];
            const correspondentes = variacoes.filter(
              (v) => v.nome === item.variacaoNome,
            );
            const variacao = correspondentes[0];
            if (
              (variacoes.length > 0 &&
                (correspondentes.length !== 1 || variacao.esgotado)) ||
              (variacoes.length === 0 && item.variacaoNome)
            ) {
              throw new BadRequestException(
                'Selecione uma variação válida e disponível.',
              );
            }
            const precoProduto = Number(variacao?.preco ?? produto.precoBase);
            let subtotalAdicionais = 0;
            const adicionaisParaCriar: Prisma.PedidoItemAdicionalCreateWithoutPedidoItemInput[] =
              [];

            if (item.adicionais && item.adicionais.length > 0) {
              const ids = item.adicionais.map((a) => a.adicionalId);
              if (new Set(ids).size !== ids.length) {
                throw new BadRequestException(
                  'Não repita adicionais no mesmo item.',
                );
              }
              for (const adic of item.adicionais) {
                const adicionalDb = adicionaisMap.get(adic.adicionalId);
                if (!adicionalDb || adicionalDb.produtoId !== produto.id) {
                  throw new BadRequestException(
                    `Adicional com ID ${adic.adicionalId} inválido para o produto "${produto.nome}"`,
                  );
                }
                if (adicionalDb.esgotado) {
                  throw new BadRequestException(
                    `Adicional "${adicionalDb.nome}" está esgotado`,
                  );
                }
                if (adic.quantidade > adicionalDb.maximo) {
                  throw new BadRequestException(
                    `Quantidade do adicional "${adicionalDb.nome}" excede o limite máximo permitido (${adicionalDb.maximo})`,
                  );
                }

                const precoAdicional = Number(adicionalDb.preco);
                subtotalAdicionais += precoAdicional * adic.quantidade;

                adicionaisParaCriar.push({
                  adicional: { connect: { id: adicionalDb.id } },
                  nomeAdicional: adicionalDb.nome,
                  precoNoMomento: precoAdicional,
                  quantidade: adic.quantidade,
                });
              }
            }

            let subtotalEscolhas = 0;
            const escolhasParaCriar: Prisma.PedidoItemEscolhaCreateWithoutPedidoItemInput[] =
              [];

            if (item.escolhas && item.escolhas.length > 0) {
              for (const escolha of item.escolhas) {
                const escolhaDb = escolhasMap.get(escolha.itemDoGrupoId);
                if (!escolhaDb || escolhaDb.esgotado) {
                  throw new BadRequestException(
                    `Item de escolha com ID ${escolha.itemDoGrupoId} está indisponível`,
                  );
                }

                const deltaPreco = Number(escolhaDb.deltaPreco);
                subtotalEscolhas += deltaPreco;

                escolhasParaCriar.push({
                  itemDoGrupo: { connect: { id: escolhaDb.id } },
                  nomeItem: escolhaDb.nome,
                  deltaNoMomento: deltaPreco,
                });
              }
            }

            const precoUnitarioItem =
              precoProduto + subtotalAdicionais + subtotalEscolhas;
            const subtotalItem = precoUnitarioItem * item.quantidade;
            valorTotalPedido += subtotalItem;

            itensParaCriar.push({
              produto: { connect: { id: produto.id } },
              nomeProduto: produto.nome,
              precoNoMomento: precoProduto,
              quantidade: item.quantidade,
              observacao: item.observacao,
              variacaoNome: variacao?.nome,
              adicionais: adicionaisParaCriar.length
                ? { create: adicionaisParaCriar }
                : undefined,
              escolhas: escolhasParaCriar.length
                ? { create: escolhasParaCriar }
                : undefined,
            });
          }

          // A senha diária será atribuída pelo KDS ao receber o pedido elegível.
          const dataSequencial = new Date().toISOString().slice(0, 10);
          const demoAmbiente = demoEnvironmentFor(negocioId);

          // 7. Persistência do Pedido com snapshots imutáveis
          return tx.pedido.create({
            data: {
              negocioId,
              dispositivoId: options?.dispositivoId,
              idempotencyKey,
              senha: null,
              dataSequencial,
              status: StatusPedido.AGUARDANDO_PAGAMENTO,
              nomeCliente: dto.nomeCliente,
              codigoCliente: dto.codigoCliente,
              valorTotal: valorTotalPedido,
              observacoes: dto.observacoes,
              origemOffline: false,
              preparoZero: todosComPreparoZero,
              demo: demoAmbiente !== null,
              demoAmbiente,
              itens: {
                create: itensParaCriar,
              },
            },
            include: {
              itens: {
                include: {
                  adicionais: true,
                  escolhas: true,
                },
              },
              pagamentos: true,
            },
          });
        });
      } catch (error) {
        const known = error instanceof Prisma.PrismaClientKnownRequestError;
        if (known && error.code === 'P2002') {
          throw new ConflictException('Chave de idempotência já utilizada.');
        }
        const sqlCode = known ? String(error.meta?.code) : '';
        const retry =
          known &&
          (error.code === 'P2034' ||
            (error.code === 'P2010' && ['40001', '40P01'].includes(sqlCode)));
        if (retry && attempt < 2) {
          await new Promise((resolve) =>
            setTimeout(resolve, 10 + Math.random() * 20),
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
        ) {
          throw new ServiceUnavailableException(
            'Persistência temporariamente indisponível. Repita a mesma chave.',
          );
        }
        throw error;
      }
    }
    throw new ServiceUnavailableException(
      'Criação de pedido temporariamente indisponível.',
    );
  }

  private replayCompativel(
    pedidoExistente: {
      dispositivoId?: string | null;
      nomeCliente?: string | null;
      codigoCliente?: string | null;
      observacoes?: string | null;
      itens: Array<{
        produtoId: string | null;
        quantidade: number;
        observacao?: string | null;
        variacaoNome?: string | null;
        adicionais?: Array<{ adicionalId: string | null; quantidade: number }>;
        escolhas?: Array<{ itemDoGrupoId: string | null }>;
      }>;
    },
    dto: CriarPedidoDto,
    options?: CriarPedidoOptions,
  ): boolean {
    if (
      (options?.dispositivoId ?? null) !==
      (pedidoExistente.dispositivoId ?? null)
    ) {
      return false;
    }
    if ((dto.nomeCliente ?? null) !== (pedidoExistente.nomeCliente ?? null)) {
      return false;
    }
    if (
      (dto.codigoCliente ?? null) !== (pedidoExistente.codigoCliente ?? null)
    ) {
      return false;
    }
    if ((dto.observacoes ?? null) !== (pedidoExistente.observacoes ?? null)) {
      return false;
    }
    if (pedidoExistente.itens.length !== dto.itens.length) {
      return false;
    }

    const normalizar = (itens: typeof pedidoExistente.itens) =>
      itens
        .map((item) =>
          JSON.stringify({
            produtoId: item.produtoId ?? null,
            quantidade: item.quantidade,
            observacao: item.observacao ?? null,
            variacaoNome: item.variacaoNome ?? null,
            adicionais: (item.adicionais ?? [])
              .map((a) => `${a.adicionalId ?? ''}:${a.quantidade}`)
              .sort(),
            escolhas: (item.escolhas ?? [])
              .map((e) => e.itemDoGrupoId ?? '')
              .sort(),
          }),
        )
        .sort();

    const existentes = normalizar(pedidoExistente.itens);
    const recebidos = normalizar(
      dto.itens.map((item) => ({
        produtoId: item.produtoId,
        quantidade: item.quantidade,
        observacao: item.observacao ?? null,
        variacaoNome: item.variacaoNome ?? null,
        adicionais: (item.adicionais ?? []).map((a) => ({
          adicionalId: a.adicionalId,
          quantidade: a.quantidade,
        })),
        escolhas: (item.escolhas ?? []).map((e) => ({
          itemDoGrupoId: e.itemDoGrupoId,
        })),
      })),
    );

    return existentes.every((assinatura, i) => assinatura === recebidos[i]);
  }

  async listar(negocioId: string, filtro?: ListarPedidosFiltro) {
    return this.prisma.pedido.findMany({
      where: {
        negocioId,
        ...(filtro?.status && { status: filtro.status }),
        ...((filtro?.criadoEmInicio || filtro?.criadoEmFim) && {
          createdAt: {
            ...(filtro.criadoEmInicio && {
              gte: inicioDiaSaoPaulo(filtro.criadoEmInicio),
            }),
            ...(filtro.criadoEmFim && {
              lt: inicioDiaSaoPaulo(filtro.criadoEmFim),
            }),
          },
        }),
        ...(filtro?.dataSequencial && {
          dataSequencial: filtro.dataSequencial,
        }),
        ...((filtro?.dataIniciadaEm || filtro?.dataFinalizadaEm) && {
          dataSequencial: {
            ...(filtro.dataIniciadaEm && { gte: filtro.dataIniciadaEm }),
            ...(filtro.dataFinalizadaEm && { lte: filtro.dataFinalizadaEm }),
          },
        }),
      },
      include: {
        itens: {
          include: {
            adicionais: true,
            escolhas: true,
          },
        },
        pagamentos: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async buscarPorId(negocioId: string, id: string) {
    const pedido = await this.prisma.pedido.findFirst({
      where: {
        id,
        negocioId,
      },
      include: {
        itens: {
          include: {
            adicionais: true,
            escolhas: true,
          },
        },
        pagamentos: true,
      },
    });

    if (!pedido) {
      throw new NotFoundException(
        'Pedido não encontrado ou não pertence a este estabelecimento',
      );
    }

    return pedido;
  }
}

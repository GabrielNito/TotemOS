import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CriarPedidoDto } from './dto/criar-pedido.dto';
import { StatusPedido } from '@prisma/client';

export interface CriarPedidoOptions {
  dispositivoId?: string;
  idempotencyKey?: string;
}

export interface ListarPedidosFiltro {
  status?: StatusPedido;
  dataSequencial?: string;
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

    return this.prisma.$transaction(async (tx) => {
      // 1. Verificação de idempotência
      if (idempotencyKey) {
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
          return pedidoExistente;
        }
      }

      // 2. Busca e validação dos produtos no banco (isolamento de tenant)
      const produtoIds = [...new Set(dto.itens.map((item) => item.produtoId))];
      const produtosDb = await tx.produto.findMany({
        where: {
          id: { in: produtoIds },
          negocioId,
        },
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
            },
          })
        : [];

      const escolhasMap = new Map(escolhasDb.map((e) => [e.id, e]));

      // 5. Cálculo do total, snapshots e regra de preparo zero
      let valorTotalPedido = 0;
      let todosComPreparoZero = true;

      const itensParaCriar = [];

      for (const item of dto.itens) {
        const produto = produtosMap.get(item.produtoId)!;

        if (produto.tempoEstimadoPreparo > 0) {
          todosComPreparoZero = false;
        }

        const precoProduto = Number(produto.precoBase);
        let subtotalAdicionais = 0;
        const adicionaisParaCriar = [];

        if (item.adicionais && item.adicionais.length > 0) {
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
              adicionalId: adicionalDb.id,
              nomeAdicional: adicionalDb.nome,
              precoNoMomento: precoAdicional,
              quantidade: adic.quantidade,
            });
          }
        }

        let subtotalEscolhas = 0;
        const escolhasParaCriar = [];

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
              itemDoGrupoId: escolhaDb.id,
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
          produtoId: produto.id,
          nomeProduto: produto.nome,
          precoNoMomento: precoProduto,
          quantidade: item.quantidade,
          observacao: item.observacao,
          variacaoNome: item.variacaoNome,
          adicionais: adicionaisParaCriar.length
            ? { create: adicionaisParaCriar }
            : undefined,
          escolhas: escolhasParaCriar.length
            ? { create: escolhasParaCriar }
            : undefined,
        });
      }

      // 6. Data sequencial e cálculo de senha sequencial diária
      const dataSequencial = new Date().toISOString().slice(0, 10);

      const ultimoPedido = await tx.pedido.findFirst({
        where: {
          negocioId,
          dataSequencial,
        },
        orderBy: {
          senha: 'desc',
        },
      });

      const proximaSenha = ultimoPedido ? ultimoPedido.senha + 1 : 1;

      // 7. Persistência do Pedido com snapshots imutáveis
      return tx.pedido.create({
        data: {
          negocioId,
          dispositivoId: options?.dispositivoId,
          idempotencyKey,
          senha: proximaSenha,
          dataSequencial,
          status: StatusPedido.AGUARDANDO_PAGAMENTO,
          nomeCliente: dto.nomeCliente,
          codigoCliente: dto.codigoCliente,
          valorTotal: valorTotalPedido,
          observacoes: dto.observacoes,
          origemOffline: false,
          preparoZero: todosComPreparoZero,
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
  }

  async listar(negocioId: string, filtro?: ListarPedidosFiltro) {
    return this.prisma.pedido.findMany({
      where: {
        negocioId,
        ...(filtro?.status && { status: filtro.status }),
        ...(filtro?.dataSequencial && {
          dataSequencial: filtro.dataSequencial,
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

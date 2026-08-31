import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CategoriasService } from './categorias.service';
import { CriarProdutoDto } from './dto/criar-produto.dto';
import { AtualizarProdutoDto } from './dto/atualizar-produto.dto';

@Injectable()
export class ProdutosService {
  constructor(
    private prisma: PrismaService,
    private categoriasService: CategoriasService,
  ) {}

  async criar(negocioId: string, dto: CriarProdutoDto) {
    // Garante que a categoria pertence ao mesmo negocioId (isolamento de tenant)
    await this.categoriasService.verificarPropriedade(
      dto.categoriaId,
      negocioId,
    );

    return this.prisma.produto.create({
      data: {
        negocioId,
        categoriaId: dto.categoriaId,
        nome: dto.nome,
        descricao: dto.descricao,
        precoBase: dto.precoBase,
        imagemUrl: dto.imagemUrl,
        tempoEstimadoPreparo: dto.tempoEstimadoPreparo ?? 0,
        adicionais: dto.adicionais?.length
          ? {
              create: dto.adicionais.map((a) => ({
                nome: a.nome,
                preco: a.preco,
                maximo: a.maximo ?? 1,
              })),
            }
          : undefined,
      },
      include: {
        adicionais: true,
        categoria: { select: { id: true, nome: true } },
      },
    });
  }

  async atualizar(
    negocioId: string,
    produtoId: string,
    dto: AtualizarProdutoDto,
  ) {
    // Verifica que o produto pertence ao tenant antes de atualizar
    await this.verificarPropriedadeProduto(produtoId, negocioId);

    // Se categoriaId for alterado, verifica que a nova categoria também pertence ao tenant
    if (dto.categoriaId) {
      await this.categoriasService.verificarPropriedade(
        dto.categoriaId,
        negocioId,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      // Sincronização de adicionais se o array foi fornecido no payload
      if (dto.adicionais !== undefined) {
        const adicionaisExistentes = await tx.adicional.findMany({
          where: { produtoId },
        });
        const idsExistentes = new Set(adicionaisExistentes.map((a) => a.id));
        const idsEnviados = new Set<string>();

        for (const item of dto.adicionais) {
          if (item.id && idsExistentes.has(item.id)) {
            // Atualiza adicional existente pertencente ao produto
            idsEnviados.add(item.id);
            await tx.adicional.update({
              where: { id: item.id },
              data: {
                nome: item.nome,
                preco: item.preco,
                maximo: item.maximo ?? 1,
                esgotado: item.esgotado ?? false,
              },
            });
          } else {
            // Cria novo adicional para o produto
            const novo = await tx.adicional.create({
              data: {
                produtoId,
                nome: item.nome,
                preco: item.preco,
                maximo: item.maximo ?? 1,
                esgotado: item.esgotado ?? false,
              },
            });
            idsEnviados.add(novo.id);
          }
        }

        // Remove adicionais que não foram enviados no payload
        const idsParaRemover = adicionaisExistentes
          .filter((a) => !idsEnviados.has(a.id))
          .map((a) => a.id);

        if (idsParaRemover.length > 0) {
          await tx.adicional.deleteMany({
            where: {
              id: { in: idsParaRemover },
              produtoId,
            },
          });
        }
      }

      return tx.produto.update({
        where: { id: produtoId },
        data: {
          ...(dto.nome !== undefined && { nome: dto.nome }),
          ...(dto.descricao !== undefined && { descricao: dto.descricao }),
          ...(dto.precoBase !== undefined && { precoBase: dto.precoBase }),
          ...(dto.imagemUrl !== undefined && { imagemUrl: dto.imagemUrl }),
          ...(dto.tempoEstimadoPreparo !== undefined && {
            tempoEstimadoPreparo: dto.tempoEstimadoPreparo,
          }),
          ...(dto.esgotado !== undefined && { esgotado: dto.esgotado }),
          ...(dto.ativo !== undefined && { ativo: dto.ativo }),
          ...(dto.categoriaId !== undefined && {
            categoriaId: dto.categoriaId,
          }),
        },
        include: {
          adicionais: true,
          categoria: { select: { id: true, nome: true } },
        },
      });
    });
  }

  async desativar(negocioId: string, produtoId: string) {
    // Soft delete — verifica propriedade antes de desativar
    await this.verificarPropriedadeProduto(produtoId, negocioId);

    return this.prisma.produto.update({
      where: { id: produtoId },
      data: { ativo: false },
      select: {
        id: true,
        nome: true,
        ativo: true,
      },
    });
  }

  async listarCatalogoPublico(negocioId: string) {
    // Rota pública: retorna apenas categorias com produtos ativos e não esgotados
    const categorias = await this.prisma.categoria.findMany({
      where: { negocioId, ativo: true },
      orderBy: { ordem: 'asc' },
      include: {
        produtos: {
          where: { ativo: true, esgotado: false, negocioId },
          orderBy: { nome: 'asc' },
          include: {
            adicionais: {
              where: { esgotado: false },
            },
            variacoes: {
              where: { esgotado: false },
            },
          },
        },
      },
    });

    // Remove categorias sem nenhum produto disponível para exibição no Totem
    return categorias.filter((c) => c.produtos.length > 0);
  }

  private async verificarPropriedadeProduto(
    produtoId: string,
    negocioId: string,
  ) {
    const produto = await this.prisma.produto.findFirst({
      where: { id: produtoId, negocioId },
    });

    if (!produto) {
      throw new NotFoundException(
        'Produto não encontrado ou não pertence a este estabelecimento',
      );
    }

    return produto;
  }
}

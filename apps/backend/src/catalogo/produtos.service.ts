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

    return this.prisma.produto.update({
      where: { id: produtoId },
      data: {
        ...(dto.nome !== undefined && { nome: dto.nome }),
        ...(dto.descricao !== undefined && { descricao: dto.descricao }),
        ...(dto.precoBase !== undefined && { precoBase: dto.precoBase }),
        ...(dto.imagemUrl !== undefined && { imagemUrl: dto.imagemUrl }),
        ...(dto.tempoEstimadoPreparo !== undefined && {
          tempoEstimadoPreparo: dto.tempoEstimadoPreparo,
        }),
        ...(dto.categoriaId !== undefined && { categoriaId: dto.categoriaId }),
      },
      include: {
        adicionais: true,
        categoria: { select: { id: true, nome: true } },
      },
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

    return categorias;
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

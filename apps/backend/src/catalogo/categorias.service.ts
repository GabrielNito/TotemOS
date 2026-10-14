import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CriarCategoriaDto } from './dto/criar-categoria.dto';
import { AtualizarCategoriaDto } from './dto/atualizar-categoria.dto';
import { Categoria } from '@prisma/client';

@Injectable()
export class CategoriasService {
  constructor(private prisma: PrismaService) {}

  async criar(negocioId: string, dto: CriarCategoriaDto): Promise<Categoria> {
    return this.prisma.categoria.create({
      data: {
        nome: dto.nome,
        ordem: dto.ordem,
        negocioId,
      },
    });
  }

  async listar(negocioId: string): Promise<Categoria[]> {
    return this.prisma.categoria.findMany({
      where: { negocioId, ativo: true },
      orderBy: { ordem: 'asc' },
    });
  }

  async atualizar(
    negocioId: string,
    categoriaId: string,
    dto: AtualizarCategoriaDto,
  ): Promise<Categoria> {
    const atualizacao = await this.prisma.categoria.updateMany({
      where: { id: categoriaId, negocioId },
      data: dto,
    });

    if (atualizacao.count === 0) {
      throw new NotFoundException(
        'Categoria não encontrada ou não pertence a este estabelecimento',
      );
    }

    return this.prisma.categoria.findFirstOrThrow({
      where: { id: categoriaId, negocioId },
    });
  }

  async verificarPropriedade(
    categoriaId: string,
    negocioId: string,
  ): Promise<Categoria> {
    const categoria = await this.prisma.categoria.findFirst({
      where: { id: categoriaId, negocioId },
    });

    if (!categoria) {
      throw new NotFoundException(
        'Categoria não encontrada ou não pertence a este estabelecimento',
      );
    }

    return categoria;
  }
}

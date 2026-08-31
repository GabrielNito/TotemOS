import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CriarCategoriaDto } from './dto/criar-categoria.dto';
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

    if (categoria.negocioId !== negocioId) {
      throw new ForbiddenException(
        'Acesso negado: Categoria não pertence a este estabelecimento',
      );
    }

    return categoria;
  }
}

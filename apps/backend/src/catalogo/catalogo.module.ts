import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { CategoriasService } from './categorias.service';
import { ProdutosService } from './produtos.service';
import { CatalogoController } from './catalogo.controller';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [CatalogoController],
  providers: [CategoriasService, ProdutosService],
  exports: [CategoriasService, ProdutosService],
})
export class CatalogoModule {}

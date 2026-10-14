import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
  ApiBody,
  ApiParam,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { UserPayload } from '../auth/decorators/current-user.decorator';
import { CategoriasService } from './categorias.service';
import { ProdutosService } from './produtos.service';
import { CriarCategoriaDto } from './dto/criar-categoria.dto';
import { AtualizarCategoriaDto } from './dto/atualizar-categoria.dto';
import { CriarProdutoDto } from './dto/criar-produto.dto';
import { AtualizarProdutoDto } from './dto/atualizar-produto.dto';
import { ErrorResponseDto } from '../auth/dto/auth-response.dto';

@ApiTags('Catálogo')
@Controller('catalogo')
export class CatalogoController {
  constructor(
    private categoriasService: CategoriasService,
    private produtosService: ProdutosService,
  ) {}

  // ─── Categorias ──────────────────────────────────────────────────────────

  @Post('categorias')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.DONO, Role.GERENTE)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Criar categoria no catálogo do estabelecimento',
    description:
      'Cria uma nova categoria de produtos. O negocioId é extraído automaticamente do token JWT — nunca do body.',
  })
  @ApiBody({ type: CriarCategoriaDto })
  @ApiResponse({
    status: 201,
    description: 'Categoria criada com sucesso.',
  })
  @ApiResponse({
    status: 400,
    type: ErrorResponseDto,
    description: 'Falha de validação Zod (ex: nome vazio).',
  })
  @ApiResponse({
    status: 401,
    type: ErrorResponseDto,
    description: 'Token JWT ausente ou inválido.',
  })
  @ApiResponse({
    status: 403,
    type: ErrorResponseDto,
    description: 'Usuário sem perfil autorizado para administrar o catálogo.',
  })
  async criarCategoria(
    @CurrentUser() user: UserPayload,
    @Body() dto: CriarCategoriaDto,
  ) {
    return this.categoriasService.criar(user.negocioId, dto);
  }

  @Put('categorias/:id')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.DONO, Role.GERENTE)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Atualizar categoria do catálogo',
    description:
      'Atualiza os campos informados da categoria, incluindo a ativação. Verifica isolamento de tenant antes de persistir.',
  })
  @ApiParam({ name: 'id', description: 'UUID da categoria a ser atualizada' })
  @ApiBody({ type: AtualizarCategoriaDto })
  @ApiResponse({
    status: 200,
    description: 'Categoria atualizada com sucesso.',
  })
  @ApiResponse({
    status: 400,
    type: ErrorResponseDto,
    description: 'Falha de validação Zod.',
  })
  @ApiResponse({
    status: 401,
    type: ErrorResponseDto,
    description: 'Token JWT ausente ou inválido.',
  })
  @ApiResponse({
    status: 403,
    type: ErrorResponseDto,
    description: 'Usuário sem perfil autorizado para administrar o catálogo.',
  })
  @ApiResponse({
    status: 404,
    type: ErrorResponseDto,
    description:
      'Categoria não encontrada ou não pertence a este estabelecimento.',
  })
  async atualizarCategoria(
    @CurrentUser() user: UserPayload,
    @Param('id') id: string,
    @Body() dto: AtualizarCategoriaDto,
  ) {
    return this.categoriasService.atualizar(user.negocioId, id, dto);
  }

  // ─── Catálogo Público ────────────────────────────────────────────────────

  @Get('publico/:negocioId')
  @ApiOperation({
    summary: 'Retorna o catálogo público para exibição no Totem',
    description:
      'Rota pública (sem autenticação). Retorna categorias com produtos ativos e não esgotados, incluindo variações e adicionais disponíveis.',
  })
  @ApiParam({
    name: 'negocioId',
    description: 'UUID do negócio cujo catálogo será exibido',
  })
  @ApiResponse({
    status: 200,
    description:
      'Catálogo completo com categorias, produtos, variações e adicionais.',
  })
  async getCatalogoPublico(@Param('negocioId') negocioId: string) {
    return this.produtosService.listarCatalogoPublico(negocioId);
  }

  @Get('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.DONO, Role.GERENTE)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Retorna o catálogo administrativo do estabelecimento',
    description:
      'Retorna categorias, produtos e adicionais do tenant autenticado sem ocultar categorias vazias ou itens inativos e esgotados.',
  })
  @ApiResponse({
    status: 200,
    description:
      'Categorias e produtos administrativos, incluindo todos os status e adicionais.',
  })
  @ApiResponse({
    status: 401,
    type: ErrorResponseDto,
    description: 'Token JWT ausente ou inválido.',
  })
  @ApiResponse({
    status: 403,
    type: ErrorResponseDto,
    description: 'Usuário sem perfil autorizado para administrar o catálogo.',
  })
  async getCatalogoAdministrativo(@CurrentUser() user: UserPayload) {
    return this.produtosService.listarCatalogoAdministrativo(user.negocioId);
  }

  // ─── Produtos ────────────────────────────────────────────────────────────

  @Post('produtos')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.DONO, Role.GERENTE)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Criar produto no catálogo',
    description:
      'Cria um produto e seus adicionais em uma única operação. A categoria informada deve pertencer ao mesmo estabelecimento do token JWT.',
  })
  @ApiBody({ type: CriarProdutoDto })
  @ApiResponse({
    status: 201,
    description: 'Produto criado com sucesso, incluindo adicionais.',
  })
  @ApiResponse({
    status: 400,
    type: ErrorResponseDto,
    description:
      'Falha de validação Zod (ex: precoBase negativo, tempoEstimadoPreparo negativo).',
  })
  @ApiResponse({
    status: 401,
    type: ErrorResponseDto,
    description: 'Token JWT ausente ou inválido.',
  })
  @ApiResponse({
    status: 403,
    type: ErrorResponseDto,
    description: 'Usuário sem perfil autorizado para administrar o catálogo.',
  })
  @ApiResponse({
    status: 404,
    type: ErrorResponseDto,
    description:
      'Categoria não encontrada ou não pertence a este estabelecimento.',
  })
  async criarProduto(
    @CurrentUser() user: UserPayload,
    @Body() dto: CriarProdutoDto,
  ) {
    return this.produtosService.criar(user.negocioId, dto);
  }

  @Put('produtos/:id')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.DONO, Role.GERENTE)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Atualizar produto do catálogo',
    description:
      'Atualização parcial de um produto. Todos os campos são opcionais. Verifica isolamento de tenant antes de atualizar.',
  })
  @ApiParam({ name: 'id', description: 'UUID do produto a ser atualizado' })
  @ApiBody({ type: AtualizarProdutoDto })
  @ApiResponse({
    status: 200,
    description: 'Produto atualizado com sucesso.',
  })
  @ApiResponse({
    status: 400,
    type: ErrorResponseDto,
    description: 'Falha de validação Zod.',
  })
  @ApiResponse({
    status: 401,
    type: ErrorResponseDto,
    description: 'Token JWT ausente ou inválido.',
  })
  @ApiResponse({
    status: 403,
    type: ErrorResponseDto,
    description: 'Usuário sem perfil autorizado para administrar o catálogo.',
  })
  @ApiResponse({
    status: 404,
    type: ErrorResponseDto,
    description:
      'Produto não encontrado ou não pertence a este estabelecimento.',
  })
  async atualizarProduto(
    @CurrentUser() user: UserPayload,
    @Param('id') id: string,
    @Body() dto: AtualizarProdutoDto,
  ) {
    return this.produtosService.atualizar(user.negocioId, id, dto);
  }

  @Delete('produtos/:id')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.DONO, Role.GERENTE)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Desativar produto do catálogo (soft delete)',
    description:
      'Define ativo=false no produto. O produto não será mais exibido no Totem, mas o histórico de pedidos é preservado. A reativação é feita pela atualização administrativa do produto.',
  })
  @ApiParam({ name: 'id', description: 'UUID do produto a ser desativado' })
  @ApiResponse({
    status: 200,
    description: 'Produto desativado com sucesso.',
  })
  @ApiResponse({
    status: 401,
    type: ErrorResponseDto,
    description: 'Token JWT ausente ou inválido.',
  })
  @ApiResponse({
    status: 403,
    type: ErrorResponseDto,
    description: 'Usuário sem perfil autorizado para administrar o catálogo.',
  })
  @ApiResponse({
    status: 404,
    type: ErrorResponseDto,
    description:
      'Produto não encontrado ou não pertence a este estabelecimento.',
  })
  async desativarProduto(
    @CurrentUser() user: UserPayload,
    @Param('id') id: string,
  ) {
    return this.produtosService.desativar(user.negocioId, id);
  }
}

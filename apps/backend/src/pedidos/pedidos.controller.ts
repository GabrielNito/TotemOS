import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  Headers,
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
  ApiQuery,
  ApiHeader,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { UserPayload } from '../auth/decorators/current-user.decorator';
import { PedidosService } from './pedidos.service';
import { CriarPedidoDto } from './dto/criar-pedido.dto';
import { ErrorResponseDto } from '../auth/dto/auth-response.dto';
import { StatusPedido } from '@prisma/client';

@ApiTags('Pedidos')
@Controller('pedidos')
export class PedidosController {
  constructor(private pedidosService: PedidosService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Criar novo pedido com snapshot imutável de preços',
    description:
      'Registra um novo pedido no sistema. O backend valida a disponibilidade no catálogo, calcula os preços e totais com base nos registros do banco de dados (impossibilitando adulteração de preço pelo cliente) e vincula estritamente ao estabelecimento do token.',
  })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: false,
    description:
      'Chave única de idempotência para evitar duplicação em retentativas',
  })
  @ApiBody({ type: CriarPedidoDto })
  @ApiResponse({
    status: 201,
    description:
      'Pedido criado com sucesso, snapshots gravados e status AGUARDANDO_PAGAMENTO.',
  })
  @ApiResponse({
    status: 400,
    type: ErrorResponseDto,
    description:
      'Falha de validação Zod (ex: preço enviado no body, produtos esgotados).',
  })
  @ApiResponse({
    status: 401,
    type: ErrorResponseDto,
    description: 'Token ausente, inválido ou dispositivo inativo.',
  })
  async criar(
    @CurrentUser() user: UserPayload,
    @Body() dto: CriarPedidoDto,
    @Headers('idempotency-key') headerIdempotencyKey?: string,
  ) {
    const idempotencyKey = headerIdempotencyKey || dto.idempotencyKey;
    const dispositivoId = user.isDispositivo ? user.sub : undefined;

    return this.pedidosService.criar(user.negocioId, dto, {
      dispositivoId,
      idempotencyKey,
    });
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Listar pedidos do estabelecimento',
    description:
      'Retorna todos os pedidos pertencentes exclusivamente ao estabelecimento do usuário ou dispositivo autenticado, com filtros opcionais por status e data.',
  })
  @ApiQuery({
    name: 'status',
    enum: StatusPedido,
    required: false,
    description:
      'Filtrar por status do pedido (ex: AGUARDANDO_PAGAMENTO, PENDENTE, PRONTO)',
  })
  @ApiQuery({
    name: 'dataSequencial',
    required: false,
    description: 'Filtrar por data sequencial no formato YYYY-MM-DD',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de pedidos do estabelecimento.',
  })
  @ApiResponse({
    status: 401,
    type: ErrorResponseDto,
    description: 'Token JWT ou dispositivo ausente ou inválido.',
  })
  async listar(
    @CurrentUser() user: UserPayload,
    @Query('status') status?: StatusPedido,
    @Query('dataSequencial') dataSequencial?: string,
  ) {
    return this.pedidosService.listar(user.negocioId, {
      status,
      dataSequencial,
    });
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Obter detalhes de um pedido por ID',
    description:
      'Busca um pedido específico pelo seu UUID. Garante isolamento de tenant retornando 404 caso o pedido pertença a outro estabelecimento.',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID do pedido',
  })
  @ApiResponse({
    status: 200,
    description: 'Detalhes completos do pedido com itens e snapshots.',
  })
  @ApiResponse({
    status: 401,
    type: ErrorResponseDto,
    description: 'Token JWT ou dispositivo ausente ou inválido.',
  })
  @ApiResponse({
    status: 404,
    type: ErrorResponseDto,
    description:
      'Pedido não encontrado ou não pertence a este estabelecimento.',
  })
  async buscarPorId(@CurrentUser() user: UserPayload, @Param('id') id: string) {
    return this.pedidosService.buscarPorId(user.negocioId, id);
  }
}

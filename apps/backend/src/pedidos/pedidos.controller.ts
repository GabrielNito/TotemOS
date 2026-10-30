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
  Patch,
  ParseUUIDPipe,
  Header,
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
import { AnyAuthGuard } from '../auth/guards/any-auth.guard';
import { DeviceTypeGuard } from '../auth/guards/device-type.guard';
import { DeviceTypes } from '../auth/decorators/device-types.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { UserPayload } from '../auth/decorators/current-user.decorator';
import { PedidosService } from './pedidos.service';
import { CriarPedidoDto } from './dto/criar-pedido.dto';
import { ErrorResponseDto } from '../auth/dto/auth-response.dto';
import { StatusPedido, TipoDispositivo } from '@prisma/client';
import { OperacaoPedidosService } from './operacao-pedidos.service';
import {
  AcompanhamentoResponseDto,
  FilaQueryDto,
  FilaResponseDto,
  TransicaoPedidoDto,
  TransicaoResponseDto,
} from './dto/operacao-pedido.dto';

@ApiTags('Pedidos')
@Controller('pedidos')
export class PedidosController {
  constructor(
    private pedidosService: PedidosService,
    private operacao: OperacaoPedidosService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(AnyAuthGuard, DeviceTypeGuard)
  @DeviceTypes(TipoDispositivo.TOTEM)
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
    const dispositivoId = user.identity === 'DEVICE' ? user.sub : undefined;

    return this.pedidosService.criar(user.negocioId, dto, {
      dispositivoId,
      idempotencyKey,
    });
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @UseGuards(AnyAuthGuard, DeviceTypeGuard)
  @DeviceTypes(TipoDispositivo.PAINEL)
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
    if (user.identity === 'DEVICE')
      return this.operacao.listarLegado(user, { status, dataSequencial });
    return this.pedidosService.listar(user.negocioId, {
      status,
      dataSequencial,
    });
  }

  @Get('fila')
  @Header('Cache-Control', 'no-store')
  @UseGuards(AnyAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Fila elegível para PAINEL, DONO e GERENTE',
    description:
      'Somente pedidos autorizados PENDENTE, EM_PREPARO e PRONTO. Paginação estável por criação/ID. Parâmetros desconhecidos são rejeitados.',
  })
  @ApiQuery({
    name: 'limite',
    required: false,
    type: Number,
    minimum: 1,
    maximum: 100,
  })
  @ApiQuery({ name: 'cursor', required: false, type: String })
  @ApiResponse({ status: 200, type: FilaResponseDto })
  @ApiResponse({ status: 400, description: 'Query ou cursor inválido.' })
  @ApiResponse({ status: 401, description: 'Credencial ausente ou inválida.' })
  @ApiResponse({ status: 403, description: 'Ator não permitido.' })
  @ApiResponse({ status: 429, description: 'Limite global excedido.' })
  @ApiResponse({ status: 503, description: 'Persistência indisponível.' })
  fila(@CurrentUser() user: UserPayload, @Query() query: FilaQueryDto) {
    return this.operacao.fila(user, query);
  }

  @Patch(':id/status')
  @HttpCode(200)
  @UseGuards(AnyAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Avança preparo ou entrega com versão e auditoria',
    description:
      'PAINEL, DONO ou GERENTE. Exige autorização operacional, senha e versão atual. Replay pela chave original retorna estado atual sem repetir efeito. Nova chave para estado já atingido recebe 409.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description: 'UUID persistido pelo cliente antes de enviar.',
  })
  @ApiBody({ type: TransicaoPedidoDto })
  @ApiResponse({ status: 200, type: TransicaoResponseDto })
  @ApiResponse({ status: 400, description: 'DTO, ID ou chave inválida.' })
  @ApiResponse({ status: 401, description: 'Credencial inválida ou revogada.' })
  @ApiResponse({ status: 403, description: 'Ator ou vínculo não permitido.' })
  @ApiResponse({ status: 404, description: 'Pedido inexistente neste tenant.' })
  @ApiResponse({
    status: 409,
    description: 'Versão, transição, autorização, senha ou chave incompatível.',
  })
  @ApiResponse({ status: 429, description: 'Limite global excedido.' })
  @ApiResponse({
    status: 503,
    description: 'Resultado incerto. Repetir a mesma chave.',
  })
  transicionar(
    @CurrentUser() user: UserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: TransicaoPedidoDto,
    @Headers('idempotency-key') key?: string,
  ) {
    return this.operacao.transicionar(user, id, dto, key);
  }

  @Get(':id/acompanhamento')
  @Header('Cache-Control', 'no-store')
  @UseGuards(AnyAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Snapshot mínimo para TOTEM criador',
    description:
      'Filtra negócio e dispositivo criador. Não expõe itens, dados pessoais, pagamentos ou auditoria.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, type: AcompanhamentoResponseDto })
  @ApiResponse({ status: 400, description: 'ID inválido.' })
  @ApiResponse({ status: 401, description: 'Credencial ausente ou revogada.' })
  @ApiResponse({ status: 403, description: 'Somente TOTEM.' })
  @ApiResponse({
    status: 404,
    description: 'Pedido fora do tenant/dispositivo ou inexistente.',
  })
  @ApiResponse({ status: 429, description: 'Limite global excedido.' })
  @ApiResponse({ status: 503, description: 'Persistência indisponível.' })
  acompanhamento(
    @CurrentUser() user: UserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.operacao.acompanhamento(user, id);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AnyAuthGuard, DeviceTypeGuard)
  @DeviceTypes(TipoDispositivo.PAINEL)
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
    if (user.identity === 'DEVICE')
      return this.operacao.detalharLegado(user, id);
    return this.pedidosService.buscarPorId(user.negocioId, id);
  }
}

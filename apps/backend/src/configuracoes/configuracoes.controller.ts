import {
  Body,
  Controller,
  Get,
  Header,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ZodValidationPipe } from 'nestjs-zod';
import { Role } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { UserPayload } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { ErrorResponseDto } from '../auth/dto/auth-response.dto';
import { AnyAuthGuard } from '../auth/guards/any-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ConfiguracoesService } from './configuracoes.service';
import {
  AtualizarConfiguracaoNegocioDto,
  ConfiguracaoNegocioResponseDto,
  ConfiguracaoQueryDto,
} from './dto/configuracao-negocio.dto';

@ApiTags('Configurações')
@ApiBearerAuth()
@UseGuards(AnyAuthGuard, RolesGuard)
@Controller(['negocio/config', 'configuracoes'])
export class ConfiguracoesController {
  constructor(private readonly configuracoesService: ConfiguracoesService) {}

  @Get()
  @Roles(Role.DONO, Role.GERENTE)
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Obter configurações do estabelecimento autenticado',
  })
  @ApiResponse({
    status: 200,
    type: ConfiguracaoNegocioResponseDto,
    description: 'Configurações do negócio autenticado.',
  })
  @ApiResponse({
    status: 400,
    type: ErrorResponseDto,
    description: 'Parâmetros de query não permitidos.',
  })
  @ApiResponse({
    status: 401,
    type: ErrorResponseDto,
    description: 'Sessão ausente ou inválida.',
  })
  @ApiResponse({
    status: 403,
    type: ErrorResponseDto,
    description: 'Identidade de dispositivo ou vínculo humano sem permissão.',
  })
  @ApiResponse({
    status: 404,
    type: ErrorResponseDto,
    description: 'Negócio não encontrado.',
  })
  obter(
    @CurrentUser() user: UserPayload,
    @Query(new ZodValidationPipe(ConfiguracaoQueryDto))
    query?: Record<string, never>,
  ) {
    void query;
    return this.configuracoesService.obter(user);
  }

  @Patch()
  @Roles(Role.DONO)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary:
      'Atualizar configurações do estabelecimento autenticado mediante PIN do dono',
  })
  @ApiBody({ type: AtualizarConfiguracaoNegocioDto })
  @ApiResponse({
    status: 200,
    type: ConfiguracaoNegocioResponseDto,
    description: 'Configurações atualizadas com isolamento de tenant.',
  })
  @ApiResponse({
    status: 400,
    type: ErrorResponseDto,
    description: 'DTO inválido, campos extras ou tentativa de ativar offline.',
  })
  @ApiResponse({
    status: 401,
    type: ErrorResponseDto,
    description: 'Sessão inválida ou PIN do dono incorreto.',
  })
  @ApiResponse({
    status: 403,
    type: ErrorResponseDto,
    description: 'Exclusivo para DONO ativo do estabelecimento.',
  })
  @ApiResponse({
    status: 404,
    type: ErrorResponseDto,
    description: 'Negócio não encontrado.',
  })
  @ApiResponse({
    status: 429,
    description: 'Limite de tentativas excedido.',
  })
  atualizar(
    @CurrentUser() user: UserPayload,
    @Body() dto: AtualizarConfiguracaoNegocioDto,
    @Query(new ZodValidationPipe(ConfiguracaoQueryDto))
    query?: Record<string, never>,
  ) {
    void query;
    return this.configuracoesService.atualizar(user, dto);
  }
}

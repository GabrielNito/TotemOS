import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Ip,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { UserPayload } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { DeviceTokenGuard } from '../auth/guards/device-token.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AtivarDispositivoDto } from './dto/ativar-dispositivo.dto';
import {
  AtivarDispositivoResponseDto,
  DispositivoMeResponseDto,
  GerarCodigoResponseDto,
  ListarDispositivosResponseDto,
} from './dto/dispositivo-response.dto';
import { GerarCodigoDto } from './dto/gerar-codigo.dto';
import { DispositivosService } from './dispositivos.service';

@ApiTags('Dispositivos')
@Controller('dispositivos')
export class DispositivosController {
  constructor(private dispositivosService: DispositivosService) {}

  @Post('parear/codigo')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.DONO)
  @ApiBearerAuth()
  @ApiBody({ type: GerarCodigoDto })
  @ApiOperation({ summary: 'Gerar código de pareamento para um dispositivo' })
  @ApiResponse({ status: 201, type: GerarCodigoResponseDto })
  @ApiResponse({ status: 400, description: 'Payload inválido.' })
  @ApiResponse({ status: 401, description: 'JWT ausente ou inválido.' })
  @ApiResponse({ status: 403, description: 'Apenas DONO pode gerar códigos.' })
  @ApiResponse({ status: 409, description: 'Colisão de código temporária.' })
  async gerarCodigo(
    @CurrentUser() user: UserPayload,
    @Body() dto: GerarCodigoDto,
  ) {
    return this.dispositivosService.gerarCodigo(user.negocioId, user.sub, dto);
  }

  @Post('parear/ativar')
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiBody({ type: AtivarDispositivoDto })
  @ApiOperation({ summary: 'Ativar dispositivo com código de pareamento' })
  @ApiResponse({ status: 201, type: AtivarDispositivoResponseDto })
  @ApiResponse({ status: 400, description: 'Código malformado.' })
  @ApiResponse({
    status: 401,
    description: 'Código inválido, expirado ou usado.',
  })
  @ApiResponse({ status: 409, description: 'Consumo concorrente do código.' })
  @ApiResponse({ status: 429, description: 'Muitas tentativas de ativação.' })
  async ativar(@Body() dto: AtivarDispositivoDto, @Ip() ip: string) {
    return this.dispositivosService.ativar(dto.codigo, ip);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.DONO, Role.GERENTE)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Listar dispositivos do negócio autenticado' })
  @ApiResponse({ status: 200, type: ListarDispositivosResponseDto })
  @ApiResponse({ status: 401, description: 'JWT ausente ou inválido.' })
  @ApiResponse({ status: 403, description: 'Perfil sem permissão.' })
  async listar(@CurrentUser() user: UserPayload) {
    return this.dispositivosService.listar(user.negocioId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.DONO)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revogar dispositivo do negócio autenticado' })
  @ApiResponse({ status: 204, description: 'Dispositivo revogado.' })
  @ApiResponse({ status: 401, description: 'JWT ausente ou inválido.' })
  @ApiResponse({ status: 403, description: 'Apenas DONO pode revogar.' })
  @ApiResponse({ status: 404, description: 'Dispositivo não encontrado.' })
  async revogar(@CurrentUser() user: UserPayload, @Param('id') id: string) {
    await this.dispositivosService.revogar(user.negocioId, id);
  }

  @Get('me')
  @UseGuards(DeviceTokenGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Obter identidade do dispositivo autenticado' })
  @ApiResponse({ status: 200, type: DispositivoMeResponseDto })
  @ApiResponse({
    status: 401,
    description: 'Token ausente, inválido ou revogado.',
  })
  async me(@CurrentUser() user: UserPayload) {
    return this.dispositivosService.me(user.negocioId, user.sub);
  }
}

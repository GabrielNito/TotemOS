import {
  Controller,
  Post,
  Get,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { Roles } from './decorators/roles.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import type { UserPayload } from './decorators/current-user.decorator';
import { Role } from '@prisma/client';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
  ApiBody,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { LoginDto } from './dto/login.dto';
import { ValidarPinDto } from './dto/validar-pin.dto';
import { RegistrarDto } from './dto/registrar.dto';
import {
  LoginResponseDto,
  ValidarPinResponseDto,
  ErrorResponseDto,
} from './dto/auth-response.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('registrar')
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({
    summary: 'Cadastro e onboarding de novo estabelecimento e usuário dono',
    description:
      'Cria atomicamente o Negócio, suas configurações iniciais e o primeiro Usuário com perfil DONO, emitindo o token JWT de login.',
  })
  @ApiBody({ type: RegistrarDto })
  @ApiResponse({
    status: 201,
    type: LoginResponseDto,
    description:
      'Estabelecimento e usuário criados com sucesso. Retorna o token JWT.',
  })
  @ApiResponse({
    status: 400,
    type: ErrorResponseDto,
    description: 'Falha de validação dos campos no formato Zod.',
  })
  @ApiResponse({
    status: 409,
    type: ErrorResponseDto,
    description: 'E-mail ou slug do negócio já cadastrado no sistema.',
  })
  async registrar(@Body() dto: RegistrarDto) {
    return this.authService.registrar(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({
    summary: 'Login de usuário da Dashboard com e-mail e senha',
    description:
      'Valida as credenciais do usuário do lojista e emite um token JWT com expiração de 7 dias (Rate limit: máx 5 tentativas por minuto).',
  })
  @ApiBody({ type: LoginDto })
  @ApiResponse({
    status: 200,
    type: LoginResponseDto,
    description: 'Login realizado com sucesso e token emitido.',
  })
  @ApiResponse({
    status: 400,
    type: ErrorResponseDto,
    description: 'Falha de validação dos campos no formato Zod.',
  })
  @ApiResponse({
    status: 401,
    type: ErrorResponseDto,
    description: 'Credenciais inválidas (e-mail ou senha incorretos).',
  })
  @ApiResponse({
    status: 429,
    description: 'Muitas tentativas. Bloqueio temporário por rate limit.',
  })
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto.email, dto.senhaPlana);
  }

  @Post('validar-pin')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({
    summary: 'Validação de PIN de segurança do dono do negócio',
    description:
      'Verifica se o PIN de 4 dígitos informado pertence ao dono do negócio. Exige token JWT e valida o isolamento de tenant.',
  })
  @ApiBody({ type: ValidarPinDto })
  @ApiResponse({
    status: 200,
    type: ValidarPinResponseDto,
    description: 'PIN validado com sucesso.',
  })
  @ApiResponse({
    status: 400,
    type: ErrorResponseDto,
    description: 'ID do negócio inválido ou PIN malformatado.',
  })
  @ApiResponse({
    status: 401,
    type: ErrorResponseDto,
    description: 'PIN do dono incorreto ou token ausente/inválido.',
  })
  @ApiResponse({
    status: 403,
    type: ErrorResponseDto,
    description:
      'Acesso negado: Você não possui autorização para este estabelecimento.',
  })
  @ApiResponse({
    status: 429,
    description:
      'Muitas tentativas de PIN. Bloqueio temporário por rate limit.',
  })
  async validarPin(
    @CurrentUser() user: UserPayload,
    @Body() dto: ValidarPinDto,
  ) {
    const valido = await this.authService.validarPinDono(
      user.negocioId,
      dto.negocioId,
      dto.pin,
    );
    return { valido };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Retorna o perfil do usuário autenticado pelo JWT',
    description:
      'Lê o token enviado no header Authorization: Bearer <token> e decodifica os dados do usuário.',
  })
  @ApiResponse({
    status: 200,
    description: 'Dados do usuário autenticado.',
  })
  @ApiResponse({
    status: 401,
    type: ErrorResponseDto,
    description: 'Token JWT ausente, inválido ou expirado.',
  })
  me(@CurrentUser() user: UserPayload) {
    return { user };
  }

  @Get('admin-only')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.DONO)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Rota de exemplo restrita ao perfil DONO',
    description:
      'Exemplo de rota protegida que exige permissão explícita de perfil DONO.',
  })
  @ApiResponse({
    status: 200,
    description: 'Acesso liberado.',
  })
  @ApiResponse({
    status: 403,
    type: ErrorResponseDto,
    description: 'Acesso negado: Perfil do usuário não possui permissão DONO.',
  })
  adminOnly(@CurrentUser() user: UserPayload) {
    return { message: 'Acesso liberado apenas para perfil DONO', user };
  }
}

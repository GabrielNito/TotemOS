import {
  Body,
  Controller,
  Headers,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiHeader,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Role } from '@prisma/client';
import { AnyAuthGuard } from '../auth/guards/any-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { UserPayload } from '../auth/decorators/current-user.decorator';
import { ErrorResponseDto } from '../auth/dto/auth-response.dto';
import {
  LiberacaoDemoDto,
  LiberacaoDemoResponseDto,
} from './dto/liberacao-demo.dto';
import { LiberacaoDemoService } from './liberacao-demo.service';

@ApiTags('Pedidos')
@Controller('pedidos')
export class PedidosDemoController {
  constructor(private readonly demo: LiberacaoDemoService) {}

  @Post(':id/liberacao-demo')
  @HttpCode(200)
  @UseGuards(AnyAuthGuard, RolesGuard)
  @Roles(Role.DONO)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Libera operacionalmente pedido DEMO sem criar pagamento',
    description:
      'Exclusivo para DONO com PIN, tenant autorizado e ambiente não produtivo configurado. Não aprova transação financeira.',
  })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description:
      'UUID persistido antes do envio; repetir com o mesmo conteúdo.',
  })
  @ApiBody({ type: LiberacaoDemoDto })
  @ApiResponse({
    status: 200,
    type: LiberacaoDemoResponseDto,
    description:
      'Liberação confirmada ou replay; estado atual sem novo efeito.',
  })
  @ApiResponse({
    status: 400,
    type: ErrorResponseDto,
    description: 'UUID, chave ou DTO inválido/campo extra.',
  })
  @ApiResponse({
    status: 401,
    type: ErrorResponseDto,
    description: 'Credencial inválida/expirada ou PIN incorreto.',
  })
  @ApiResponse({
    status: 403,
    type: ErrorResponseDto,
    description:
      'Ambiente desabilitado, tenant fora da allowlist ou identidade sem vínculo DONO.',
  })
  @ApiResponse({
    status: 404,
    type: ErrorResponseDto,
    description: 'Pedido inexistente ou de outro tenant.',
  })
  @ApiResponse({
    status: 409,
    type: ErrorResponseDto,
    description: 'Estado/versão, marca DEMO, financeiro ou chave conflitantes.',
  })
  @ApiResponse({
    status: 429,
    description: 'Máximo de cinco tentativas por minuto.',
  })
  @ApiResponse({
    status: 503,
    type: ErrorResponseDto,
    description: 'Falha transitória; recuperar pela mesma chave.',
  })
  liberar(
    @CurrentUser() user: UserPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: LiberacaoDemoDto,
    @Headers('idempotency-key') key?: string,
  ) {
    return this.demo.liberar(user, id, dto, key);
  }
}

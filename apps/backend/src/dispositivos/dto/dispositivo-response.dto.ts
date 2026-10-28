import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TipoDispositivo } from '@prisma/client';

export class DispositivoResumoDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  negocioId!: string;

  @ApiProperty()
  nome!: string;

  @ApiProperty({ enum: TipoDispositivo })
  tipo!: TipoDispositivo;

  @ApiProperty({ nullable: true, format: 'date-time' })
  pareadoEm!: Date | null;

  @ApiProperty()
  ativo!: boolean;

  @ApiPropertyOptional({ nullable: true, format: 'date-time' })
  revogadoEm!: Date | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: Date;
}

export class GerarCodigoResponseDto {
  @ApiProperty({ pattern: '^\\d{6}$' })
  codigo!: string;

  @ApiProperty({ format: 'date-time' })
  expiraEm!: Date;
}

export class AtivarDispositivoResponseDto {
  @ApiProperty({ minLength: 43, description: 'Exibido somente nesta resposta' })
  deviceToken!: string;

  @ApiProperty({ type: DispositivoResumoDto })
  dispositivo!: DispositivoResumoDto;
}

export class ListarDispositivosResponseDto {
  @ApiProperty({ type: [DispositivoResumoDto] })
  dispositivos!: DispositivoResumoDto[];
}

export class DispositivoMeResponseDto {
  @ApiProperty({ type: DispositivoResumoDto })
  dispositivo!: DispositivoResumoDto;
}

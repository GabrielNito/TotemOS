import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const ConfiguracaoQuerySchema = z.object({}).strict();

export class ConfiguracaoQueryDto extends createZodDto(
  ConfiguracaoQuerySchema,
) {}

export const AtualizarConfiguracaoNegocioSchema = z
  .object({
    pin: z
      .string()
      .regex(/^\d{4}$/, 'PIN deve conter exatamente 4 dígitos numéricos')
      .describe('PIN de 4 dígitos do dono do estabelecimento'),
    modoIdentificacao: z
      .enum(['OPCIONAL', 'NOME', 'CODIGO'])
      .optional()
      .describe('Modo de identificação do cliente no totem'),
    tempoPadraoPreparo: z
      .number()
      .int('Tempo padrão de preparo deve ser um número inteiro')
      .min(1, 'Tempo padrão de preparo deve ser de pelo menos 1 minuto')
      .max(120, 'Tempo padrão de preparo não pode exceder 120 minutos')
      .optional()
      .describe('Tempo padrão estimado de preparo em minutos (1 a 120)'),
    mensagemBoasVindas: z
      .string()
      .trim()
      .max(200, 'Mensagem de boas-vindas deve ter no máximo 200 caracteres')
      .transform((val) => (val.length === 0 ? null : val))
      .nullable()
      .optional()
      .describe(
        'Mensagem de boas-vindas exibida no totem (ou null para limpar)',
      ),
    permitirPagamentoOffline: z
      .boolean()
      .refine((val) => val === false, {
        message:
          'Pagamento offline não é operacional no P0 e não pode ser habilitado.',
      })
      .optional()
      .describe(
        'Flag legada mantida como false até existir serviço operacional de pagamento offline',
      ),
  })
  .strict()
  .refine(
    (data) =>
      data.modoIdentificacao !== undefined ||
      data.tempoPadraoPreparo !== undefined ||
      data.mensagemBoasVindas !== undefined ||
      data.permitirPagamentoOffline !== undefined,
    {
      message: 'Informe ao menos um campo de configuração para atualizar.',
    },
  );

export class AtualizarConfiguracaoNegocioDto extends createZodDto(
  AtualizarConfiguracaoNegocioSchema,
) {}

export const ConfiguracaoNegocioResponseSchema = z.object({
  negocioId: z.string().uuid(),
  modoIdentificacao: z.enum(['OPCIONAL', 'NOME', 'CODIGO']),
  tempoPadraoPreparo: z.number().int().min(1).max(120),
  mensagemBoasVindas: z.string().nullable(),
  permitirPagamentoOffline: z.literal(false),
  pagamentoOfflineOperacional: z.literal(false),
  pagamentoOfflineStatus: z.literal('NAO_OPERACIONAL'),
});

export class ConfiguracaoNegocioResponseDto extends createZodDto(
  ConfiguracaoNegocioResponseSchema,
) {}

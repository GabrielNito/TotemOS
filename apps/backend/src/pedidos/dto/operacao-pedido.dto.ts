import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { StatusPedido } from '@prisma/client';

export class TransicaoPedidoDto extends createZodDto(
  z
    .object({
      status: z.enum(['EM_PREPARO', 'PRONTO', 'ENTREGUE']),
      versaoEsperada: z.number().int().positive(),
    })
    .strict(),
) {}
export class FilaQueryDto extends createZodDto(
  z
    .object({
      limite: z.coerce.number().int().min(1).max(100).default(50),
      cursor: z.string().min(1).max(512).optional(),
    })
    .strict(),
) {}
const resumo = z.object({
  id: z.string().uuid(),
  status: z.nativeEnum(StatusPedido),
  senha: z.number().int().nullable(),
  versao: z.number().int(),
  demo: z.boolean(),
  demoAmbiente: z.string().nullable(),
});
const autorizacao = z
  .object({ tipo: z.literal('DEMO'), financeira: z.literal(false) })
  .nullable();
export class TransicaoResponseDto extends createZodDto(
  z.object({
    resultadoOperacao: z.object({
      tipo: z.literal('TRANSICAO'),
      repetida: z.boolean(),
    }),
    pedido: resumo.extend({ elegivelCozinha: z.boolean() }),
  }),
) {}
export class AcompanhamentoResponseDto extends createZodDto(
  resumo.extend({
    valorTotal: z.string(),
    autorizacaoOperacional: autorizacao,
  }),
) {}
export class FilaResponseDto extends createZodDto(
  z.object({
    pedidos: z.array(
      resumo.extend({
        createdAt: z.iso.datetime(),
        preparoZero: z.boolean(),
        elegivelCozinha: z.literal(true),
        autorizacaoOperacional: autorizacao,
        itens: z.array(
          z.object({
            nomeProduto: z.string(),
            quantidade: z.number(),
            variacaoNome: z.string().nullable(),
            observacao: z.string().nullable(),
            adicionais: z.array(
              z.object({ nomeAdicional: z.string(), quantidade: z.number() }),
            ),
            escolhas: z.array(z.object({ nomeItem: z.string() })),
          }),
        ),
      }),
    ),
    proximoCursor: z.string().nullable(),
  }),
) {}

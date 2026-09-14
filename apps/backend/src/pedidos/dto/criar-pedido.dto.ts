import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const ItemAdicionalInputSchema = z
  .object({
    adicionalId: z
      .string()
      .uuid('ID do adicional inválido — deve ser um UUID')
      .describe('UUID do adicional cadastrado no catálogo'),
    quantidade: z
      .number()
      .int('Quantidade de adicionais deve ser um número inteiro')
      .min(1, 'Quantidade de adicionais deve ser pelo menos 1')
      .default(1)
      .describe('Quantidade do adicional a ser adicionada ao item'),
  })
  .strict();

export const ItemEscolhaInputSchema = z
  .object({
    itemDoGrupoId: z
      .string()
      .uuid('ID do item de escolha inválido — deve ser um UUID')
      .describe('UUID do item selecionado no grupo de escolha do combo'),
  })
  .strict();

export const PedidoItemInputSchema = z
  .object({
    produtoId: z
      .string()
      .uuid('ID do produto inválido — deve ser um UUID')
      .describe('UUID do produto selecionado'),
    quantidade: z
      .number()
      .int('Quantidade deve ser um número inteiro')
      .min(1, 'Quantidade mínima por item é 1')
      .default(1)
      .describe('Quantidade do produto no pedido'),
    observacao: z
      .string()
      .max(255, 'Observação não pode exceder 255 caracteres')
      .optional()
      .describe('Texto livre de observação do cliente para este item'),
    variacaoNome: z
      .string()
      .optional()
      .describe('Nome da variação escolhida (ex: 300ml, Grande)'),
    adicionais: z
      .array(ItemAdicionalInputSchema)
      .optional()
      .describe('Adicionais selecionados para este item'),
    escolhas: z
      .array(ItemEscolhaInputSchema)
      .optional()
      .describe('Escolhas de itens de combo para este item'),
  })
  .strict();

export const CriarPedidoSchema = z
  .object({
    idempotencyKey: z
      .string()
      .uuid('idempotencyKey deve ser um UUID válido')
      .optional()
      .describe('Chave única de idempotência enviada pelo cliente'),
    nomeCliente: z
      .string()
      .min(1, 'Nome do cliente não pode ser vazio')
      .optional()
      .describe('Nome informado pelo cliente no totem'),
    codigoCliente: z
      .string()
      .min(1, 'Código do cliente não pode ser vazio')
      .optional()
      .describe(
        'Código alfanumérico gerado caso o cliente não queira informar nome',
      ),
    observacoes: z
      .string()
      .max(500, 'Observações gerais não podem exceder 500 caracteres')
      .optional()
      .describe('Observações gerais para o pedido'),
    itens: z
      .array(PedidoItemInputSchema)
      .min(1, 'O pedido deve conter no mínimo 1 item')
      .describe('Lista de itens que compõem o pedido'),
  })
  .strict();

export class CriarPedidoDto extends createZodDto(CriarPedidoSchema) {}

import { z } from "zod"

export const ModoIdentificacaoSchema = z.enum(["OPCIONAL", "NOME", "CODIGO"])

export const ConfiguracaoNegocioResponseSchema = z.object({
  negocioId: z.string().min(1),
  modoIdentificacao: ModoIdentificacaoSchema,
  tempoPadraoPreparo: z.number().int().min(1).max(120),
  mensagemBoasVindas: z.string().max(200).nullable(),
  permitirPagamentoOffline: z.literal(false),
  pagamentoOfflineOperacional: z.literal(false),
  pagamentoOfflineStatus: z.literal("NAO_OPERACIONAL"),
})

export const ConfiguracaoOperacionalFormSchema = z.object({
  modoIdentificacao: ModoIdentificacaoSchema,
  tempoPadraoPreparo: z.coerce
    .number({
      message: "Informe um número inteiro de minutos para o preparo.",
    })
    .int("O tempo padrão de preparo deve ser um número inteiro.")
    .min(1, "O tempo padrão de preparo deve ser de pelo menos 1 minuto.")
    .max(120, "O tempo padrão de preparo não pode exceder 120 minutos."),
  mensagemBoasVindas: z
    .string()
    .trim()
    .max(200, "A mensagem de boas-vindas deve ter no máximo 200 caracteres.")
    .transform((val) => (val.length === 0 ? null : val)),
  pin: z
    .string()
    .regex(/^\d{4}$/, "Informe o PIN de 4 dígitos numéricos do dono."),
})

export type ConfiguracaoOperacionalFormValues = z.infer<
  typeof ConfiguracaoOperacionalFormSchema
>

export const ValidarPinFormSchema = z.object({
  pin: z
    .string()
    .regex(/^\d{4}$/, "O PIN deve conter exatamente 4 dígitos numéricos."),
})

import { z } from "zod"

export const LoginSchema = z.object({
  email: z
    .string()
    .min(1, "O e-mail é obrigatório")
    .email("Formato de e-mail inválido"),
  senhaPlana: z.string().min(6, "A senha deve ter no mínimo 6 caracteres"),
})

export type LoginFormValues = z.infer<typeof LoginSchema>

export const RegistrarSchema = z.object({
  nomeNegocio: z
    .string()
    .min(3, "O nome do estabelecimento deve ter no mínimo 3 caracteres"),
  slugNegocio: z
    .string()
    .min(3, "O identificador (slug) deve ter no mínimo 3 caracteres")
    .regex(
      /^[a-z0-9-]+$/,
      "O slug deve conter apenas letras minúsculas, números e hífens"
    ),
  pinDono: z
    .string()
    .length(4, "O PIN deve conter exatamente 4 dígitos numéricos")
    .regex(/^\d{4}$/, "O PIN deve conter apenas números"),
  nomeUsuario: z
    .string()
    .min(2, "O nome do responsável deve ter no mínimo 2 caracteres"),
  email: z
    .string()
    .min(1, "O e-mail é obrigatório")
    .email("Formato de e-mail inválido"),
  senhaPlana: z.string().min(6, "A senha deve ter no mínimo 6 caracteres"),
})

export type RegistrarFormValues = z.infer<typeof RegistrarSchema>

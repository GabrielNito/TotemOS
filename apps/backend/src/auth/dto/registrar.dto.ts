import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const RegistrarSchema = z.object({
  nomeNegocio: z
    .string()
    .min(3, 'O nome do negócio deve ter no mínimo 3 caracteres')
    .describe('Nome comercial do estabelecimento (ex: Hamburgueria Artesanal)'),
  slugNegocio: z
    .string()
    .min(3, 'O slug do negócio deve ter no mínimo 3 caracteres')
    .regex(
      /^[a-z0-9-]+$/,
      'O slug deve conter apenas letras minúsculas, números e hífens',
    )
    .describe(
      'Slug único para identificação do estabelecimento na URL (ex: hamburgueria-artesanal)',
    ),
  pinDono: z
    .string()
    .length(4, 'O PIN do dono deve conter exatamente 4 dígitos numéricos')
    .regex(/^\d{4}$/, 'O PIN deve ser composto apenas por 4 números')
    .describe('PIN numérico de 4 dígitos para operações sensíveis do dono'),
  nomeUsuario: z
    .string()
    .min(2, 'O nome do responsável deve ter no mínimo 2 caracteres')
    .describe('Nome completo do lojista/administrador'),
  email: z
    .string()
    .email('Formato de e-mail inválido')
    .describe('E-mail do responsável para login na Dashboard'),
  senhaPlana: z
    .string()
    .min(6, 'A senha deve ter no mínimo 6 caracteres')
    .describe('Senha de acesso da conta em texto plano'),
});

export class RegistrarDto extends createZodDto(RegistrarSchema) {
  nomeNegocio!: string;
  slugNegocio!: string;
  pinDono!: string;
  nomeUsuario!: string;
  email!: string;
  senhaPlana!: string;
}

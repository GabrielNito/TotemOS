import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const LoginSchema = z.object({
  email: z
    .string()
    .email('Formato de e-mail inválido')
    .describe('E-mail cadastrado do lojista (ex: admin@totemos.com.br)'),
  senhaPlana: z
    .string()
    .min(6, 'A senha deve ter no mínimo 6 caracteres')
    .describe('Senha de acesso em texto plano'),
});

export class LoginDto extends createZodDto(LoginSchema) {
  email!: string;
  senhaPlana!: string;
}

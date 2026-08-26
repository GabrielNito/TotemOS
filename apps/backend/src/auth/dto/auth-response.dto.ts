import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const UsuarioPayloadSchema = z.object({
  id: z.string().uuid().describe('UUID do usuário'),
  nome: z.string().describe('Nome completo do usuário'),
  email: z.string().email().describe('E-mail do usuário'),
  role: z
    .enum(['DONO', 'GERENTE'])
    .describe('Perfil de acesso (DONO / GERENTE)'),
  negocioId: z.string().uuid().describe('UUID do Negócio associado'),
  negocioNome: z.string().describe('Nome fantasia do Negócio'),
});

export const LoginResponseSchema = z.object({
  accessToken: z
    .string()
    .describe('Token JWT com prazo de expiração de 7 dias'),
  usuario: UsuarioPayloadSchema,
});

export class LoginResponseDto extends createZodDto(LoginResponseSchema) {}

export const ValidarPinResponseSchema = z.object({
  valido: z.boolean().describe('Indica se o PIN fornecido é válido'),
});

export class ValidarPinResponseDto extends createZodDto(
  ValidarPinResponseSchema,
) {}

export const ErrorResponseSchema = z.object({
  statusCode: z.number().describe('Código HTTP de status do erro'),
  message: z
    .union([z.string(), z.array(z.string())])
    .describe('Mensagem ou lista de erros de validação'),
  error: z.string().describe('Nome da exceção HTTP'),
});

export class ErrorResponseDto extends createZodDto(ErrorResponseSchema) {}

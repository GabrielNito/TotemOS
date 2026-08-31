import { createZodDto } from 'nestjs-zod';
import { CriarProdutoSchema } from './criar-produto.dto';

export const AtualizarProdutoSchema = CriarProdutoSchema.partial();

export class AtualizarProdutoDto extends createZodDto(AtualizarProdutoSchema) {}

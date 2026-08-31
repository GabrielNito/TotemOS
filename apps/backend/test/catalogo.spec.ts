import { test, expect, describe } from 'bun:test';
import { CriarCategoriaSchema } from '../src/catalogo/dto/criar-categoria.dto';
import { CriarProdutoSchema } from '../src/catalogo/dto/criar-produto.dto';
import { AtualizarProdutoSchema } from '../src/catalogo/dto/atualizar-produto.dto';

describe('Catálogo — Validação de Schemas Zod (TDD)', () => {
  // ─── Categoria ────────────────────────────────────────────────────────────

  describe('CriarCategoriaSchema', () => {
    test('aceita payload válido com nome e ordem', () => {
      const resultado = CriarCategoriaSchema.safeParse({
        nome: 'Lanches',
        ordem: 1,
      });
      expect(resultado.success).toBe(true);
    });

    test('aceita payload sem ordem (usa default 0)', () => {
      const resultado = CriarCategoriaSchema.safeParse({ nome: 'Bebidas' });
      expect(resultado.success).toBe(true);
      if (resultado.success) {
        expect(resultado.data.ordem).toBe(0);
      }
    });

    test('rejeita nome vazio', () => {
      const resultado = CriarCategoriaSchema.safeParse({ nome: '' });
      expect(resultado.success).toBe(false);
    });

    test('rejeita ordem negativa', () => {
      const resultado = CriarCategoriaSchema.safeParse({
        nome: 'Sobremesas',
        ordem: -1,
      });
      expect(resultado.success).toBe(false);
    });
  });

  // ─── Produto ──────────────────────────────────────────────────────────────

  describe('CriarProdutoSchema', () => {
    const categoriaId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

    test('aceita payload válido completo', () => {
      const resultado = CriarProdutoSchema.safeParse({
        categoriaId,
        nome: 'X-Burguer',
        descricao: 'Delicioso hambúrguer artesanal',
        precoBase: 29.9,
        tempoEstimadoPreparo: 15,
      });
      expect(resultado.success).toBe(true);
    });

    test('aceita tempoEstimadoPreparo = 0 (produto sem preparo)', () => {
      const resultado = CriarProdutoSchema.safeParse({
        categoriaId,
        nome: 'Coca-Cola Lata',
        precoBase: 7.5,
        tempoEstimadoPreparo: 0,
      });
      expect(resultado.success).toBe(true);
      if (resultado.success) {
        expect(resultado.data.tempoEstimadoPreparo).toBe(0);
      }
    });

    test('usa tempoEstimadoPreparo = 0 como default', () => {
      const resultado = CriarProdutoSchema.safeParse({
        categoriaId,
        nome: 'Água Mineral',
        precoBase: 5.0,
      });
      expect(resultado.success).toBe(true);
      if (resultado.success) {
        expect(resultado.data.tempoEstimadoPreparo).toBe(0);
      }
    });

    test('rejeita precoBase negativo', () => {
      const resultado = CriarProdutoSchema.safeParse({
        categoriaId,
        nome: 'Produto Inválido',
        precoBase: -10,
      });
      expect(resultado.success).toBe(false);
    });

    test('rejeita precoBase zero', () => {
      const resultado = CriarProdutoSchema.safeParse({
        categoriaId,
        nome: 'Produto Inválido',
        precoBase: 0,
      });
      expect(resultado.success).toBe(false);
    });

    test('rejeita tempoEstimadoPreparo negativo', () => {
      const resultado = CriarProdutoSchema.safeParse({
        categoriaId,
        nome: 'Produto',
        precoBase: 10,
        tempoEstimadoPreparo: -5,
      });
      expect(resultado.success).toBe(false);
    });

    test('rejeita nome vazio', () => {
      const resultado = CriarProdutoSchema.safeParse({
        categoriaId,
        nome: '',
        precoBase: 10,
      });
      expect(resultado.success).toBe(false);
    });

    test('rejeita categoriaId com formato inválido (não-UUID)', () => {
      const resultado = CriarProdutoSchema.safeParse({
        categoriaId: 'nao-e-um-uuid',
        nome: 'Produto',
        precoBase: 10,
      });
      expect(resultado.success).toBe(false);
    });

    test('aceita adicionais no body', () => {
      const resultado = CriarProdutoSchema.safeParse({
        categoriaId,
        nome: 'X-Especial',
        precoBase: 35.0,
        adicionais: [
          { nome: 'Bacon Extra', preco: 5.0, maximo: 2 },
          { nome: 'Queijo Extra', preco: 3.5, maximo: 1 },
        ],
      });
      expect(resultado.success).toBe(true);
    });

    test('rejeita adicional com preco negativo', () => {
      const resultado = CriarProdutoSchema.safeParse({
        categoriaId,
        nome: 'X-Especial',
        precoBase: 35.0,
        adicionais: [{ nome: 'Adicional Inválido', preco: -2, maximo: 1 }],
      });
      expect(resultado.success).toBe(false);
    });

    test('rejeita adicional com nome vazio', () => {
      const resultado = CriarProdutoSchema.safeParse({
        categoriaId,
        nome: 'X-Especial',
        precoBase: 35.0,
        adicionais: [{ nome: '', preco: 3, maximo: 1 }],
      });
      expect(resultado.success).toBe(false);
    });
  });

  // ─── Atualizar Produto (partial) ──────────────────────────────────────────

  describe('AtualizarProdutoSchema', () => {
    test('aceita payload parcial (só nome)', () => {
      const resultado = AtualizarProdutoSchema.safeParse({ nome: 'Novo Nome' });
      expect(resultado.success).toBe(true);
    });

    test('aceita payload parcial (só precoBase)', () => {
      const resultado = AtualizarProdutoSchema.safeParse({ precoBase: 49.9 });
      expect(resultado.success).toBe(true);
    });

    test('aceita payload vazio (nenhum campo obrigatório)', () => {
      const resultado = AtualizarProdutoSchema.safeParse({});
      expect(resultado.success).toBe(true);
    });

    test('rejeita precoBase negativo mesmo no update parcial', () => {
      const resultado = AtualizarProdutoSchema.safeParse({ precoBase: -5 });
      expect(resultado.success).toBe(false);
    });

    test('rejeita tempoEstimadoPreparo negativo mesmo no update parcial', () => {
      const resultado = AtualizarProdutoSchema.safeParse({
        tempoEstimadoPreparo: -1,
      });
      expect(resultado.success).toBe(false);
    });

    test('aceita atualização com novos adicionais e adicionais existentes', () => {
      const adicionalExistenteId = 'b2c3d4e5-f6a7-8901-bcde-f12345678901';
      const resultado = AtualizarProdutoSchema.safeParse({
        nome: 'X-Burguer Duplo',
        precoBase: 38.0,
        adicionais: [
          {
            id: adicionalExistenteId,
            nome: 'Bacon Duplo',
            preco: 7.0,
            maximo: 3,
            esgotado: false,
          },
          {
            nome: 'Molho Especial',
            preco: 2.5,
            maximo: 2,
          },
        ],
      });
      expect(resultado.success).toBe(true);
    });

    test('rejeita adicional com preco negativo na atualizacao', () => {
      const resultado = AtualizarProdutoSchema.safeParse({
        adicionais: [
          {
            nome: 'Adicional Inválido',
            preco: -3.0,
          },
        ],
      });
      expect(resultado.success).toBe(false);
    });

    test('rejeita adicional com maximo menor que 1 na atualizacao', () => {
      const resultado = AtualizarProdutoSchema.safeParse({
        adicionais: [
          {
            nome: 'Adicional Inválido',
            preco: 2.0,
            maximo: 0,
          },
        ],
      });
      expect(resultado.success).toBe(false);
    });
  });

  // ─── Regra de negócio: isolamento de tenant ───────────────────────────────

  describe('Isolamento de Tenant (lógica de filtro)', () => {
    interface Produto {
      id: string;
      negocioId: string;
      nome: string;
      ativo: boolean;
    }

    const produtos: Produto[] = [
      { id: '1', negocioId: 'tenant-A', nome: 'Burguer', ativo: true },
      { id: '2', negocioId: 'tenant-A', nome: 'Fritas', ativo: false },
      { id: '3', negocioId: 'tenant-B', nome: 'Pizza', ativo: true },
    ];

    const listarCatalogoPublico = (negocioId: string): Produto[] =>
      produtos.filter((p) => p.negocioId === negocioId && p.ativo === true);

    test('tenant A só vê seus produtos ativos', () => {
      const resultado = listarCatalogoPublico('tenant-A');
      expect(resultado).toHaveLength(1);
      expect(resultado[0].nome).toBe('Burguer');
    });

    test('produto com ativo=false não aparece na listagem pública', () => {
      const resultado = listarCatalogoPublico('tenant-A');
      const nomesRetornados = resultado.map((p) => p.nome);
      expect(nomesRetornados).not.toContain('Fritas');
    });

    test('tenant A não vê produtos do tenant B', () => {
      const resultado = listarCatalogoPublico('tenant-A');
      const negociosRetornados = resultado.map((p) => p.negocioId);
      expect(negociosRetornados.every((id) => id === 'tenant-A')).toBe(true);
    });

    test('tenant B só vê seus próprios produtos', () => {
      const resultado = listarCatalogoPublico('tenant-B');
      expect(resultado).toHaveLength(1);
      expect(resultado[0].nome).toBe('Pizza');
    });
  });
});

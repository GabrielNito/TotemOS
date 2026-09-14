import { test, expect, describe } from 'bun:test';
import {
  CriarPedidoSchema,
  PedidoItemInputSchema,
  ItemAdicionalInputSchema,
} from '../src/pedidos/dto/criar-pedido.dto';

describe('Pedidos — Validação de Schemas Zod e Bloqueio de Fraude (TDD)', () => {
  const produtoUuid1 = 'a1b2c3d4-e5f6-4890-abcd-ef1234567890';
  const produtoUuid2 = 'b2c3d4e5-f6a7-4901-8cde-f12345678902';
  const adicionalUuid1 = 'c3d4e5f6-a7b8-4012-9def-123456789012';

  describe('CriarPedidoSchema — Regras de Entrada e Validação', () => {
    test('aceita payload válido com 1 item', () => {
      const payload = {
        nomeCliente: 'Gabriel',
        itens: [
          {
            produtoId: produtoUuid1,
            quantidade: 1,
            observacao: 'Sem cebola',
          },
        ],
      };

      const resultado = CriarPedidoSchema.safeParse(payload);
      expect(resultado.success).toBe(true);
      if (resultado.success) {
        expect(resultado.data.itens).toHaveLength(1);
        expect(resultado.data.itens[0].produtoId).toBe(produtoUuid1);
        expect(resultado.data.itens[0].quantidade).toBe(1);
      }
    });

    test('aceita payload com múltiplos itens e adicionais válidos', () => {
      const payload = {
        codigoCliente: 'TOTEM-42',
        itens: [
          {
            produtoId: produtoUuid1,
            quantidade: 2,
            adicionais: [
              {
                adicionalId: adicionalUuid1,
                quantidade: 2,
              },
            ],
          },
          {
            produtoId: produtoUuid2,
            quantidade: 1,
          },
        ],
      };

      const resultado = CriarPedidoSchema.safeParse(payload);
      expect(resultado.success).toBe(true);
      if (resultado.success) {
        expect(resultado.data.itens).toHaveLength(2);
      }
    });

    test('rejeita payload sem lista de itens ou com itens vazio', () => {
      const payloadVazio = {
        nomeCliente: 'Carlos',
        itens: [],
      };

      const resultado = CriarPedidoSchema.safeParse(payloadVazio);
      expect(resultado.success).toBe(false);
    });

    test('rejeita produtoId com formato inválido (não-UUID)', () => {
      const payload = {
        itens: [
          {
            produtoId: 'id-invalido-nao-uuid',
            quantidade: 1,
          },
        ],
      };

      const resultado = CriarPedidoSchema.safeParse(payload);
      expect(resultado.success).toBe(false);
    });

    test('rejeita item com quantidade menor ou igual a zero', () => {
      const payloadZero = {
        itens: [
          {
            produtoId: produtoUuid1,
            quantidade: 0,
          },
        ],
      };
      const resultadoZero = CriarPedidoSchema.safeParse(payloadZero);
      expect(resultadoZero.success).toBe(false);

      const payloadNegativo = {
        itens: [
          {
            produtoId: produtoUuid1,
            quantidade: -2,
          },
        ],
      };
      const resultadoNegativo = CriarPedidoSchema.safeParse(payloadNegativo);
      expect(resultadoNegativo.success).toBe(false);
    });

    test('rejeita adicional com quantidade menor ou igual a zero', () => {
      const payload = {
        itens: [
          {
            produtoId: produtoUuid1,
            quantidade: 1,
            adicionais: [
              {
                adicionalId: adicionalUuid1,
                quantidade: 0,
              },
            ],
          },
        ],
      };

      const resultado = CriarPedidoSchema.safeParse(payload);
      expect(resultado.success).toBe(false);
    });
  });

  describe('Bloqueio Estrito de Preço Adulterado (Fraude / Tampering Prevention)', () => {
    test('rejeita payload com campo "valorTotal" no nível raiz', () => {
      const payload = {
        nomeCliente: 'Atacante',
        valorTotal: 0.01,
        itens: [
          {
            produtoId: produtoUuid1,
            quantidade: 1,
          },
        ],
      };

      const resultado = CriarPedidoSchema.safeParse(payload);
      expect(resultado.success).toBe(false);
    });

    test('rejeita payload com "preco" ou "precoBase" no nível raiz', () => {
      const payloadPreco = {
        preco: 1.0,
        itens: [{ produtoId: produtoUuid1, quantidade: 1 }],
      };
      expect(CriarPedidoSchema.safeParse(payloadPreco).success).toBe(false);

      const payloadPrecoBase = {
        precoBase: 1.0,
        itens: [{ produtoId: produtoUuid1, quantidade: 1 }],
      };
      expect(CriarPedidoSchema.safeParse(payloadPrecoBase).success).toBe(false);
    });

    test('rejeita payload com "precoNoMomento" ou "preco" dentro do item', () => {
      const payloadItemComPreco = {
        itens: [
          {
            produtoId: produtoUuid1,
            quantidade: 1,
            precoNoMomento: 0.5,
          },
        ],
      };

      const resultado = CriarPedidoSchema.safeParse(payloadItemComPreco);
      expect(resultado.success).toBe(false);
    });

    test('rejeita adicional com "preco" ou "precoNoMomento"', () => {
      const payloadAdicionalComPreco = {
        itens: [
          {
            produtoId: produtoUuid1,
            quantidade: 1,
            adicionais: [
              {
                adicionalId: adicionalUuid1,
                quantidade: 1,
                precoNoMomento: 0.1,
              },
            ],
          },
        ],
      };

      const resultado = CriarPedidoSchema.safeParse(payloadAdicionalComPreco);
      expect(resultado.success).toBe(false);
    });
  });
});

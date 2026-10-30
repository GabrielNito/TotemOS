import { describe, expect, test } from 'bun:test';
import type { PrismaService } from '../src/prisma/prisma.service';
import { CategoriasService } from '../src/catalogo/categorias.service';
import { ProdutosService } from '../src/catalogo/produtos.service';
import { AtualizarCategoriaSchema } from '../src/catalogo/dto/atualizar-categoria.dto';
import { NotFoundException } from '@nestjs/common';

describe('Catálogo administrativo', () => {
  const negocioId = 'negocio-do-teste';

  test('lista categorias e produtos do tenant sem ocultar status administrativos', async () => {
    const consultasCategorias: unknown[] = [];
    const consultasProdutos: unknown[] = [];
    const prisma = {
      categoria: {
        findMany: (consulta: unknown) => {
          consultasCategorias.push(consulta);
          return Promise.resolve([{ id: 'cat-inativa', ativo: false }]);
        },
      },
      produto: {
        findMany: (consulta: unknown) => {
          consultasProdutos.push(consulta);
          return Promise.resolve([
            { id: 'produto-pausado', ativo: false, esgotado: true },
          ]);
        },
      },
    };
    const service = new ProdutosService(
      prisma as unknown as PrismaService,
      {} as CategoriasService,
    );

    const catalogo = await service.listarCatalogoAdministrativo(negocioId);

    expect(catalogo as unknown).toEqual({
      categorias: [{ id: 'cat-inativa', ativo: false }],
      produtos: [{ id: 'produto-pausado', ativo: false, esgotado: true }],
    });
    expect(consultasCategorias).toEqual([
      expect.objectContaining({ where: { negocioId } }),
    ]);
    expect(consultasProdutos).toEqual([
      expect.objectContaining({ where: { negocioId } }),
    ]);
  });

  test('atualiza categoria somente depois de verificar a propriedade no tenant', async () => {
    const atualizacoes: unknown[] = [];
    const prisma = {
      categoria: {
        updateMany: (consulta: unknown) => {
          atualizacoes.push(consulta);
          return Promise.resolve({ count: 1 });
        },
        findFirstOrThrow: (consulta: unknown) => {
          atualizacoes.push(consulta);
          return Promise.resolve({ id: 'categoria-1', ativo: false });
        },
      },
    };
    const service = new CategoriasService(prisma as unknown as PrismaService);

    await service.atualizar(negocioId, 'categoria-1', {
      nome: 'Bebidas',
      ativo: false,
    });

    expect(atualizacoes).toEqual([
      {
        where: { id: 'categoria-1', negocioId },
        data: { nome: 'Bebidas', ativo: false },
      },
      { where: { id: 'categoria-1', negocioId } },
    ]);
  });

  test('aceita atualização parcial de categoria e rejeita ordem negativa', () => {
    expect(AtualizarCategoriaSchema.safeParse({ ativo: false }).success).toBe(
      true,
    );
    expect(AtualizarCategoriaSchema.safeParse({ ordem: -1 }).success).toBe(
      false,
    );
  });

  test('retorna 404 sem revelar categoria de outro tenant', async () => {
    const prisma = {
      categoria: {
        updateMany: () => Promise.resolve({ count: 0 }),
      },
    };
    const service = new CategoriasService(prisma as unknown as PrismaService);

    let erro: unknown;
    try {
      await service.atualizar(negocioId, 'categoria-de-outro-tenant', {
        ativo: false,
      });
    } catch (capturado) {
      erro = capturado;
    }
    expect(erro).toBeInstanceOf(NotFoundException);
  });

  test('filtra cada consulta e mutação de adicional pelo tenant do produto', async () => {
    const chamadas: Array<{ operacao: string; consulta: unknown }> = [];
    const tx = {
      adicional: {
        findMany: (consulta: unknown) => {
          chamadas.push({ operacao: 'findMany', consulta });
          return Promise.resolve([
            { id: 'adicional-1' },
            { id: 'adicional-2' },
          ]);
        },
        updateMany: (consulta: unknown) => {
          chamadas.push({ operacao: 'updateMany', consulta });
          return Promise.resolve({ count: 1 });
        },
        deleteMany: (consulta: unknown) => {
          chamadas.push({ operacao: 'deleteMany', consulta });
          return Promise.resolve({ count: 0 });
        },
      },
      produto: {
        updateMany: (consulta: unknown) => {
          chamadas.push({ operacao: 'produto.updateMany', consulta });
          return Promise.resolve({ count: 1 });
        },
        findFirstOrThrow: () => Promise.resolve({ id: 'produto-1', negocioId }),
      },
    };
    const prisma = {
      produto: {
        findFirst: () => Promise.resolve({ id: 'produto-1', negocioId }),
      },
      $transaction: (callback: (transaction: typeof tx) => unknown) =>
        Promise.resolve(callback(tx)),
    };
    const service = new ProdutosService(
      prisma as unknown as PrismaService,
      {} as CategoriasService,
    );

    await service.atualizar(negocioId, 'produto-1', {
      adicionais: [
        {
          id: 'adicional-1',
          nome: 'Bacon',
          preco: 4,
          maximo: 2,
          esgotado: false,
        },
      ],
    });

    const filtrosDeAdicional = chamadas
      .filter(({ operacao }) => operacao !== 'produto.updateMany')
      .map(({ consulta }) => consulta);

    expect(filtrosDeAdicional).toEqual([
      {
        where: {
          produtoId: 'produto-1',
          produto: { is: { negocioId } },
        },
      },
      {
        where: {
          id: 'adicional-1',
          produtoId: 'produto-1',
          produto: { is: { negocioId } },
        },
        data: {
          nome: 'Bacon',
          preco: 4,
          maximo: 2,
          esgotado: false,
        },
      },
      {
        where: {
          id: { in: ['adicional-2'] },
          produtoId: 'produto-1',
          produto: { is: { negocioId } },
        },
      },
    ]);
  });

  test('cria produto e adicionais usando a categoria validada no mesmo tenant', async () => {
    const verificacoes: unknown[] = [];
    let payloadCriacao: unknown;
    const prisma = {
      produto: {
        create: (consulta: unknown) => {
          payloadCriacao = consulta;
          return Promise.resolve({ id: 'produto-1' });
        },
      },
    };
    const categorias = {
      verificarPropriedade: (categoriaId: string, tenant: string) => {
        verificacoes.push({ categoriaId, tenant });
        return Promise.resolve({ id: categoriaId, negocioId: tenant });
      },
    };
    const service = new ProdutosService(
      prisma as unknown as PrismaService,
      categorias as unknown as CategoriasService,
    );

    await service.criar(negocioId, {
      categoriaId: 'categoria-1',
      nome: 'X-Bacon',
      precoBase: 25,
      tempoEstimadoPreparo: 12,
      esgotado: false,
      ativo: false,
      adicionais: [{ nome: 'Bacon', preco: 4, maximo: 2 }],
    });

    expect(verificacoes).toEqual([
      { categoriaId: 'categoria-1', tenant: negocioId },
    ]);
    expect(payloadCriacao).toEqual({
      data: {
        negocioId,
        categoriaId: 'categoria-1',
        nome: 'X-Bacon',
        descricao: undefined,
        precoBase: 25,
        imagemUrl: undefined,
        tempoEstimadoPreparo: 12,
        esgotado: false,
        ativo: false,
        adicionais: {
          create: [{ nome: 'Bacon', preco: 4, maximo: 2 }],
        },
      },
      include: {
        adicionais: true,
        categoria: { select: { id: true, nome: true } },
      },
    });
  });

  test('não atualiza produto de outro tenant', async () => {
    let transacaoIniciada = false;
    const prisma = {
      produto: {
        findFirst: () => Promise.resolve(null),
      },
      $transaction: () => {
        transacaoIniciada = true;
        return Promise.resolve();
      },
    };
    const service = new ProdutosService(
      prisma as unknown as PrismaService,
      {} as CategoriasService,
    );

    let erro: unknown;
    try {
      await service.atualizar(negocioId, 'produto-de-outro-tenant', {
        nome: 'Tentativa',
      });
    } catch (capturado) {
      erro = capturado;
    }

    expect(erro).toBeInstanceOf(NotFoundException);
    expect(transacaoIniciada).toBe(false);
  });

  test('não desativa produto de outro tenant', async () => {
    let atualizacaoExecutada = false;
    const prisma = {
      produto: {
        findFirst: () => Promise.resolve(null),
        updateMany: () => {
          atualizacaoExecutada = true;
          return Promise.resolve({ count: 1 });
        },
      },
    };
    const service = new ProdutosService(
      prisma as unknown as PrismaService,
      {} as CategoriasService,
    );

    let erro: unknown;
    try {
      await service.desativar(negocioId, 'produto-de-outro-tenant');
    } catch (capturado) {
      erro = capturado;
    }

    expect(erro).toBeInstanceOf(NotFoundException);
    expect(atualizacaoExecutada).toBe(false);
  });
});

import {
  createInitialSelection,
  createCartLine,
  formatCurrency,
  getSelectionSummary,
  normalizeCatalog,
  updateAdditionalQuantity,
  type CatalogProduct,
} from "./model";

const produto: CatalogProduct = {
  id: "produto-1",
  nome: "X-Burguer",
  descricao: "Pão, carne e queijo",
  precoBase: 25,
  imagemUrl: null,
  tempoEstimadoPreparo: 12,
  variacoes: [
    { id: "variacao-1", nome: "Tradicional", preco: 25, esgotado: false },
    { id: "variacao-2", nome: "Duplo", preco: 32.5, esgotado: false },
    { id: "variacao-3", nome: "Indisponível", preco: 40, esgotado: true },
  ],
  adicionais: [
    {
      id: "adicional-1",
      nome: "Bacon",
      preco: 4,
      maximo: 2,
      esgotado: false,
    },
    {
      id: "adicional-2",
      nome: "Molho especial",
      preco: 2.5,
      maximo: 1,
      esgotado: false,
    },
    {
      id: "adicional-3",
      nome: "Indisponível",
      preco: 9,
      maximo: 1,
      esgotado: true,
    },
  ],
};

test("carrinho exige variação e mantém snapshot e quantidade", () => {
  expect(() =>
    createCartLine(produto, createInitialSelection(produto), 1),
  ).toThrow();
  const line = createCartLine(
    produto,
    { variacaoId: "variacao-2", adicionais: { "adicional-1": 2 } },
    3,
  );
  expect(line.precoNoMomento).toBe(40.5);
  expect(line.quantidade).toBe(3);
  produto.precoBase = 99;
  expect(line.precoNoMomento).toBe(40.5);
  produto.precoBase = 25;
  expect(() => createCartLine(produto, line.selection, 0)).toThrow();
});

describe("modelo do catálogo do Totem", () => {
  test("não oferece categorias inativas nem produtos inativos ou esgotados", () => {
    const categories = normalizeCatalog([
      { id: "inactive", nome: "Oculta", ativo: false, produtos: [produto] },
      {
        id: "active",
        nome: "Disponíveis",
        ativo: true,
        produtos: [
          produto,
          { ...produto, id: "inactive-product", ativo: false },
          { ...produto, id: "sold-out-product", esgotado: true },
        ],
      },
    ]);
    expect(categories.map((category) => category.id)).toEqual(["active"]);
    expect(categories[0].produtos.map((product) => product.id)).toEqual([
      produto.id,
    ]);
  });

  test("normaliza preços serializados e remove conteúdo indisponível", () => {
    const catalogo = normalizeCatalog([
      {
        id: "categoria-1",
        nome: "Lanches",
        ativo: true,
        produtos: [
          {
            ...produto,
            precoBase: "25.90",
            adicionais: produto.adicionais?.map((adicional) => ({
              ...adicional,
              preco: String(adicional.preco),
            })),
          },
          { ...produto, id: "produto-esgotado", esgotado: true },
        ],
      },
      {
        id: "categoria-vazia",
        nome: "Sem itens",
        ativo: true,
        produtos: [{ ...produto, esgotado: true }],
      },
    ]);

    expect(catalogo).toHaveLength(1);
    expect(catalogo[0]?.produtos).toHaveLength(1);
    expect(catalogo[0]?.produtos[0]?.precoBase).toBe(25.9);
    expect(catalogo[0]?.produtos[0]?.variacoes).toHaveLength(2);
    expect(catalogo[0]?.produtos[0]?.adicionais).toHaveLength(2);
  });

  test("começa uma seleção sem variação ou adicionais marcados", () => {
    expect(createInitialSelection(produto)).toEqual({
      variacaoId: null,
      adicionais: {},
    });
  });

  test("respeita maximo e ignora adicional esgotado", () => {
    const inicial = createInitialSelection(produto);
    const umaUnidade = updateAdditionalQuantity(
      produto,
      inicial,
      "adicional-1",
      1,
    );
    const duasUnidades = updateAdditionalQuantity(
      produto,
      umaUnidade,
      "adicional-1",
      2,
    );
    const acimaDoLimite = updateAdditionalQuantity(
      produto,
      duasUnidades,
      "adicional-1",
      1,
    );
    const indisponivel = updateAdditionalQuantity(
      produto,
      acimaDoLimite,
      "adicional-3",
      1,
    );

    expect(umaUnidade.adicionais["adicional-1"]).toBe(1);
    expect(duasUnidades.adicionais["adicional-1"]).toBe(2);
    expect(acimaDoLimite.adicionais["adicional-1"]).toBe(2);
    expect(indisponivel).toBe(acimaDoLimite);
  });

  test("remove a quantidade quando o cliente reduz até zero", () => {
    const selecao = updateAdditionalQuantity(
      produto,
      { variacaoId: null, adicionais: { "adicional-2": 1 } },
      "adicional-2",
      -1,
    );

    expect(selecao).toEqual({ variacaoId: null, adicionais: {} });
  });

  test("gera resumo determinístico e calcula o total em centavos", () => {
    const resumo = getSelectionSummary(produto, {
      variacaoId: "variacao-2",
      adicionais: {
        "adicional-2": 1,
        "adicional-1": 2,
      },
    });

    expect(resumo.variacao?.nome).toBe("Duplo");
    expect(resumo.adicionais.map((item) => item.nome)).toEqual([
      "Bacon",
      "Molho especial",
    ]);
    expect(resumo.total).toBe(43);
    expect(formatCurrency(resumo.total)).toBe("R$ 43,00");
  });
});

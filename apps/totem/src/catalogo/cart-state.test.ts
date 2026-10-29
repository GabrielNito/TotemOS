import { createCartLine, type CatalogProduct } from "./model";
import { cartTotal, saveCartLine, changeCartQuantity } from "./cart-state";

const makeProduct = (): CatalogProduct => ({
  id: "business-product",
  nome: "Produto do negócio",
  descricao: "Receita cadastrada",
  precoBase: 12.9,
  imagemUrl: null,
  tempoEstimadoPreparo: 3,
  variacoes: [{ id: "large", nome: "Grande", preco: 19.9, esgotado: false }],
  adicionais: [
    { id: "cheese", nome: "Queijo", preco: 2.9, maximo: 3, esgotado: false },
  ],
});
const selection = { variacaoId: "large", adicionais: { cheese: 2 } };

test("a real cart line keeps independent catalog and selection snapshots", () => {
  const product = makeProduct();
  const chosen = { ...selection, adicionais: { ...selection.adicionais } };
  const line = createCartLine(product, chosen, 2);
  product.nome = "Renomeado";
  product.variacoes[0].nome = "Novo tamanho";
  product.variacoes[0].preco = 99;
  product.adicionais[0].preco = 80;
  chosen.adicionais.cheese = 3;
  expect(line.product.nome).toBe("Produto do negócio");
  expect(line.product.variacoes[0].nome).toBe("Grande");
  expect(line.product.adicionais[0].preco).toBe(2.9);
  expect(line.selection.adicionais.cheese).toBe(2);
  expect(line.precoNoMomento).toBe(25.7);
  expect(cartTotal([line])).toBe(51.4);
});

test("merges equal configurations, caps quantity and keeps distinct variation/additional choices", () => {
  const product = makeProduct();
  const first = createCartLine(product, selection, 98);
  const second = createCartLine(product, selection, 2);
  const merged = saveCartLine([first], second);
  expect(merged).toHaveLength(1);
  expect(merged[0].quantidade).toBe(99);
  expect(merged[0].key).toBe(first.key);
  const different = createCartLine(
    product,
    { ...selection, adicionais: { cheese: 1 } },
    1,
  );
  expect(saveCartLine(merged, different)).toHaveLength(2);
});

test("editing updates the intended line and quantity changes never recalculate its price", () => {
  const first = createCartLine(makeProduct(), selection, 1);
  const second = createCartLine(
    { ...makeProduct(), id: "other" },
    selection,
    1,
  );
  const edited = { ...first, quantidade: 3 };
  const cart = saveCartLine([first, second], edited, first.key);
  expect(cart.map((line) => line.key)).toEqual([first.key, second.key]);
  expect(cart[0].quantidade).toBe(3);
  const changed = changeCartQuantity(cart, first.key, 4);
  expect(cartTotal(changed)).toBe(128.5);
  expect(changed[0].precoNoMomento).toBe(first.precoNoMomento);
  expect(changeCartQuantity(changed, first.key, 0)).toBe(changed);
  expect(changeCartQuantity(changed, first.key, 100)).toBe(changed);
});

test("cart sums monetary snapshots in cents", () => {
  const line = createCartLine(makeProduct(), selection, 1);
  expect(
    cartTotal([
      { ...line, precoNoMomento: 0.1 },
      { ...line, key: "second", precoNoMomento: 0.2 },
    ]),
  ).toBe(0.3);
});

import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { BusinessProductScreen } from "./business-product";
import { ProductShell } from "../kiosk/product-shell";
import { Quantity } from "../kiosk/ui";
import { toMenuSections } from "./menu-model";
import { createCartLine, type CatalogProduct } from "./model";

jest.mock("../kiosk/product-shell", () => ({
  ProductShell: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));
jest.mock("../kiosk/motion", () => ({
  MotionSelection: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));
jest.mock("../kiosk/ui", () => ({
  KioskText: jest.requireActual("react-native").Text,
  Quantity: () => null,
  Section: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  colors: {},
}));
const raw: CatalogProduct = {
  id: "product-real",
  nome: "Café",
  descricao: "Receita da casa",
  precoBase: 12.9,
  imagemUrl: null,
  tempoEstimadoPreparo: 1,
  variacoes: [
    { id: "large-real", nome: "Grande", preco: 19.9, esgotado: false },
  ],
  adicionais: [
    { id: "milk-real", nome: "Leite", preco: 2.9, maximo: 2, esgotado: false },
  ],
};
const product = toMenuSections(
  [{ id: "category-real", nome: "Cafés", produtos: [raw] }],
  "https://api.example.com",
)[0].products[0];

test("requires the real variation and applies the catalog additional limit and price", async () => {
  const onSave = jest.fn();
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(
      <BusinessProductScreen
        product={product}
        onBack={jest.fn()}
        onSave={onSave}
      />,
    );
  });
  try {
    const shell = () => tree.root.findByType(ProductShell);
    expect(shell().props.disabled).toBe(true);
    await act(async () => shell().props.onSave());
    expect(onSave).not.toHaveBeenCalled();
    const radio = tree.root.findAll(
      (node) =>
        node.props.accessibilityRole === "radio" &&
        typeof node.props.onPress === "function",
    )[0];
    await act(async () => radio.props.onPress());
    const additional = tree.root.findByType(Quantity);
    await act(async () => additional.props.onChange(7));
    expect(tree.root.findByType(Quantity).props.value).toBe(2);
    await act(async () => shell().props.onQuantity(3));
    expect(shell().props.total).toBe(77.1);
    await act(async () => shell().props.onSave());
    expect(onSave).toHaveBeenCalledWith(
      { variacaoId: "large-real", adicionais: { "milk-real": 2 } },
      3,
    );
  } finally {
    await act(async () => tree.unmount());
  }
});

test("editing restores the actual selected variation, additions and quantity", async () => {
  const initialLine = createCartLine(
    raw,
    { variacaoId: "large-real", adicionais: { "milk-real": 1 } },
    2,
  );
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(
      <BusinessProductScreen
        product={product}
        initialLine={initialLine}
        onBack={jest.fn()}
        onSave={jest.fn()}
      />,
    );
  });
  try {
    expect(tree.root.findByType(ProductShell).props).toMatchObject({
      editing: true,
      disabled: false,
      quantity: 2,
      total: 45.6,
    });
    expect(tree.root.findByType(Quantity).props.value).toBe(1);
  } finally {
    await act(async () => tree.unmount());
  }
});

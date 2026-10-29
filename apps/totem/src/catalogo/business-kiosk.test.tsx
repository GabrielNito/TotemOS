import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { BusinessKioskScreen } from "./business-kiosk";
import { MenuScreen } from "../kiosk/menu-screen";
import { BusinessProductScreen } from "./business-product";
import { CartScreen } from "../kiosk/cart";
import { CheckoutScreen } from "../kiosk/checkout";
import { OrderNotice } from "../kiosk/notice";
import { ContextDialog } from "../kiosk/context-dialog";
import { KioskStandby } from "../kiosk/standby";
import type { CatalogCategory } from "./model";
import { createCartLine } from "./model";
import { loadBusinessCart, saveBusinessCart } from "./cart-storage";

jest.mock("./cart-storage", () => ({
  loadBusinessCart: jest.fn(async () => []),
  saveBusinessCart: jest.fn(async () => {}),
}));
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(loadBusinessCart).mockResolvedValue([]);
});

jest.mock("expo-status-bar", () => ({ StatusBar: () => null }));
jest.mock("lucide-react-native", () => ({
  LayoutGrid: () => null,
  Sandwich: () => null,
  Layers3: () => null,
  CookingPot: () => null,
  CupSoda: () => null,
}));
jest.mock("react-native-reanimated", () => ({ useReducedMotion: () => false }));
jest.mock("react-native-safe-area-context", () => ({
  SafeAreaView: jest.requireActual("react-native").View,
  useSafeAreaInsets: () => ({ top: 34, bottom: 15 }),
}));
jest.mock("../kiosk/menu-screen", () => {
  const React = jest.requireActual("react");
  const Pressable = jest.requireActual("react-native").Pressable;
  const Context = jest.requireActual(
    "../kiosk/experience-context",
  ).ExperienceContext;
  return {
    MenuScreen: () =>
      React.createElement(Pressable, {
        accessibilityLabel: "Abrir atendimento",
        onPress: React.useContext(Context).openContext,
      }),
  };
});
jest.mock("./business-product", () => ({ BusinessProductScreen: () => null }));
jest.mock("../kiosk/cart", () => ({ CartScreen: () => null }));
jest.mock("../kiosk/checkout", () => ({ CheckoutScreen: () => null }));
jest.mock("../kiosk/notice", () => ({ OrderNotice: () => null }));
jest.mock("../kiosk/context-dialog", () => ({ ContextDialog: () => null }));
jest.mock("../kiosk/standby", () => ({ KioskStandby: () => null }));
jest.mock("../kiosk/ui", () => ({
  KioskText: jest.requireActual("react-native").Text,
}));
jest.mock("../kiosk/motion", () => ({
  MotionScene: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  ProductMotionOverlay: () => null,
}));
const categories: CatalogCategory[] = [
  {
    id: "category-real",
    nome: "Cafés",
    produtos: [
      {
        id: "product-real",
        nome: "Café da casa",
        descricao: "Receita cadastrada",
        precoBase: 12.9,
        imagemUrl: null,
        tempoEstimadoPreparo: 2,
        variacoes: [
          { id: "large-real", nome: "Grande", preco: 19.9, esgotado: false },
        ],
        adicionais: [
          {
            id: "milk-real",
            nome: "Leite",
            preco: 2.9,
            maximo: 2,
            esgotado: false,
          },
        ],
      },
    ],
  },
];

test("the real service dialog suspends standby until it is closed", async () => {
  jest.useFakeTimers();
  let tree!: ReactTestRenderer;
  try {
    await act(async () => {
      tree = create(
        <BusinessKioskScreen negocioId="tenant-a" categories={categories} />,
      );
    });
    await act(async () =>
      tree.root.findByType(KioskStandby).props.onContinue(),
    );
    const open = tree.root.findAll(
      (node) =>
        node.props.accessibilityLabel === "Abrir atendimento" &&
        typeof node.props.onPress === "function",
    )[0];
    await act(async () => open.props.onPress());
    expect(tree.root.findByType(ContextDialog).props).toMatchObject({
      visible: true,
      simulation: false,
      mode: "counter",
    });
    await act(async () => jest.advanceTimersByTime(61000));
    expect(tree.root.findAllByType(KioskStandby)).toHaveLength(0);
    await act(async () => tree.root.findByType(ContextDialog).props.onClose());
    await act(async () => jest.advanceTimersByTime(60000));
    expect(tree.root.findAllByType(KioskStandby)).toHaveLength(1);
  } finally {
    if (tree) await act(async () => tree.unmount());
    jest.useRealTimers();
  }
});

test("restores before writing and remounts the cart when the authenticated tenant changes", async () => {
  let finish!: (cart: Awaited<ReturnType<typeof loadBusinessCart>>) => void;
  jest.mocked(loadBusinessCart).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(
      <BusinessKioskScreen negocioId="tenant-a" categories={categories} />,
    );
  });
  try {
    expect(saveBusinessCart).not.toHaveBeenCalled();
    expect(tree.root.findAllByType(MenuScreen)).toHaveLength(0);
    const cart = [
      createCartLine(
        categories[0].produtos[0],
        { variacaoId: "large-real", adicionais: { "milk-real": 2 } },
        2,
      ),
    ];
    await act(async () => finish(cart));
    expect(tree.root.findByType(MenuScreen).props.total).toBe(51.4);
    expect(saveBusinessCart).toHaveBeenLastCalledWith("tenant-a", cart);
    await act(async () =>
      tree.update(
        <BusinessKioskScreen negocioId="tenant-b" categories={categories} />,
      ),
    );
    expect(loadBusinessCart).toHaveBeenLastCalledWith("tenant-b");
    expect(tree.root.findByType(MenuScreen).props.count).toBe(0);
    expect(saveBusinessCart).toHaveBeenLastCalledWith("tenant-b", []);
  } finally {
    await act(async () => tree.unmount());
  }
});

test("the paired catalog uses real IDs through configuration, cart editing, undo and identification", async () => {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(
      <BusinessKioskScreen
        negocioId="tenant-a"
        businessName="Cafeteria Teste"
        categories={categories}
      />,
    );
  });
  try {
    const menu = () => tree.root.findByType(MenuScreen);
    expect(menu().props.sections[0].products[0].id).toBe("product-real");
    await act(async () => menu().props.onCategoryChange("category-real"));
    await act(async () =>
      menu().props.onProduct(menu().props.sections[0].products[0]),
    );
    await act(async () =>
      tree.root
        .findByType(BusinessProductScreen)
        .props.onSave(
          { variacaoId: "large-real", adicionais: { "milk-real": 2 } },
          2,
        ),
    );
    expect(menu().props.category).toBe("category-real");
    expect(menu().props.count).toBe(2);
    expect(menu().props.total).toBe(51.4);
    await act(async () => menu().props.onCart());
    const cart = () => tree.root.findByType(CartScreen);
    const key = cart().props.items[0].key;
    expect(cart().props.items[0]).toMatchObject({
      name: "Café da casa",
      unitPrice: 25.7,
      quantity: 2,
    });
    await act(async () => cart().props.onEdit(key));
    expect(
      tree.root.findByType(BusinessProductScreen).props.initialLine.product.id,
    ).toBe("product-real");
    await act(async () =>
      tree.root.findByType(BusinessProductScreen).props.onBack(),
    );
    await act(async () => cart().props.onQuantity(key, 3));
    expect(cart().props.items[0].unitPrice).toBe(25.7);
    await act(async () => cart().props.onRemove(key));
    expect(cart().props.items).toHaveLength(0);
    await act(async () => tree.root.findByType(OrderNotice).props.onAction());
    expect(cart().props.items[0].quantity).toBe(3);
    await act(async () => cart().props.onCheckout());
    expect(tree.root.findByType(CheckoutScreen).props).toMatchObject({
      simulation: false,
      stage: "identification",
      total: 77.1,
    });
    await act(async () =>
      tree.root.findByType(CheckoutScreen).props.onComplete(),
    );
    expect(tree.root.findByType(CheckoutScreen).props.stage).toBe("payment");
    const checkout = tree.root.findByType(CheckoutScreen);
    await act(async () => checkout.props.onComplete());
    expect(tree.root.findByType(CheckoutScreen).props.stage).toBe("payment");
    await act(async () => checkout.props.onEditItem(key));
    const editor = tree.root.findByType(BusinessProductScreen);
    expect(editor.props.initialLine.key).toBe(key);
    expect(editor.props.product.id).toBe("product-real");
    expect(editor.props.initialLine.precoNoMomento).toBe(25.7);
    await act(async () =>
      editor.props.onSave(editor.props.initialLine.selection, 2),
    );
    expect(cart().props.items).toHaveLength(1);
    expect(cart().props.items[0]).toMatchObject({
      unitPrice: 25.7,
      quantity: 2,
    });
    await act(async () => cart().props.onCheckout());
    expect(tree.root.findByType(CheckoutScreen).props.total).toBe(51.4);
  } finally {
    await act(async () => tree.unmount());
  }
});

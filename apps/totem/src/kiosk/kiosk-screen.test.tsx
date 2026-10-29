import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { BackHandler } from "react-native";
import { KioskPreviewScreen } from "./kiosk-screen";
import { CatalogScreen } from "./catalog";
import { ProductScreen } from "./product";
import { CartScreen } from "./cart";
import { CheckoutScreen } from "./checkout";
import { OrderNotice } from "./notice";
import { ContextDialog } from "./context-dialog";
import { initialConfiguration, findProduct } from "./reference-model";
import { loadPreviewSession, savePreviewSession } from "./preview-session";

jest.mock("./preview-session", () => ({
  loadPreviewSession: jest.fn(async () => ({ cart: [], mode: "counter" })),
  savePreviewSession: jest.fn(async () => {}),
}));

beforeEach(() => {
  jest.clearAllMocks();
});

test("restores the order before writing and ignores a late restore after unmount", async () => {
  let restore!: (value: Awaited<ReturnType<typeof loadPreviewSession>>) => void;
  jest.mocked(loadPreviewSession).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        restore = resolve;
      }),
  );
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(<KioskPreviewScreen />);
  });
  expect(savePreviewSession).not.toHaveBeenCalled();
  expect(tree.root.findAllByType(CatalogScreen)).toHaveLength(0);
  const cart = [
    {
      key: "restored",
      productId: "bacon",
      quantity: 2,
      configuration: initialConfiguration(findProduct("bacon")),
    },
  ];
  await act(async () => restore({ cart, mode: "qr" }));
  expect(tree.root.findByType(CatalogScreen).props.count).toBe(2);
  expect(tree.root.findByType(ContextDialog).props.mode).toBe("qr");
  expect(savePreviewSession).toHaveBeenCalledTimes(1);
  expect(savePreviewSession).toHaveBeenLastCalledWith({ cart, mode: "qr" });
  await act(async () => tree.unmount());

  jest.mocked(loadPreviewSession).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        restore = resolve;
      }),
  );
  await act(async () => {
    tree = create(<KioskPreviewScreen />);
  });
  await act(async () => tree.unmount());
  await act(async () => restore({ cart, mode: "table" }));
  expect(savePreviewSession).toHaveBeenCalledTimes(1);
});

jest.mock("expo-font", () => ({ useFonts: () => [true] }));
jest.mock("react-native-reanimated", () => ({ useReducedMotion: () => false }));
jest.mock("expo-status-bar", () => ({ StatusBar: () => null }));
jest.mock("lucide-react-native", () => ({ ArrowRight: () => null }));
jest.mock("react-native-safe-area-context", () => ({
  SafeAreaView: jest.requireActual("react-native").View,
  useSafeAreaInsets: () => ({ top: 34, bottom: 15, left: 0, right: 0 }),
}));
jest.mock("./ui", () => ({
  KioskText: jest.requireActual("react-native").Text,
}));
jest.mock("./catalog", () => ({ CatalogScreen: () => null }));
jest.mock("./product", () => ({ ProductScreen: () => null }));
jest.mock("./cart", () => ({ CartScreen: () => null }));
jest.mock("./checkout", () => ({ CheckoutScreen: () => null }));
jest.mock("./notice", () => ({ OrderNotice: () => null }));
jest.mock("./context-dialog", () => ({ ContextDialog: () => null }));
jest.mock("./motion", () => {
  const React = jest.requireActual("react");
  const View = jest.requireActual("react-native").View;
  return {
    MotionScene: ({ children }: { children: React.ReactNode }) => (
      <View>{children}</View>
    ),
  };
});

test("returning from product configuration preserves the category, cart and selected context", async () => {
  let tree: ReactTestRenderer;
  await act(async () => {
    tree = create(<KioskPreviewScreen />);
  });
  await act(async () =>
    tree!.root
      .findAll(
        (node) =>
          node.props.accessibilityLabel === "Toque para começar o pedido" &&
          typeof node.props.onPress === "function",
      )[0]
      .props.onPress(),
  );
  const catalog = () => tree!.root.findByType(CatalogScreen);
  expect(catalog().props.category).toBe("Todos");
  expect(catalog().props.initialScrollOffset).toBe(0);
  await act(async () => catalog().props.onCategoryChange("Combos"));
  await act(async () => catalog().props.onScrollOffsetChange(120));
  const product = findProduct("combo-bacon");
  await act(async () => catalog().props.onProduct(product));
  await act(async () =>
    tree!.root
      .findByType(ProductScreen)
      .props.onSave(initialConfiguration(product), 2),
  );
  expect(catalog().props.category).toBe("Combos");
  expect(catalog().props.initialScrollOffset).toBe(120);
  expect(catalog().props.count).toBe(2);
  expect(catalog().props.total).toBe(85.8);
  await act(async () =>
    tree!.root.findByType(ContextDialog).props.onChange("table"),
  );
  expect(catalog().props.count).toBe(2);
  await act(async () => catalog().props.onCart());
  expect(tree!.root.findByType(CartScreen).props.items[0].quantity).toBe(2);
  await act(async () => tree!.root.findByType(CartScreen).props.onCheckout());
  expect(tree!.root.findByType(ContextDialog).props.mode).toBe("table");
  await act(async () => tree!.unmount());
});

test("editing from checkout preserves the configured line and the customer draft", async () => {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(<KioskPreviewScreen />);
  });
  try {
    const product = findProduct("bacon");
    const configuration = { ...initialConfiguration(product), patties: 2 };
    await act(async () =>
      tree.root.findByType(CatalogScreen).props.onProduct(product),
    );
    await act(async () =>
      tree.root.findByType(ProductScreen).props.onSave(configuration, 2),
    );
    await act(async () => tree.root.findByType(CatalogScreen).props.onCart());
    await act(async () => tree.root.findByType(CartScreen).props.onCheckout());
    const checkout = tree.root.findByType(CheckoutScreen);
    const key = checkout.props.items[0].key;
    await act(async () =>
      checkout.props.onIdentityChange({
        name: "Nito",
        cpf: "",
        wantsCpf: false,
      }),
    );
    await act(async () => checkout.props.onEditItem(key));
    const editor = tree.root.findByType(ProductScreen);
    expect(editor.props.initialLine).toMatchObject({
      key,
      quantity: 2,
      configuration,
    });
    await act(async () => editor.props.onSave(configuration, 3));
    await act(async () => tree.root.findByType(CartScreen).props.onCheckout());
    expect(tree.root.findByType(CheckoutScreen).props.items).toHaveLength(1);
    expect(tree.root.findByType(CheckoutScreen).props.total).toBe(119.4);
    expect(tree.root.findByType(CheckoutScreen).props.identity.name).toBe(
      "Nito",
    );
  } finally {
    await act(async () => tree.unmount());
  }
});

test("completing a simulated order clears CPF and restarting clears the previous customer", async () => {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(<KioskPreviewScreen />);
  });
  try {
    const product = findProduct("bacon");
    await act(async () =>
      tree.root.findByType(CatalogScreen).props.onProduct(product),
    );
    await act(async () =>
      tree.root
        .findByType(ProductScreen)
        .props.onSave(initialConfiguration(product), 1),
    );
    await act(async () => tree.root.findByType(CatalogScreen).props.onCart());
    await act(async () => tree.root.findByType(CartScreen).props.onCheckout());
    const checkout = () => tree.root.findByType(CheckoutScreen);
    await act(async () =>
      checkout().props.onIdentityChange({
        name: "Nito",
        cpf: "12345678901",
        wantsCpf: true,
      }),
    );
    await act(async () => checkout().props.onComplete());
    expect(checkout().props.stage).toBe("payment");
    await act(async () => checkout().props.onComplete());
    expect(checkout().props.stage).toBe("confirmation");
    expect(checkout().props.identity.cpf).toBe("");
    await act(async () => checkout().props.onRestart());
    await act(async () =>
      tree.root.findByType(CatalogScreen).props.onProduct(product),
    );
    await act(async () =>
      tree.root
        .findByType(ProductScreen)
        .props.onSave(initialConfiguration(product), 1),
    );
    await act(async () => tree.root.findByType(CatalogScreen).props.onCart());
    await act(async () => tree.root.findByType(CartScreen).props.onCheckout());
    expect(checkout().props.identity).toEqual({
      name: "",
      cpf: "",
      wantsCpf: false,
    });
  } finally {
    await act(async () => tree.unmount());
  }
});

test("Android back returns from customization to the selected catalog without losing the order", async () => {
  const listeners: Parameters<typeof BackHandler.addEventListener>[1][] = [];
  const subscription = jest
    .spyOn(BackHandler, "addEventListener")
    .mockImplementation((_, callback) => {
      listeners.push(callback);
      return { remove: jest.fn() };
    });
  let tree: ReactTestRenderer;
  await act(async () => {
    tree = create(<KioskPreviewScreen />);
  });
  await act(async () =>
    tree!.root
      .findAll(
        (node) =>
          node.props.accessibilityLabel === "Toque para começar o pedido" &&
          typeof node.props.onPress === "function",
      )[0]
      .props.onPress(),
  );
  const catalog = () => tree!.root.findByType(CatalogScreen);
  await act(async () => catalog().props.onCategoryChange("Lanches"));
  await act(async () => catalog().props.onProduct(findProduct("bacon")));
  expect(listeners.length).toBeGreaterThan(0);
  await act(async () => {
    expect(
      listeners[listeners.length - 1]({
        type: "hardwareBackPress",
        timeStamp: 0,
      }),
    ).toBe(true);
  });
  expect(catalog().props.category).toBe("Lanches");
  expect(catalog().props.count).toBe(0);
  await act(async () => tree!.unmount());
  subscription.mockRestore();
});

test("removal confirmation suspends standby and closing it starts a fresh idle window", async () => {
  jest.useFakeTimers();
  let tree: ReactTestRenderer | undefined;
  try {
    await act(async () => {
      tree = create(<KioskPreviewScreen />);
    });
    const standbyButtons = () =>
      tree!.root.findAll(
        (node) =>
          /^Toque para/.test(node.props.accessibilityLabel ?? "") &&
          typeof node.props.onPress === "function",
      );
    await act(async () => standbyButtons()[0].props.onPress());
    await act(async () =>
      tree!.root
        .findByType(CatalogScreen)
        .props.onProduct(findProduct("bacon")),
    );
    await act(async () =>
      tree!.root
        .findByType(ProductScreen)
        .props.onSave(initialConfiguration(findProduct("bacon")), 1),
    );
    await act(async () => tree!.root.findByType(CatalogScreen).props.onCart());
    await act(async () =>
      tree!.root.findByType(CartScreen).props.onDialogVisibilityChange(true),
    );
    await act(async () => jest.advanceTimersByTime(61000));
    expect(standbyButtons()).toHaveLength(0);
    await act(async () =>
      tree!.root.findByType(CartScreen).props.onDialogVisibilityChange(false),
    );
    await act(async () => jest.advanceTimersByTime(59999));
    expect(standbyButtons()).toHaveLength(0);
    await act(async () => jest.advanceTimersByTime(1));
    expect(standbyButtons()).toHaveLength(1);
  } finally {
    if (tree) await act(async () => tree!.unmount());
    jest.useRealTimers();
  }
});

test("undo restores the removed configured line and its total", async () => {
  let tree: ReactTestRenderer;
  await act(async () => {
    tree = create(<KioskPreviewScreen />);
  });
  const p = findProduct("combo-bacon");
  await act(async () =>
    tree!.root.findByType(CatalogScreen).props.onProduct(p),
  );
  await act(async () =>
    tree!.root
      .findByType(ProductScreen)
      .props.onSave(initialConfiguration(p), 2),
  );
  await act(async () => tree!.root.findByType(CatalogScreen).props.onCart());
  const cart = () => tree!.root.findByType(CartScreen);
  await act(async () => cart().props.onRemove(cart().props.items[0].key));
  expect(cart().props.items).toHaveLength(0);
  const notice = tree!.root.findByType(OrderNotice);
  expect(notice.props.actionLabel).toBe("Desfazer");
  await act(async () => notice.props.onAction());
  expect(cart().props.items[0]).toMatchObject({
    name: "Combo Bacon Melt",
    quantity: 2,
    unitPrice: 42.9,
  });
  await act(async () => tree!.unmount());
});

import React from "react";
import { requireOptionalNativeModule } from "expo";
import { AppState, BackHandler, type AppStateStatus } from "react-native";
import { AndroidKioskGuard } from "../android-kiosk/guard";
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
import { createOrderSubmission } from "./order-api";
import { OrderStatus } from "./order-status";
import { loadBusinessCart, saveBusinessCart } from "./cart-storage";
jest.mock("expo", () => ({
  ...jest.requireActual("expo"),
  requireOptionalNativeModule: jest.fn(),
}));
jest.mock("./order-api", () => ({ createOrderSubmission: jest.fn() }));
jest.mock("./order-status", () => ({ OrderStatus: () => null }));

jest.mock("./cart-storage", () => ({
  loadBusinessCart: jest.fn(async () => []),
  saveBusinessCart: jest.fn(async () => {}),
}));
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(loadBusinessCart).mockResolvedValue([]);
  jest.mocked(createOrderSubmission).mockImplementation(
    () =>
      ({
        attempt: null,
        restore: jest.fn(async () => {}),
        prepare: jest.fn(async () => {}),
        submit: jest.fn(async () => ({
          id: "server-order",
          negocioId: "tenant-real",
          status: "AGUARDANDO_PAGAMENTO",
          valorTotal: "80.00",
        })),
      }) as unknown as ReturnType<typeof createOrderSubmission>,
  );
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
jest.mock("../kiosk/context-dialog", () => ({
  ContextDialog: ({ visible }: { visible: boolean }) => {
    const { AndroidKioskMode } = jest.requireActual("../android-kiosk/guard");
    return visible ? <AndroidKioskMode /> : null;
  },
}));
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

test("novo atendimento aguarda limpeza durável, apaga nome/CPF/carrinho e bloqueia duplo toque", async () => {
  let complete!: () => void;
  const finish = jest.fn(
    () =>
      new Promise<void>((resolve) => {
        complete = resolve;
      }),
  );
  const submission = {
    attempt: {
      result: { id: "order", status: "ENTREGUE", valorTotal: "45.00" },
    },
    restore: jest.fn(async () => {}),
    finish,
  };
  jest
    .mocked(createOrderSubmission)
    .mockReturnValue(
      submission as unknown as ReturnType<typeof createOrderSubmission>,
    );
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(
      <BusinessKioskScreen negocioId="tenant-a" categories={categories} />,
    );
  });
  try {
    let pending!: Promise<void>;
    await act(async () => {
      pending = tree.root.findByType(OrderStatus).props.onNew();
    });
    await act(async () => tree.root.findByType(OrderStatus).props.onNew());
    expect(finish).toHaveBeenCalledTimes(1);
    expect(tree.root.findAllByType(MenuScreen)).toHaveLength(0);
    submission.attempt = null as never;
    await act(async () => {
      complete();
      await pending;
    });
    expect(tree.root.findByType(MenuScreen).props.count).toBe(0);
  } finally {
    await act(async () => tree.unmount());
  }
});

test("standby não descarta pedido aberto nem permite navegar ao catálogo", async () => {
  jest.useFakeTimers();
  const attempt = {
    result: { id: "order", status: "PRONTO", valorTotal: "45.00" },
  };
  jest.mocked(createOrderSubmission).mockReturnValue({
    attempt,
    restore: jest.fn(async () => {}),
  } as unknown as ReturnType<typeof createOrderSubmission>);
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(
      <BusinessKioskScreen negocioId="tenant-a" categories={categories} />,
    );
  });
  try {
    await act(async () => jest.advanceTimersByTime(60000));
    expect(tree.root.findAllByType(KioskStandby)).toHaveLength(0);
    await act(async () =>
      tree.root.findByType(ContextDialog).props.onStandby(),
    );
    await act(async () =>
      tree.root.findByType(KioskStandby).props.onContinue(),
    );
    expect(tree.root.findByType(OrderStatus).props.result.id).toBe("order");
    expect(tree.root.findByType(OrderStatus).props.onBack).toBeUndefined();
    expect(tree.root.findAllByType(MenuScreen)).toHaveLength(0);
  } finally {
    await act(async () => tree.unmount());
    jest.useRealTimers();
  }
});

test("próximo cliente recebe identificação vazia e não reutiliza carrinho ou pedido anterior", async () => {
  const submission = {
    attempt: null as unknown,
    restore: jest.fn(async () => {}),
    prepare: jest.fn(async () => {
      submission.attempt = {};
    }),
    submit: jest.fn(async () => ({
      id: "order",
      negocioId: "tenant-a",
      status: "ENTREGUE",
      valorTotal: "80.00",
    })),
    finish: jest.fn(async () => {
      submission.attempt = null;
    }),
  };
  jest
    .mocked(createOrderSubmission)
    .mockReturnValue(
      submission as unknown as ReturnType<typeof createOrderSubmission>,
    );
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(
      <BusinessKioskScreen negocioId="tenant-a" categories={categories} />,
    );
  });
  const addAndCheckout = async () => {
    const menu = tree.root.findByType(MenuScreen);
    await act(async () =>
      menu.props.onProduct(menu.props.sections[0].products[0]),
    );
    await act(async () =>
      tree.root
        .findByType(BusinessProductScreen)
        .props.onSave({ variacaoId: "large-real", adicionais: {} }, 1),
    );
    await act(async () => tree.root.findByType(MenuScreen).props.onCart());
    await act(async () => tree.root.findByType(CartScreen).props.onCheckout());
  };
  try {
    await act(async () =>
      tree.root.findByType(KioskStandby).props.onContinue(),
    );
    await addAndCheckout();
    await act(async () =>
      tree.root.findByType(CheckoutScreen).props.onIdentityChange({
        name: "Ana",
        cpf: "12345678909",
        wantsCpf: true,
      }),
    );
    await act(async () =>
      tree.root.findByType(CheckoutScreen).props.onComplete(),
    );
    expect(submission.prepare.mock.calls).toHaveLength(1);
    await act(async () => tree.root.findByType(OrderStatus).props.onNew());
    expect(tree.root.findByType(MenuScreen).props.count).toBe(0);
    await act(async () =>
      tree.root.findByType(KioskStandby).props.onContinue(),
    );
    await addAndCheckout();
    expect(tree.root.findByType(CheckoutScreen).props.identity).toEqual({
      name: "",
      cpf: "",
      wantsCpf: false,
    });
    expect(submission.attempt).toBeNull();
  } finally {
    await act(async () => tree.unmount());
  }
});

test("recovers a pending attempt on restart and keeps navigation locked while checking its result", async () => {
  const submit = jest
    .fn()
    .mockRejectedValueOnce(new Error("rede"))
    .mockResolvedValue({ id: "recovered", valorTotal: "45.00" });
  const attempt = { request: { itens: [] }, key: "saved" };
  jest.mocked(createOrderSubmission).mockReturnValue({
    attempt,
    restore: jest.fn(async () => {}),
    submit,
  } as unknown as ReturnType<typeof createOrderSubmission>);
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(
      <BusinessKioskScreen negocioId="tenant-a" categories={categories} />,
    );
  });
  try {
    expect(tree.root.findByType(OrderStatus).props.onBack).toBeUndefined();
    await act(async () => tree.root.findByType(OrderStatus).props.onRetry());
    expect(tree.root.findByType(OrderStatus).props.error).toBe(
      "Não foi possível confirmar o pedido. Consulte novamente.",
    );
    expect(tree.root.findByType(OrderStatus).props.onBack).toBeUndefined();
    await act(async () => tree.root.findByType(OrderStatus).props.onRetry());
    expect(tree.root.findByType(OrderStatus).props.result.id).toBe("recovered");
    expect(submit).toHaveBeenCalledTimes(2);
  } finally {
    await act(async () => tree.unmount());
  }
});

test("does not overwrite the cart when pending-order storage fails to load", async () => {
  jest.mocked(createOrderSubmission).mockReturnValue({
    attempt: null,
    restore: jest.fn(async () => {
      throw new Error("storage");
    }),
  } as unknown as ReturnType<typeof createOrderSubmission>);
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(
      <BusinessKioskScreen negocioId="tenant-a" categories={categories} />,
    );
  });
  try {
    expect(tree.root.findByType(OrderStatus).props.onBack).toBeUndefined();
    expect(saveBusinessCart).not.toHaveBeenCalled();
  } finally {
    await act(async () => tree.unmount());
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
    expect(loadBusinessCart).toHaveBeenLastCalledWith("tenant-b", true);
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
    expect(tree.root.findByType(OrderStatus).props.result).toMatchObject({
      id: "server-order",
      valorTotal: "80.00",
    });
    expect(createOrderSubmission).toHaveBeenCalled();
  } finally {
    await act(async () => tree.unmount());
  }
});

test("Voltar no catálogo é consumido pelo Totem", async () => {
  const { BackHandler } =
    jest.requireActual<typeof import("react-native")>("react-native");
  const listen = jest.spyOn(BackHandler, "addEventListener");
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
    const handler = listen.mock.calls.at(-1)![1];
    expect(handler({ type: "hardwareBackPress", timeStamp: 0 })).toBe(true);
    expect(tree.root.findAllByType(MenuScreen)).toHaveLength(1);
  } finally {
    if (tree) await act(async () => tree.unmount());
    listen.mockRestore();
  }
});

test("pedido registrado é recuperado mesmo com carrinho ilegível", async () => {
  const result = { id: "order", status: "EM_PREPARO", valorTotal: "45.00" };
  jest.mocked(createOrderSubmission).mockReturnValue({
    attempt: { result },
    restore: jest.fn(async () => {}),
  } as unknown as ReturnType<typeof createOrderSubmission>);
  jest
    .mocked(loadBusinessCart)
    .mockRejectedValue(new Error("SecureStore indisponível"));
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(
      <BusinessKioskScreen negocioId="tenant-a" categories={categories} />,
    );
  });
  try {
    expect(tree.root.findByType(OrderStatus).props.result).toEqual(result);
    expect(loadBusinessCart).not.toHaveBeenCalled();
    expect(tree.root.findByType(OrderStatus).props.onBack).toBeUndefined();
  } finally {
    await act(async () => tree.unmount());
  }
});

test("Voltar acompanha as etapas e bloqueia retorno durante envio e acompanhamento", async () => {
  const { BackHandler } =
    jest.requireActual<typeof import("react-native")>("react-native");
  const listen = jest.spyOn(BackHandler, "addEventListener").mockClear();
  let resolve!: (result: object) => void;
  const submission = {
    attempt: null as object | null,
    restore: jest.fn(async () => {}),
    prepare: jest.fn(async () => {
      submission.attempt = {};
    }),
    submit: jest.fn(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    ),
  };
  jest
    .mocked(createOrderSubmission)
    .mockReturnValue(
      submission as unknown as ReturnType<typeof createOrderSubmission>,
    );
  let tree!: ReactTestRenderer;
  const back = async () => {
    await act(async () => {
      expect(
        listen.mock.calls.at(-1)![1]({
          type: "hardwareBackPress",
          timeStamp: 0,
        }),
      ).toBe(true);
    });
  };
  try {
    await act(async () => {
      tree = create(
        <BusinessKioskScreen negocioId="tenant-a" categories={categories} />,
      );
    });
    await act(async () =>
      tree.root.findByType(KioskStandby).props.onContinue(),
    );
    const menu = tree.root.findByType(MenuScreen);
    await act(async () =>
      menu.props.onProduct(menu.props.sections[0].products[0]),
    );
    await back();
    expect(tree.root.findAllByType(BusinessProductScreen)).toHaveLength(0);
    await act(async () => {
      const currentMenu = tree.root.findByType(MenuScreen);
      currentMenu.props.onProduct(currentMenu.props.sections[0].products[0]);
    });
    await act(async () =>
      tree.root
        .findByType(BusinessProductScreen)
        .props.onSave({ variacaoId: "large-real", adicionais: {} }, 1),
    );
    await act(async () => tree.root.findByType(MenuScreen).props.onCart());
    await back();
    expect(tree.root.findAllByType(CartScreen)).toHaveLength(0);
    await act(async () => tree.root.findByType(MenuScreen).props.onCart());
    await act(async () => tree.root.findByType(CartScreen).props.onCheckout());
    await back();
    expect(tree.root.findAllByType(CartScreen)).toHaveLength(1);
    await act(async () => tree.root.findByType(CartScreen).props.onCheckout());
    await act(async () =>
      tree.root.findByType(CheckoutScreen).props.onComplete(),
    );
    expect(tree.root.findByType(OrderStatus).props.busy).toBe(true);
    await back();
    expect(tree.root.findAllByType(CartScreen)).toHaveLength(0);
    await act(async () => resolve({ id: "tracked-order", status: "PENDENTE" }));
    await back();
    expect(tree.root.findByType(OrderStatus).props.result.id).toBe(
      "tracked-order",
    );
    expect(tree.root.findAllByType(CartScreen)).toHaveLength(0);
    expect(submission.submit).toHaveBeenCalledTimes(1);
  } finally {
    if (tree) await act(async () => tree.unmount());
    listen.mockRestore();
  }
});

describe("modo Android no diálogo real", () => {
  const ordinary = { mode: "ordinary", managedPermitted: false };
  const pinned = { mode: "pinned", managedPermitted: false };
  let tree: ReactTestRenderer | undefined;
  let change: (state: AppStateStatus) => void;

  beforeEach(() => {
    const listeners: ((state: AppStateStatus) => void)[] = [];
    change = (state) => listeners.forEach((listener) => listener(state));
    jest
      .spyOn(AppState, "addEventListener")
      .mockImplementation((event, listener) => {
        if (event === "change") listeners.push(listener);
        return { remove: jest.fn() };
      });
    jest
      .spyOn(BackHandler, "addEventListener")
      .mockReturnValue({ remove: jest.fn() });
  });

  afterEach(async () => {
    if (tree) await act(async () => tree?.unmount());
    tree = undefined;
    jest.restoreAllMocks();
  });

  async function mount(getStatus: () => Promise<unknown>) {
    const startManaged = jest.fn();
    jest
      .mocked(requireOptionalNativeModule)
      .mockReturnValue({ getStatus, startManaged });
    await act(async () => {
      tree = create(
        <AndroidKioskGuard>
          <BusinessKioskScreen negocioId="tenant-a" categories={categories} />
        </AndroidKioskGuard>,
      );
    });
    await continueService();
    return startManaged;
  }
  async function continueService() {
    await act(async () =>
      tree!.root.findByType(KioskStandby).props.onContinue(),
    );
  }
  async function open() {
    const trigger = tree!.root.findAll(
      (node) =>
        node.props.accessibilityLabel === "Abrir atendimento" &&
        typeof node.props.onPress === "function",
    )[0];
    await act(async () => trigger.props.onPress());
  }
  async function close() {
    await act(async () => tree!.root.findByType(ContextDialog).props.onClose());
  }
  const output = () => JSON.stringify(tree!.toJSON());

  test("lê NONE → PINNED → NONE ao abrir e reabrir, mesmo sem transição de AppState", async () => {
    const getStatus = jest
      .fn()
      .mockResolvedValueOnce(ordinary)
      .mockResolvedValueOnce(ordinary)
      .mockResolvedValueOnce(pinned)
      .mockResolvedValueOnce(pinned)
      .mockResolvedValueOnce(ordinary);
    const startManaged = await mount(getStatus);
    await open();
    expect(output()).toContain("Android em modo comum");
    await close();
    await open();
    expect(output()).toContain("Aplicativo fixado pelo Android");
    await close();
    await open();
    expect(output()).toContain("Aplicativo fixado pelo Android");
    await close();
    await open();
    expect(output()).toContain("Android em modo comum");
    expect(getStatus).toHaveBeenCalledTimes(5);
    expect(startManaged).not.toHaveBeenCalled();
  });

  test("retorno do background vence uma leitura antiga do diálogo", async () => {
    let resolveOld!: (status: object) => void;
    const getStatus = jest
      .fn()
      .mockResolvedValueOnce(ordinary)
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveOld = resolve;
          }),
      )
      .mockResolvedValue(pinned);
    await mount(getStatus);
    await open();
    expect(output()).toContain("Consultando o modo do Android");
    expect(output()).not.toContain("Android em modo comum");
    await act(async () => change("background"));
    await act(async () => change("active"));
    await continueService();
    await open();
    expect(output()).toContain("Aplicativo fixado pelo Android");
    await act(async () => resolveOld(ordinary));
    expect(output()).toContain("Aplicativo fixado pelo Android");
    expect(output()).not.toContain("Android em modo comum");
  });

  test("falha de leitura no diálogo informa indisponibilidade sem anunciar NONE", async () => {
    const getStatus = jest
      .fn()
      .mockResolvedValueOnce(ordinary)
      .mockRejectedValueOnce(new Error("bridge unavailable"));
    await mount(getStatus);
    await open();
    expect(output()).toContain("Modo Android indisponível");
    expect(output()).not.toContain("Android em modo comum");
  });

  test("reconsulta LOCKED no diálogo e preserva a indicação gerenciada", async () => {
    const getStatus = jest
      .fn()
      .mockResolvedValue({ mode: "managed", managedPermitted: true });
    const startManaged = await mount(getStatus);
    await open();
    expect(output()).toContain("Modo dedicado gerenciado ativo");
    expect(getStatus).toHaveBeenCalledTimes(2);
    expect(startManaged).not.toHaveBeenCalled();
  });
});

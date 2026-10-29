import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { CatalogoScreen } from "./catalogo-screen";
import { BusinessKioskScreen } from "./business-kiosk";
import { restoreDeviceSession } from "../device-pairing/session";
import { getCatalogoPublico } from "./api";
import type { CatalogCategory } from "./model";
import { Action } from "../kiosk/ui";

const mockRouter = { replace: jest.fn() };
jest.mock("expo-router", () => ({ useRouter: () => mockRouter }));
jest.mock("expo-font", () => ({ useFonts: () => [true, null] }));
jest.mock("../kiosk/use-kiosk-fonts", () => ({
  useKioskFonts: () => [true, null],
}));
jest.mock("expo-status-bar", () => ({ StatusBar: () => null }));
jest.mock("lucide-react-native", () => ({
  ArrowLeft: () => null,
  ArrowRight: () => null,
  CookingPot: () => null,
  CupSoda: () => null,
  LayoutGrid: () => null,
  Layers3: () => null,
  Plus: () => null,
  Sandwich: () => null,
  Store: () => null,
}));
jest.mock("react-native-safe-area-context", () => ({
  SafeAreaView: jest.requireActual("react-native").View,
}));
jest.mock("../device-pairing/session", () => ({
  restoreDeviceSession: jest.fn(),
}));
jest.mock("./api", () => ({ getCatalogoPublico: jest.fn() }));
jest.mock("./business-kiosk", () => ({ BusinessKioskScreen: () => null }));
jest.mock("../kiosk/ui", () => ({
  KioskText: jest.requireActual("react-native").Text,
  Action: () => null,
}));
const categories: CatalogCategory[] = [
  {
    id: "category-real",
    nome: "Cafés",
    produtos: [
      {
        id: "product-real",
        nome: "Café",
        descricao: null,
        precoBase: 8.9,
        imagemUrl: null,
        tempoEstimadoPreparo: 0,
        variacoes: [],
        adicionais: [],
      },
    ],
  },
];
const session = {
  kind: "authenticated" as const,
  deviceToken: "test-device-token",
  dispositivo: {
    id: "device-a",
    negocioId: "tenant-a",
    nome: "Totem do salão",
    tipo: "TOTEM" as const,
    pareadoEm: null,
    ativo: true,
    revogadoEm: null,
    createdAt: "2026-10-29T00:00:00Z",
  },
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(restoreDeviceSession).mockResolvedValue(session);
  jest.mocked(getCatalogoPublico).mockResolvedValue(categories);
});

test("loads the authenticated tenant catalog into the V2 native interface", async () => {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(<CatalogoScreen />);
  });
  try {
    expect(restoreDeviceSession).toHaveBeenCalledWith({
      expectedDeviceType: "TOTEM",
    });
    expect(getCatalogoPublico).toHaveBeenCalledWith(
      "tenant-a",
      expect.any(AbortSignal),
    );
    expect(tree.root.findByType(BusinessKioskScreen).props).toMatchObject({
      negocioId: "tenant-a",
      categories,
    });
    expect(mockRouter.replace).not.toHaveBeenCalled();
  } finally {
    await act(async () => tree.unmount());
  }
});

test("passes the authenticated business name and welcome message to its own catalog", async () => {
  jest.mocked(restoreDeviceSession).mockResolvedValueOnce({
    ...session,
    negocio: {
      id: "tenant-a",
      nome: "Cafeteria da Praça",
      modoIdentificacao: "CODIGO",
      mensagemBoasVindas: "Escolha seu café.",
      pagamentoPointConfigurado: false,
    },
  });
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(<CatalogoScreen />);
  });
  try {
    expect(tree.root.findByType(BusinessKioskScreen).props).toMatchObject({
      businessName: "Cafeteria da Praça",
      welcome: "Escolha seu café.",
      identificationMode: "CODIGO",
    });
  } finally {
    await act(async () => tree.unmount());
  }
});

test("missing pairing returns to pairing before requesting any catalog", async () => {
  jest
    .mocked(restoreDeviceSession)
    .mockResolvedValueOnce({ kind: "pairing", reason: "missing-token" });
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(<CatalogoScreen />);
  });
  try {
    expect(mockRouter.replace).toHaveBeenCalledWith("/parear");
    expect(getCatalogoPublico).not.toHaveBeenCalled();
    expect(tree.root.findAllByType(BusinessKioskScreen)).toHaveLength(0);
  } finally {
    await act(async () => tree.unmount());
  }
});

test("a late session response after unmount cannot load another screen", async () => {
  let finish!: (value: typeof session) => void;
  jest.mocked(restoreDeviceSession).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(<CatalogoScreen />);
  });
  await act(async () => tree.unmount());
  await act(async () => finish(session));
  expect(getCatalogoPublico).not.toHaveBeenCalled();
});

test("shows loading until the authenticated catalog request resolves", async () => {
  let resolve!: (value: CatalogCategory[]) => void;
  jest.mocked(getCatalogoPublico).mockImplementationOnce(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(<CatalogoScreen />);
  });
  try {
    expect(JSON.stringify(tree.toJSON())).toContain("Carregando o cardápio");
    expect(tree.root.findAllByType(BusinessKioskScreen)).toHaveLength(0);
    await act(async () => resolve(categories));
    expect(tree.root.findByType(BusinessKioskScreen).props.categories).toEqual(
      categories,
    );
  } finally {
    await act(async () => tree.unmount());
  }
});

test.each(["empty", "network-error"] as const)(
  "recovers from %s by revalidating the device session and requesting its catalog",
  async (scenario) => {
    if (scenario === "empty")
      jest.mocked(getCatalogoPublico).mockResolvedValueOnce([]);
    else
      jest
        .mocked(getCatalogoPublico)
        .mockRejectedValueOnce(new Error("Network request failed"));
    let tree!: ReactTestRenderer;
    await act(async () => {
      tree = create(<CatalogoScreen />);
    });
    try {
      const output = JSON.stringify(tree.toJSON());
      expect(output).toContain(
        scenario === "empty"
          ? "ainda não tem produtos disponíveis"
          : "Não foi possível carregar o catálogo",
      );
      expect(tree.root.findAllByType(BusinessKioskScreen)).toHaveLength(0);
      const retry = tree.root.findByType(Action);
      expect(retry.props.children).toBe("Tentar novamente");
      await act(async () => retry.props.onPress());
      expect(restoreDeviceSession).toHaveBeenCalledTimes(2);
      expect(
        jest.mocked(getCatalogoPublico).mock.calls.map(([tenant]) => tenant),
      ).toEqual(["tenant-a", "tenant-a"]);
      expect(
        tree.root.findByType(BusinessKioskScreen).props.categories,
      ).toEqual(categories);
    } finally {
      await act(async () => tree.unmount());
    }
  },
);

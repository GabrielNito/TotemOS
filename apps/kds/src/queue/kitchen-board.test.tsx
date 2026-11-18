import { fireEvent, render, screen } from "@testing-library/react-native";
import { Dimensions } from "react-native";
import { QueueController } from "./controller";
import { KitchenBoard } from "./kitchen-board";

jest.mock("react-native-safe-area-context", () => ({
  SafeAreaView:
    jest.requireActual<typeof import("react-native")>("react-native").View,
}));
it("exposes persisted recovery outside the open queue and an explicit resume action", async () => {
  const controller = new QueueController(
    { list: async () => [], execute: jest.fn() },
    { load: async () => [], save: async () => undefined },
    () => "key",
    jest.fn(),
  );
  controller.state = {
    ...controller.state,
    loaded: true,
    recoveryPaused: true,
    pending: [
      {
        key: "original",
        orderId: "delivered",
        kind: "status",
        target: "ENTREGUE",
        version: 5,
        attempts: 5,
        nextAttempt: 0,
      },
    ],
  };
  const recover = jest
    .spyOn(controller, "recover")
    .mockResolvedValue(undefined);
  const view = await render(
    <KitchenBoard controller={controller} name="Painel A" />,
  );
  expect(screen.getByText(/inclusive pedidos fora da fila/)).toBeTruthy();
  expect(screen.getByText(/Dados desatualizados/)).toBeTruthy();
  await fireEvent.press(
    screen.getByRole("button", { name: "Retomar recuperação" }),
  );
  expect(recover).toHaveBeenCalledTimes(1);
  await view.unmount();
});

it("alterna entre Kanban, Primeiro → Último e Último → Primeiro preservando todos os pedidos", async () => {
  const controller = new QueueController(
    { list: async () => [], execute: jest.fn() },
    { load: async () => [], save: async () => undefined },
    () => "key",
    jest.fn(),
  );
  controller.state = {
    ...controller.state,
    loaded: true,
    stale: false,
    orders: [
      {
        id: "o1",
        status: "PRONTO",
        senha: 101,
        dataOperacional: "2026-11-01",
        versao: 1,
        demo: false,
        demoAmbiente: null,
        createdAt: "2026-11-01T10:00:00.000Z",
        preparoZero: false,
        elegivelCozinha: true,
        autorizacaoOperacional: null,
        itens: [],
      },
      {
        id: "o2",
        status: "PENDENTE",
        senha: 102,
        dataOperacional: "2026-11-01",
        versao: 1,
        demo: false,
        demoAmbiente: null,
        createdAt: "2026-11-01T10:15:00.000Z",
        preparoZero: false,
        elegivelCozinha: true,
        autorizacaoOperacional: null,
        itens: [],
      },
      {
        id: "o3",
        status: "EM_PREPARO",
        senha: 103,
        dataOperacional: "2026-11-01",
        versao: 1,
        demo: false,
        demoAmbiente: null,
        createdAt: "2026-11-01T10:05:00.000Z",
        preparoZero: false,
        elegivelCozinha: true,
        autorizacaoOperacional: null,
        itens: [],
      },
    ],
  };

  const view = await render(
    <KitchenBoard controller={controller} name="Painel A" />,
  );

  expect(
    screen.getByRole("button", { name: "Kanban" }).props.accessibilityState
      .selected,
  ).toBe(true);

  await fireEvent.press(
    screen.getByRole("button", { name: "Primeiro → Último" }),
  );
  expect(
    screen.getByRole("button", { name: "Primeiro → Último" }).props
      .accessibilityState.selected,
  ).toBe(true);
  expect(screen.getByText("Ordem de chegada · Primeiro → Último")).toBeTruthy();
  const ascText = screen.getAllByText(/^(101|102|103)$/).map((n) => n.props.children);
  expect(ascText).toEqual(["101", "103", "102"]);

  await fireEvent.press(
    screen.getByRole("button", { name: "Último → Primeiro" }),
  );
  expect(
    screen.getByRole("button", { name: "Último → Primeiro" }).props
      .accessibilityState.selected,
  ).toBe(true);
  expect(screen.getByText("Ordem de chegada · Último → Primeiro")).toBeTruthy();
  const descText = screen.getAllByText(/^(101|102|103)$/).map((n) => n.props.children);
  expect(descText).toEqual(["102", "103", "101"]);

  await view.unmount();
});

it("usa abas por etapa no modo Kanban em viewport mobile", async () => {
  const prevWindow = Dimensions.get("window");
  const prevScreen = Dimensions.get("screen");
  Dimensions.set({
    window: { width: 390, height: 844, scale: 2, fontScale: 1 },
    screen: { width: 390, height: 844, scale: 2, fontScale: 1 },
  });
  const controller = new QueueController(
    { list: async () => [], execute: jest.fn() },
    { load: async () => [], save: async () => undefined },
    () => "key",
    jest.fn(),
  );
  controller.state = {
    ...controller.state,
    loaded: true,
    stale: false,
    orders: [
      {
        id: "m1",
        status: "PENDENTE",
        senha: 201,
        dataOperacional: "2026-11-01",
        versao: 1,
        demo: false,
        demoAmbiente: null,
        createdAt: "2026-11-01T10:00:00.000Z",
        preparoZero: false,
        elegivelCozinha: true,
        autorizacaoOperacional: null,
        itens: [],
      },
      {
        id: "m2",
        status: "EM_PREPARO",
        senha: 202,
        dataOperacional: "2026-11-01",
        versao: 1,
        demo: false,
        demoAmbiente: null,
        createdAt: "2026-11-01T10:05:00.000Z",
        preparoZero: false,
        elegivelCozinha: true,
        autorizacaoOperacional: null,
        itens: [],
      },
    ],
  };

  try {
    const view = await render(
      <KitchenBoard controller={controller} name="Painel Mobile" />,
    );
    expect(screen.getByText("201")).toBeTruthy();
    expect(screen.queryByText("202")).toBeNull();

    await fireEvent.press(
      screen.getByRole("button", { name: /Em preparo/ }),
    );
    expect(screen.getByText("202")).toBeTruthy();
    expect(screen.queryByText("201")).toBeNull();
    await view.unmount();
  } finally {
    Dimensions.set({ window: prevWindow, screen: prevScreen });
  }
});

it("alterna entre grids 1x1, 2x1 e 3x1 no Kanban e na ordem de chegada", async () => {
  const controller = new QueueController(
    { list: async () => [], execute: jest.fn() },
    { load: async () => [], save: async () => undefined },
    () => "key",
    jest.fn(),
  );
  controller.state = {
    ...controller.state,
    loaded: true,
    stale: false,
    orders: [
      {
        id: "g1",
        status: "PENDENTE",
        senha: 301,
        dataOperacional: "2026-11-01",
        versao: 1,
        demo: false,
        demoAmbiente: null,
        createdAt: "2026-11-01T10:00:00.000Z",
        preparoZero: false,
        elegivelCozinha: true,
        autorizacaoOperacional: null,
        itens: [],
      },
      {
        id: "g2",
        status: "EM_PREPARO",
        senha: 302,
        dataOperacional: "2026-11-01",
        versao: 1,
        demo: false,
        demoAmbiente: null,
        createdAt: "2026-11-01T10:05:00.000Z",
        preparoZero: false,
        elegivelCozinha: true,
        autorizacaoOperacional: null,
        itens: [],
      },
    ],
  };

  const view = await render(
    <KitchenBoard controller={controller} name="Painel Grid" />,
  );

  expect(
    screen.getByRole("button", { name: "3x1" }).props.accessibilityState
      .selected,
  ).toBe(true);

  await fireEvent.press(screen.getByRole("button", { name: "1x1" }));
  expect(
    screen.getByRole("button", { name: "1x1" }).props.accessibilityState
      .selected,
  ).toBe(true);
  expect(screen.getByText("301")).toBeTruthy();
  expect(screen.queryByText("302")).toBeNull();

  await fireEvent.press(
    screen.getByRole("button", { name: "Primeiro → Último" }),
  );
  expect(screen.getByText("Grade 1x1")).toBeTruthy();

  await fireEvent.press(screen.getByRole("button", { name: "2x1" }));
  expect(
    screen.getByRole("button", { name: "2x1" }).props.accessibilityState
      .selected,
  ).toBe(true);
  expect(screen.getByText("Grade 2x1")).toBeTruthy();
  expect(screen.getByText("301")).toBeTruthy();
  expect(screen.getByText("302")).toBeTruthy();

  await fireEvent.press(screen.getByRole("button", { name: "3x1" }));
  expect(screen.getByText("Grade 3x1")).toBeTruthy();

  await view.unmount();
});

it("mantem filtro de status sempre visivel e filtra pedidos em Kanban e Ordem de chegada", async () => {
  const controller = new QueueController(
    { list: async () => [], execute: jest.fn() },
    { load: async () => [], save: async () => undefined },
    () => "key",
    jest.fn(),
  );
  controller.state = {
    ...controller.state,
    loaded: true,
    stale: false,
    orders: [
      {
        id: "f1",
        status: "PENDENTE",
        senha: 401,
        dataOperacional: "2026-11-01",
        versao: 1,
        demo: false,
        demoAmbiente: null,
        createdAt: "2026-11-01T10:00:00.000Z",
        preparoZero: false,
        elegivelCozinha: true,
        autorizacaoOperacional: null,
        itens: [],
      },
      {
        id: "f2",
        status: "EM_PREPARO",
        senha: 402,
        dataOperacional: "2026-11-01",
        versao: 1,
        demo: false,
        demoAmbiente: null,
        createdAt: "2026-11-01T10:05:00.000Z",
        preparoZero: false,
        elegivelCozinha: true,
        autorizacaoOperacional: null,
        itens: [],
      },
    ],
  };

  const view = await render(
    <KitchenBoard controller={controller} name="Painel Filtro" />,
  );

  // Mesmo no Kanban 3x1, a barra de filtro de status fica visivel.
  expect(screen.getByRole("button", { name: /^Todos/ })).toBeTruthy();
  expect(screen.getByRole("button", { name: /^Pendentes/ })).toBeTruthy();
  expect(screen.getByRole("button", { name: /^Em preparo/ })).toBeTruthy();
  expect(screen.getByRole("button", { name: /^Prontos/ })).toBeTruthy();

  await fireEvent.press(screen.getByRole("button", { name: /^Em preparo/ }));
  expect(screen.getByText("402")).toBeTruthy();
  expect(screen.queryByText("401")).toBeNull();

  // Ao trocar para Primeiro → Último, o filtro permanece visivel e ativo.
  await fireEvent.press(
    screen.getByRole("button", { name: "Primeiro → Último" }),
  );
  expect(screen.getByRole("button", { name: /^Todos/ })).toBeTruthy();
  expect(screen.getByText("402")).toBeTruthy();
  expect(screen.queryByText("401")).toBeNull();

  await fireEvent.press(screen.getByRole("button", { name: /^Todos/ }));
  expect(screen.getByText("401")).toBeTruthy();
  expect(screen.getByText("402")).toBeTruthy();

  await view.unmount();
});

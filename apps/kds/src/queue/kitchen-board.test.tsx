import { fireEvent, render, screen } from "@testing-library/react-native";
import { QueueController } from "./controller";
import { KitchenBoard } from "./kitchen-board";
import type { Order } from "./types";

jest.mock("react-native-safe-area-context", () => ({
  SafeAreaView:
    jest.requireActual<typeof import("react-native")>("react-native").View,
}));
const order = (status: Order["status"], senha: number): Order => ({
  id: `11111111-1111-4111-8111-${senha.toString().padStart(12, "0")}`,
  status,
  senha,
  dataOperacional: "2026-11-20",
  versao: 1,
  demo: false,
  demoAmbiente: null,
  createdAt: "2026-11-20T12:00:00.000Z",
  preparoZero: false,
  elegivelCozinha: true,
  autorizacaoOperacional: null,
  itens: [
    {
      nomeProduto: "Pastel de carne",
      quantidade: 2,
      variacaoNome: null,
      observacao: null,
      adicionais: [],
      escolhas: [],
    },
  ],
});

function loadedController() {
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
      order("PENDENTE", 41),
      order("EM_PREPARO", 42),
      order("PRONTO", 43),
    ],
  };
  return controller;
}

it("uses one compact toolbar, large stage filters and a menu for secondary controls", async () => {
  const view = await render(
    <KitchenBoard controller={loadedController()} name="Painel A" />,
  );
  expect(screen.getByRole("button", { name: "Abrir menu da cozinha" })).toBeTruthy();
  expect(screen.getByRole("button", { name: /Pendentes, 1 pedido/ })).toBeTruthy();
  expect(screen.getByRole("button", { name: /Em preparo, 1 pedido/ })).toBeTruthy();
  expect(screen.getByRole("button", { name: /Prontos, 1 pedido/ })).toBeTruthy();
  expect(screen.queryByText("TOTEMOS / COZINHA")).toBeNull();

  await fireEvent.press(
    screen.getByRole("button", { name: "Abrir menu da cozinha" }),
  );
  expect(screen.getByText("Menu da cozinha")).toBeTruthy();
  expect(screen.getByText("Painel A")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Atualizar fila" })).toBeTruthy();
  await view.unmount();
});

it("filters the operational queue without changing controller state", async () => {
  const controller = loadedController();
  const view = await render(
    <KitchenBoard controller={controller} name="Painel A" />,
  );
  await fireEvent.press(
    screen.getByRole("button", { name: /Pendentes, 1 pedido/ }),
  );
  expect(screen.getByText("#041")).toBeTruthy();
  expect(screen.queryByText("#042")).toBeNull();
  expect(controller.state.orders).toHaveLength(3);
  await view.unmount();
});
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

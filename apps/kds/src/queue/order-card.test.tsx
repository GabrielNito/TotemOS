import { fireEvent, render, screen } from "@testing-library/react-native";
import { OrderCard, elapsed } from "./order-card";
import { sortOrdersByArrival, waitColor } from "./ui-config";
import type { Order } from "./types";
const order: Order = {
  id: "11111111-1111-4111-8111-111111111111",
  status: "PRONTO",
  senha: 12,
  dataOperacional: "2026-11-01",
  versao: 4,
  demo: true,
  demoAmbiente: "ensaio",
  createdAt: "2026-11-01T12:00:00.000Z",
  preparoZero: true,
  elegivelCozinha: true,
  autorizacaoOperacional: { tipo: "DEMO", financeira: false },
  itens: [
    {
      nomeProduto: "Água",
      quantidade: 2,
      variacaoNome: "500 ml",
      observacao: "Entregar sem abrir a embalagem, cliente busca depois.",
      adicionais: [{ nomeAdicional: "Gelo", quantidade: 1 }],
      escolhas: [{ nomeItem: "Sem gás" }],
    },
  ],
};
it("shows operational date, DEMO and complete observations with accessible touch action", async () => {
  const action = jest.fn();
  await render(
    <OrderCard
      order={order}
      now={Date.parse(order.createdAt) + 600000}
      isNew={true}
      disabled={false}
      onAction={action}
    />,
  );
  expect(screen.getByText("Dia 01/11/2026")).toBeTruthy();
  expect(screen.getByText(/DEMO/)).toBeTruthy();
  expect(
    screen.getByText(/Entregar sem abrir/).props.numberOfLines,
  ).toBeUndefined();
  await fireEvent.press(
    screen.getByRole("button", { name: "Confirmar entrega do pedido 12" }),
  );
  expect(action).toHaveBeenCalledWith(order);
});
it("blocks stale and uncertain operations", async () => {
  const action = jest.fn();
  await render(
    <OrderCard
      order={order}
      now={0}
      isNew={false}
      disabled={true}
      onAction={action}
    />,
  );
  await fireEvent.press(screen.getByRole("button"));
  expect(action).not.toHaveBeenCalled();
});
it("formats elapsed duration without ETA or negative age", () => {
  expect(elapsed(order.createdAt, Date.parse(order.createdAt) - 10000)).toBe(
    "0 min",
  );
  expect(elapsed(order.createdAt, Date.parse(order.createdAt) + 3660000)).toBe(
    "1 h 1 min",
  );
});
it("shows definitive rejection separately from pending recovery", async () => {
  await render(
    <OrderCard
      order={order}
      now={0}
      isNew={false}
      disabled={false}
      onAction={jest.fn()}
      rejection="Operação rejeitada. Confira o estado atual e decida novamente."
    />,
  );
  expect(screen.getByText(/Operação rejeitada/)).toBeTruthy();
  expect(screen.getByRole("button").props.accessibilityState.disabled).toBe(
    false,
  );
});
it("shows a restarted operation as recovery even after its scheduled time", async () => {
  await render(
    <OrderCard
      order={order}
      now={100}
      isNew={false}
      disabled={true}
      onAction={jest.fn()}
      pending={{
        key: "key",
        orderId: order.id,
        kind: "status",
        target: "ENTREGUE",
        version: 4,
        attempts: 1,
        nextAttempt: 0,
      }}
    />,
  );
  expect(screen.getByText(/Recuperando operação/)).toBeTruthy();
});
it("maps visual wait bands to high-contrast light theme colors", () => {
  expect(waitColor(5)).toBe("#047857");
  expect(waitColor(10)).toBe("#B45309");
  expect(waitColor(20)).toBe("#DC2626");
});
it("sorts orders by arrival ascending (primeiro > ultimo) and descending (ultimo > primeiro)", () => {
  const older: Order = {
    ...order,
    id: "a",
    senha: 1,
    createdAt: "2026-11-01T10:00:00.000Z",
  };
  const middle: Order = {
    ...order,
    id: "b",
    senha: 2,
    createdAt: "2026-11-01T10:05:00.000Z",
  };
  const newer: Order = {
    ...order,
    id: "c",
    senha: 3,
    createdAt: "2026-11-01T10:10:00.000Z",
  };
  expect(
    sortOrdersByArrival([newer, older, middle], "asc").map((o) => o.id),
  ).toEqual(["a", "b", "c"]);
  expect(
    sortOrdersByArrival([older, middle, newer], "desc").map((o) => o.id),
  ).toEqual(["c", "b", "a"]);
});

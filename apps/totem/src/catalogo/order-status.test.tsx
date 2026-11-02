import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import { OrderStatus } from "./order-status";
import { useOrderTracking } from "./use-order-tracking";
import type { OrderSubmission } from "./order-submission";
import type { OrderStatusValue } from "./order-tracking";
jest.mock("./use-order-tracking", () => ({ useOrderTracking: jest.fn() }));
jest.mock("../kiosk/ui", () => {
  const { Text, Pressable } = jest.requireActual("react-native");
  return {
    KioskText: Text,
    BrandHeader: () => null,
    colors: {},
    Action: ({
      children,
      onPress,
      disabled,
    }: {
      children: React.ReactNode;
      onPress: () => void;
      disabled: boolean;
    }) => (
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={onPress}
      >
        <Text>{children}</Text>
      </Pressable>
    ),
  };
});
const result = {
  id: "11111111-1111-4111-8111-111111111111",
  negocioId: "tenant",
  status: "AGUARDANDO_PAGAMENTO" as const,
  valorTotal: "48.00",
};
const snapshot = {
  ...result,
  versao: 3,
  senha: null,
  dataOperacional: null,
  demo: true,
  demoAmbiente: "ensaio",
  autorizacaoOperacional: null,
};
const refresh = jest.fn();
const onNew = jest.fn();
function state(status: OrderStatusValue = "AGUARDANDO_PAGAMENTO", extra = {}) {
  jest.mocked(useOrderTracking).mockReturnValue({
    snapshot: { ...snapshot, status, ...extra },
    syncedAt: 100,
    busy: false,
    stale: false,
    refresh,
  });
}
async function show() {
  return render(
    <OrderStatus
      negocioId="tenant"
      submission={{} as OrderSubmission}
      result={result}
      busy={false}
      error=""
      onRetry={jest.fn()}
      onNew={onNew}
    />,
  );
}
beforeEach(() => {
  jest.clearAllMocks();
  state();
});
test("aguarda autorização sem senha inventada, cliente ou promessa financeira", async () => {
  await show();
  expect(screen.getByText(/Aguardando autorização para preparo/)).toBeTruthy();
  expect(screen.getByText(/Senha ainda não atribuída/)).toBeTruthy();
  expect(screen.queryByText("Novo atendimento")).toBeNull();
  expect(screen.queryByText(/Pagamento aprovado/)).toBeNull();
  expect(screen.getByText("Operação demonstrativa")).toBeTruthy();
  expect(screen.getByText(/Última sincronização/)).toBeTruthy();
  await fireEvent.press(screen.getByText("Atualizar acompanhamento"));
  expect(refresh).toHaveBeenCalled();
});
test.each([
  "PENDENTE",
  "EM_PREPARO",
  "PRONTO",
  "ENTREGUE",
  "CANCELADO",
  "CANCELADO_AGUARDANDO_ESTORNO",
] as const)(
  "mostra %s real e só entrega permite novo atendimento",
  async (status) => {
    state(status, {
      senha: 12,
      dataOperacional: "2026-11-02",
      autorizacaoOperacional: { tipo: "DEMO", financeira: false },
    });
    await show();
    expect(screen.getByText("12")).toBeTruthy();
    expect(screen.getByText(/2026-11-02/)).toBeTruthy();
    expect(
      screen.getByText(/Liberação operacional de demonstração/),
    ).toBeTruthy();
    expect(screen.queryByText(/Pagamento aprovado/)).toBeNull();
    if (status === "ENTREGUE") {
      await fireEvent.press(screen.getByText("Novo atendimento"));
      expect(onNew).toHaveBeenCalledTimes(1);
    } else expect(screen.queryByText("Novo atendimento")).toBeNull();
  },
);
test("sem primeiro GET usa apenas referência POST, sem inferir entrega", async () => {
  jest
    .mocked(useOrderTracking)
    .mockReturnValue({ busy: true, stale: false, refresh });
  await show();
  expect(screen.getByText(/Confirmando o acompanhamento/)).toBeTruthy();
  expect(screen.queryByText("Novo atendimento")).toBeNull();
});

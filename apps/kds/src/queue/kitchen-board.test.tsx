import { fireEvent, render, screen } from "@testing-library/react-native";
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

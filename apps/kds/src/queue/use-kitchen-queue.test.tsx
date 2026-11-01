import { renderHook, waitFor, act } from "@testing-library/react-native";
import { AppState } from "react-native";
import { router } from "expo-router";
import { restoreDeviceSession } from "../device-pairing/session";
import { useKitchenQueue } from "./use-kitchen-queue";
import { createQueueApi } from "./api";
jest.mock("expo-router", () => {
  const react = jest.requireActual<typeof import("react")>("react");
  return { router: { replace: jest.fn() }, useFocusEffect: react.useEffect };
});
jest.mock("expo-crypto", () => ({
  randomUUID: jest.fn(() => "11111111-1111-4111-8111-111111111111"),
}));
jest.mock("../device-pairing/session", () => ({
  restoreDeviceSession: jest.fn(),
}));
jest.mock("./storage", () => ({
  operationStorage: () => ({
    load: async () => [],
    save: async () => undefined,
  }),
}));
jest.mock("./api", () => ({
  createQueueApi: jest.fn(),
  safeQueueError: () => "Falha de comunicação",
}));
const authenticated = {
  kind: "authenticated",
  deviceToken: "secret",
  dispositivo: {
    id: "panel",
    negocioId: "tenant",
    nome: "Cozinha",
    tipo: "PAINEL",
  },
};
beforeEach(() => {
  jest.clearAllMocks();
  Object.defineProperty(AppState, "currentState", {
    value: "active",
    configurable: true,
  });
});
it("does not load orders before PAINEL session validation and stops in background/unmount", async () => {
  let resolve!: (v: unknown) => void;
  (restoreDeviceSession as jest.Mock).mockImplementation(
    () =>
      new Promise((r) => {
        resolve = r;
      }),
  );
  const list = jest.fn(async () => []);
  (createQueueApi as jest.Mock).mockReturnValue({ list, execute: jest.fn() });
  const listener = jest.spyOn(AppState, "addEventListener");
  const view = renderHook(useKitchenQueue);
  expect(view.result.current.checking).toBe(true);
  expect(createQueueApi).not.toHaveBeenCalled();
  await act(async () => {
    resolve(authenticated);
  });
  await waitFor(() => expect(list).toHaveBeenCalledTimes(1));
  expect(restoreDeviceSession).toHaveBeenCalledWith({
    expectedDeviceType: "PAINEL",
  });
  await act(async () => {
    listener.mock.calls[0][1]("background");
  });
  expect(view.result.current.session?.controller.state.stale).toBe(true);
  await view.unmount();
  listener.mockRestore();
});
it.each(["missing-token", "invalid-token"])(
  "routes %s to pairing without queue requests",
  async (reason) => {
    (restoreDeviceSession as jest.Mock).mockResolvedValue({
      kind: "pairing",
      reason,
    });
    const view = renderHook(useKitchenQueue);
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/parear"));
    expect(createQueueApi).not.toHaveBeenCalled();
    await view.unmount();
  },
);
it("shows network session error and retries without constructing authenticated API", async () => {
  (restoreDeviceSession as jest.Mock).mockResolvedValue({
    kind: "error",
    message: "Verificação indisponível",
  });
  const view = renderHook(useKitchenQueue);
  await waitFor(() =>
    expect(view.result.current.error).toBe("Verificação indisponível"),
  );
  expect(createQueueApi).not.toHaveBeenCalled();
  await act(async () => {
    view.result.current.retry();
  });
  await waitFor(() => expect(restoreDeviceSession).toHaveBeenCalledTimes(2));
  await view.unmount();
});

import { renderHook, act } from "@testing-library/react-native";
import { AppState, type AppStateStatus } from "react-native";
import { useOrderTracking } from "./use-order-tracking";
import { getOrderTracking, TrackingError } from "./order-tracking-api";
import type { OrderSubmission } from "./order-submission";
jest.mock("./order-tracking-api", () => ({
  ...jest.requireActual("./order-tracking-api"),
  getOrderTracking: jest.fn(),
}));
const mockReplace = jest.fn();
const mockRouter = { replace: mockReplace };
jest.mock("expo-router", () => ({ useRouter: () => mockRouter }));
const snapshot = {
  id: "11111111-1111-4111-8111-111111111111",
  status: "PRONTO" as const,
  senha: 12,
  dataOperacional: "2026-11-02",
  versao: 4,
  valorTotal: "48.00",
  demo: true,
  demoAmbiente: "ensaio",
  autorizacaoOperacional: null,
};
let onState: (state: AppStateStatus) => void;
const remove = jest.fn();
beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  Object.defineProperty(AppState, "currentState", {
    value: "active",
    configurable: true,
  });
  jest
    .spyOn(AppState, "addEventListener")
    .mockImplementation((_event, callback) => {
      onState = callback;
      return { remove };
    });
  jest.mocked(getOrderTracking).mockResolvedValue(snapshot);
});
afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});
test("integra ciclo RN, persistência, pausa/retomada e desmontagem sem GET posterior", async () => {
  const saveTracking = jest.fn(async () => {});
  const submission = {
    attempt: {},
    saveTracking,
  } as unknown as OrderSubmission;
  const view = await renderHook(() =>
    useOrderTracking("tenant", snapshot.id, submission),
  );
  expect(view.result.current.snapshot).toEqual(snapshot);
  expect(saveTracking).toHaveBeenCalled();
  await act(async () => onState("background"));
  await act(async () => jest.advanceTimersByTime(60000));
  expect(getOrderTracking).toHaveBeenCalledTimes(1);
  await act(async () => onState("active"));
  expect(getOrderTracking).toHaveBeenCalledTimes(2);
  await view.unmount();
  expect(remove).toHaveBeenCalled();
  await act(async () => jest.advanceTimersByTime(60000));
  expect(getOrderTracking).toHaveBeenCalledTimes(2);
});
test("401 redireciona pareamento preservando snapshot e tentativa", async () => {
  const attempt = { tracking: { snapshot, syncedAt: 100 } };
  const submission = {
    attempt,
    saveTracking: jest.fn(),
  } as unknown as OrderSubmission;
  jest
    .mocked(getOrderTracking)
    .mockRejectedValueOnce(new TrackingError("http", 401));
  const view = await renderHook(() =>
    useOrderTracking("tenant", snapshot.id, submission),
  );
  expect(mockReplace).toHaveBeenCalledWith("/parear");
  expect(submission.attempt).toBe(attempt);
  expect(view.result.current.snapshot).toEqual(snapshot);
  expect(view.result.current.stale).toBe(true);
  await view.unmount();
});

import * as SecureStore from "expo-secure-store";
import { loadPreviewSession, savePreviewSession } from "./preview-session";
import {
  findProduct,
  initialConfiguration,
  type Line,
} from "./reference-model";

jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
}));

const read = jest.mocked(SecureStore.getItemAsync);
const write = jest.mocked(SecureStore.setItemAsync);
const line: Line = {
  key: "demo-line",
  productId: "bacon",
  quantity: 2,
  configuration: initialConfiguration(findProduct("bacon")),
};

beforeEach(() => {
  jest.clearAllMocks();
  read.mockResolvedValue(null);
  write.mockResolvedValue();
});

test("restores only validated demo cart and fulfillment mode", async () => {
  read.mockResolvedValue(JSON.stringify({ cart: [line], mode: "qr" }));
  expect(await loadPreviewSession()).toEqual({ cart: [line], mode: "qr" });
  expect(read).toHaveBeenCalledWith("totemos.kiosk-preview.v2");
});

test.each([
  "broken",
  "null",
  "[]",
  '{"cart":[{"productId":"obsolete"}],"mode":"owner"}',
])("invalid stored content falls back safely: %s", async (stored) => {
  read.mockResolvedValue(stored);
  expect(await loadPreviewSession()).toEqual({ cart: [], mode: "counter" });
});

test("invalid cart does not discard a valid fulfillment mode", async () => {
  read.mockResolvedValue(JSON.stringify({ cart: [{}], mode: "table" }));
  expect(await loadPreviewSession()).toEqual({ cart: [], mode: "table" });
});

test("only demo order data is stored, without identity or device credentials", async () => {
  await savePreviewSession({
    cart: [line],
    mode: "table",
    name: "Nito",
    cpf: "123",
    deviceToken: "secret",
  } as Parameters<typeof savePreviewSession>[0]);
  expect(write).toHaveBeenCalledWith(
    "totemos.kiosk-preview.v2",
    JSON.stringify({ cart: [line], mode: "table" }),
  );
});

test("serializes writes and takes a snapshot before asynchronous persistence", async () => {
  let finish!: () => void;
  write.mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  const first = savePreviewSession({ cart: [line], mode: "counter" });
  const next = { cart: [{ ...line, quantity: 3 }], mode: "qr" as const };
  const second = savePreviewSession(next);
  next.cart[0].quantity = 99;
  await Promise.resolve();
  expect(write).toHaveBeenCalledTimes(1);
  finish();
  await Promise.all([first, second]);
  expect(JSON.parse(write.mock.calls[1][1]).cart[0].quantity).toBe(3);
});

test("storage failures leave the flow usable and do not block later writes", async () => {
  write.mockRejectedValueOnce(new Error("storage unavailable"));
  await expect(
    savePreviewSession({ cart: [line], mode: "counter" }),
  ).resolves.toBeUndefined();
  await expect(
    savePreviewSession({ cart: [], mode: "qr" }),
  ).resolves.toBeUndefined();
  expect(write).toHaveBeenCalledTimes(2);
  read.mockRejectedValueOnce(new Error("storage unavailable"));
  expect(await loadPreviewSession()).toEqual({ cart: [], mode: "counter" });
});

import * as SecureStore from "expo-secure-store";
import { loadBusinessCart, saveBusinessCart } from "./cart-storage";
import { createCartLine, type CatalogProduct } from "./model";

jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
}));
const read = jest.mocked(SecureStore.getItemAsync);
const write = jest.mocked(SecureStore.setItemAsync);
const product: CatalogProduct = {
  id: "product-a",
  nome: "Café",
  descricao: null,
  precoBase: 8.9,
  imagemUrl: null,
  tempoEstimadoPreparo: 0,
  variacoes: [],
  adicionais: [],
};
const line = createCartLine(product, { variacaoId: null, adicionais: {} }, 2);
beforeEach(() => {
  jest.clearAllMocks();
  read.mockResolvedValue(null);
  write.mockResolvedValue();
});

test("persists and restores only the requested tenant and its monetary snapshots", async () => {
  await saveBusinessCart("tenant-a", [line]);
  expect(write).toHaveBeenCalledWith(
    "totemos.cart.tenant-a",
    JSON.stringify({ negocioId: "tenant-a", cart: [line] }),
  );
  read.mockResolvedValue(
    JSON.stringify({ negocioId: "tenant-a", cart: [line] }),
  );
  expect(await loadBusinessCart("tenant-a")).toEqual([line]);
  expect(read).toHaveBeenCalledWith("totemos.cart.tenant-a");
  expect(await loadBusinessCart("tenant-b")).toEqual([]);
});

test.each([
  "broken",
  "null",
  JSON.stringify({
    negocioId: "tenant-a",
    cart: [{ ...line, precoNoMomento: -1 }],
  }),
  JSON.stringify({
    negocioId: "tenant-a",
    cart: [{ ...line, quantidade: 100 }],
  }),
  JSON.stringify({
    negocioId: "tenant-a",
    cart: [{ ...line, selection: { variacaoId: "other", adicionais: {} } }],
  }),
  JSON.stringify({ negocioId: "tenant-a", cart: [line, line] }),
])(
  "invalid stored carts are discarded without changing credentials: %s",
  async (stored) => {
    read.mockResolvedValue(stored);
    expect(await loadBusinessCart("tenant-a")).toEqual([]);
    expect(write).not.toHaveBeenCalled();
  },
);

test("missing or invalid tenant IDs never access storage", async () => {
  await expect(loadBusinessCart("")).rejects.toThrow();
  expect(() => saveBusinessCart("../other", [line])).toThrow();
  expect(read).not.toHaveBeenCalled();
  expect(write).not.toHaveBeenCalled();
});

test("serializes updates per tenant and continues after storage failures", async () => {
  let finish!: () => void;
  write.mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  const first = saveBusinessCart("tenant-a", [line]);
  const second = saveBusinessCart("tenant-a", [{ ...line, quantidade: 3 }]);
  await Promise.resolve();
  expect(write).toHaveBeenCalledTimes(1);
  finish();
  await Promise.all([first, second]);
  expect(JSON.parse(write.mock.calls[1][1]).cart[0].quantidade).toBe(3);
  write.mockRejectedValueOnce(new Error("unavailable"));
  await expect(saveBusinessCart("tenant-a", [])).resolves.toBeUndefined();
  read.mockRejectedValueOnce(new Error("unavailable"));
  expect(await loadBusinessCart("tenant-a")).toEqual([]);
});

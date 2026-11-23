import AsyncStorage from "@react-native-async-storage/async-storage";
import { operationStorage } from "./storage";
const snapshotOrder = {
  id: "11111111-1111-4111-8111-111111111111",
  status: "PENDENTE" as const,
  senha: 12,
  dataOperacional: "2026-11-01",
  versao: 3,
  demo: true,
  demoAmbiente: "ensaio",
  createdAt: "2026-11-01T12:00:00.000Z",
  preparoZero: false,
  elegivelCozinha: true as const,
  autorizacaoOperacional: { tipo: "DEMO" as const, financeira: false as const },
  itens: [],
};
jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));
it("persists only operation metadata scoped to tenant and panel", async () => {
  const storage = operationStorage("panel", "tenant");
  await storage.save([
    {
      kind: "senha",
      key: "uuid",
      orderId: "order",
      attempts: 0,
      nextAttempt: 0,
    },
  ]);
  expect(AsyncStorage.setItem).toHaveBeenCalledWith(
    "totemos.kds.operations.v1.tenant.panel",
    expect.not.stringContaining("token"),
  );
});

it("persists and restores a validated queue snapshot in the same tenant scope", async () => {
  const storage = operationStorage("panel", "tenant");
  await storage.saveSnapshot?.([snapshotOrder], 1234);
  expect(AsyncStorage.setItem).toHaveBeenCalledWith(
    "totemos.kds.queue.v1.tenant.panel",
    JSON.stringify({ orders: [snapshotOrder], lastSync: 1234 }),
  );
  (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(
    JSON.stringify({ orders: [snapshotOrder], lastSync: 1234 }),
  );
  await expect(storage.loadSnapshot?.()).resolves.toEqual({
    orders: [snapshotOrder],
    lastSync: 1234,
  });
});
it("blocks corrupt journals instead of silently losing original UUIDs", async () => {
  (AsyncStorage.getItem as jest.Mock).mockResolvedValue("[{}]");
  await expect(operationStorage("panel", "tenant").load()).rejects.toThrow();
});
it.each([
  { kind: "senha", key: "", orderId: "order", attempts: 0, nextAttempt: 0 },
  { kind: "senha", key: "key", orderId: "order", attempts: -1, nextAttempt: 0 },
  {
    kind: "status",
    key: "key",
    orderId: "order",
    attempts: 0,
    nextAttempt: 0,
    target: "PRONTO",
    version: 0,
  },
  { kind: "senha", key: "key", orderId: "order", attempts: 0, nextAttempt: -1 },
])(
  "rejects invalid journal metadata without overwriting it: %j",
  async (op) => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify([op]));
    const before = (AsyncStorage.setItem as jest.Mock).mock.calls.length;
    await expect(operationStorage("panel", "tenant").load()).rejects.toThrow();
    expect(AsyncStorage.setItem).toHaveBeenCalledTimes(before);
  },
);
it("never reads another tenant or device journal", async () => {
  const get = AsyncStorage.getItem as jest.Mock;
  get.mockResolvedValue(null);
  await operationStorage("panel-A", "tenant-A").load();
  await operationStorage("panel-B", "tenant-A").load();
  await operationStorage("panel-A", "tenant-B").load();
  expect(get.mock.calls.slice(-3).map(([key]) => key)).toEqual([
    "totemos.kds.operations.v1.tenant-A.panel-A",
    "totemos.kds.operations.v1.tenant-A.panel-B",
    "totemos.kds.operations.v1.tenant-B.panel-A",
  ]);
});
it("does not overwrite invalid JSON", async () => {
  (AsyncStorage.getItem as jest.Mock).mockResolvedValue("broken{");
  const before = (AsyncStorage.setItem as jest.Mock).mock.calls.length;
  await expect(operationStorage("panel", "tenant").load()).rejects.toThrow();
  expect(AsyncStorage.setItem).toHaveBeenCalledTimes(before);
});
it("loads a paused operation and preserves its full recovery metadata", async () => {
  const op = {
    kind: "status",
    key: "22222222-2222-4222-8222-222222222222",
    orderId: "11111111-1111-4111-8111-111111111111",
    target: "EM_PREPARO",
    version: 3,
    attempts: 2,
    nextAttempt: 60000,
    halted: true,
  };
  (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify([op]));
  expect(await operationStorage("panel", "tenant").load()).toEqual([op]);
});
it.each([
  { key: "not-a-uuid" },
  { orderId: "not-a-uuid" },
  { halted: "false" },
  { version: -1 },
  { deviceToken: "must-not-be-stored" },
])(
  "rejects malformed operation identity or unexpected fields: %j",
  async (extra) => {
    const op = {
      kind: "senha",
      key: "22222222-2222-4222-8222-222222222222",
      orderId: "11111111-1111-4111-8111-111111111111",
      attempts: 0,
      nextAttempt: 0,
      ...extra,
    };
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify([op]));
    await expect(operationStorage("panel", "tenant").load()).rejects.toThrow();
  },
);
it("rejects duplicate operation UUIDs without dropping either record", async () => {
  const op = {
    kind: "senha",
    key: "22222222-2222-4222-8222-222222222222",
    orderId: "11111111-1111-4111-8111-111111111111",
    attempts: 0,
    nextAttempt: 0,
  };
  (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
    JSON.stringify([op, op]),
  );
  await expect(operationStorage("panel", "tenant").load()).rejects.toThrow();
});
it("treats an empty stored record as corruption, not as a missing journal", async () => {
  (AsyncStorage.getItem as jest.Mock).mockResolvedValue("");
  const before = (AsyncStorage.setItem as jest.Mock).mock.calls.length;
  await expect(operationStorage("panel", "tenant").load()).rejects.toThrow();
  expect(AsyncStorage.setItem).toHaveBeenCalledTimes(before);
});

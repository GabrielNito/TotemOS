import AsyncStorage from "@react-native-async-storage/async-storage";
import { operationStorage } from "./storage";
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
it("blocks corrupt journals instead of silently losing original UUIDs", async () => {
  (AsyncStorage.getItem as jest.Mock).mockResolvedValue("[{}]");
  await expect(operationStorage("panel", "tenant").load()).rejects.toThrow();
});

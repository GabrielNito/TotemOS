import {
  deleteDeviceToken,
  getDeviceToken,
  setDeviceToken,
} from "./device-token";

const mockStorage = new Map<string, string>();

jest.mock("expo-secure-store", () => ({
  deleteItemAsync: jest.fn(async (key: string) => {
    mockStorage.delete(key);
  }),
  getItemAsync: jest.fn(async (key: string) => mockStorage.get(key) ?? null),
  setItemAsync: jest.fn(async (key: string, value: string) => {
    mockStorage.set(key, value);
  }),
}));

describe("device token storage", () => {
  beforeEach(() => {
    mockStorage.clear();
  });

  it("recupera, grava e remove o token do dispositivo", async () => {
    expect(await getDeviceToken()).toBeNull();

    await setDeviceToken("token-de-teste");
    await expect(getDeviceToken()).resolves.toBe("token-de-teste");

    await deleteDeviceToken();
    await expect(getDeviceToken()).resolves.toBeNull();
  });
});

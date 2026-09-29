import * as SecureStore from "expo-secure-store";

const deviceTokenStorageKey = "totemos.device-token";

export function getDeviceToken(): Promise<string | null> {
  return SecureStore.getItemAsync(deviceTokenStorageKey);
}

export function setDeviceToken(token: string): Promise<void> {
  return SecureStore.setItemAsync(deviceTokenStorageKey, token);
}

export function deleteDeviceToken(): Promise<void> {
  return SecureStore.deleteItemAsync(deviceTokenStorageKey);
}

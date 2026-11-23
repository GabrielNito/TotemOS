import * as SecureStore from "expo-secure-store";

const deviceTokenStorageKey = "totemos.device-token";
const deviceSessionStorageKey = "totemos.device-session.v1";

export function getDeviceToken(): Promise<string | null> {
  return SecureStore.getItemAsync(deviceTokenStorageKey);
}

export function setDeviceToken(token: string): Promise<void> {
  return SecureStore.setItemAsync(deviceTokenStorageKey, token);
}

export function deleteDeviceToken(): Promise<void> {
  return SecureStore.deleteItemAsync(deviceTokenStorageKey);
}

export function getDeviceSession(): Promise<string | null> {
  return SecureStore.getItemAsync(deviceSessionStorageKey);
}

export function setDeviceSession(value: string): Promise<void> {
  return SecureStore.setItemAsync(deviceSessionStorageKey, value);
}

export function deleteDeviceSession(): Promise<void> {
  return SecureStore.deleteItemAsync(deviceSessionStorageKey);
}

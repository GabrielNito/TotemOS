import { useCallback, useEffect, useState } from "react";
import { AppState } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { randomUUID } from "expo-crypto";
import { restoreDeviceSession } from "../device-pairing/session";
import { deleteDeviceToken } from "../storage/device-token";
import { createQueueApi } from "./api";
import { QueueController } from "./controller";
import { operationStorage } from "./storage";

export function useKitchenQueue() {
  const [session, setSession] = useState<{
    name: string;
    controller: QueueController;
  } | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [checking, setChecking] = useState(true);
  useEffect(() => {
    let live = true;
    void restoreDeviceSession({ expectedDeviceType: "PAINEL" }).then(
      (result) => {
        if (!live) return;
        if (result.kind === "pairing") {
          router.replace("/parear");
          return;
        }
        if (result.kind === "error") {
          setError(result.message);
          setChecking(false);
          return;
        }
        const { dispositivo, deviceToken } = result;
        const expired = () => {
          if (!live) return;
          setSession(null);
          setError("Sessão expirada. Faça o pareamento novamente.");
          void deleteDeviceToken()
            .catch(() => undefined)
            .finally(() => {
              if (live) router.replace("/parear");
            });
        };
        const configured = Number(process.env.EXPO_PUBLIC_KDS_POLL_MS);
        const interval =
          Number.isFinite(configured) && configured >= 5000 ? configured : 5000;
        setSession({
          name: dispositivo.nome,
          controller: new QueueController(
            createQueueApi(deviceToken),
            operationStorage(dispositivo.id, dispositivo.negocioId),
            randomUUID,
            expired,
            interval,
          ),
        });
        setChecking(false);
      },
    );
    return () => {
      live = false;
    };
  }, [attempt]);
  useFocusEffect(
    useCallback(() => {
      if (!session) return;
      const controller = session.controller;
      if (AppState.currentState === "active") void controller.start();
      const subscription = AppState.addEventListener("change", (status) => {
        if (status === "active") void controller.start();
        else controller.stop();
      });
      return () => {
        subscription.remove();
        controller.stop();
      };
    }, [session]),
  );
  return {
    session,
    error,
    checking,
    retry: () => {
      setChecking(true);
      setError("");
      setAttempt((n) => n + 1);
    },
  };
}

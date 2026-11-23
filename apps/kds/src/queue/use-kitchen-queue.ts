import { useCallback, useEffect, useState } from "react";
import { AppState } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { randomUUID } from "expo-crypto";
import { restoreDeviceSession } from "../device-pairing/session";
import { deleteDeviceToken } from "../storage/device-token";
import { createQueueApi } from "./api";
import { QueueController } from "./controller";
import { operationStorage } from "./storage";
import { OfflineInboxController } from "../offline-inbox/controller";
import { createOfflineReconciliationApi } from "../offline-inbox/api";
import { offlineInboxStorage } from "../offline-inbox/storage";
import { createOfflineLanServer } from "../offline-lan/server";

export function useKitchenQueue() {
  const [session, setSession] = useState<{
    name: string;
    controller: QueueController;
    offline?: {
      inbox: OfflineInboxController;
      server: ReturnType<typeof createOfflineLanServer>;
    };
  } | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [checking, setChecking] = useState(true);
  const [offlinePending, setOfflinePending] = useState(0);
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
        const lanCredential = result.negocio?.lanCredential;
        const inbox = lanCredential
          ? new OfflineInboxController(
              dispositivo.negocioId,
              offlineInboxStorage(dispositivo.negocioId, dispositivo.id),
              createOfflineReconciliationApi(deviceToken),
            )
          : null;
        setSession({
          name: dispositivo.nome,
          controller: new QueueController(
            createQueueApi(deviceToken),
            operationStorage(dispositivo.id, dispositivo.negocioId),
            randomUUID,
            expired,
            interval,
          ),
          ...(inbox && lanCredential
            ? {
                offline: {
                  inbox,
                  server: createOfflineLanServer({
                    negocioId: dispositivo.negocioId,
                    credential: lanCredential,
                    inbox,
                    onInboxChanged: () => {
                      void inbox.pendingCount().then(setOfflinePending);
                    },
                  }),
                },
              }
            : {}),
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
      const start = () => {
        void controller.start();
        void session.offline?.server.start().catch(() => undefined);
        void session.offline?.inbox
          .reconcile()
          .catch(() => undefined)
          .finally(() => {
            void session.offline?.inbox
              .pendingCount()
              .then(setOfflinePending)
              .catch(() => undefined);
          });
      };
      const stop = () => {
        controller.stop();
        void session.offline?.server.stop().catch(() => undefined);
      };
      if (AppState.currentState === "active") start();
      const subscription = AppState.addEventListener("change", (status) => {
        if (status === "active") start();
        else stop();
      });
      return () => {
        subscription.remove();
        stop();
      };
    }, [session]),
  );
  return {
    session,
    error,
    checking,
    offlinePending,
    retry: () => {
      setChecking(true);
      setError("");
      setAttempt((n) => n + 1);
    },
  };
}

import { useEffect, useMemo, useState } from "react";
import { AppState } from "react-native";
import { useRouter } from "expo-router";
import { OrderTracking } from "./order-tracking";
import { getOrderTracking } from "./order-tracking-api";
import type { OrderSubmission } from "./order-submission";

export function useOrderTracking(
  negocioId: string,
  id: string,
  submission: OrderSubmission,
) {
  const router = useRouter();
  const tracking = useMemo(
    () =>
      new OrderTracking(
        (signal) => getOrderTracking(negocioId, id, signal),
        (snapshot, syncedAt) => submission.saveTracking(snapshot, syncedAt),
        submission.attempt?.tracking,
      ),
    [negocioId, id, submission],
  );
  const [state, setState] = useState(tracking.state);
  useEffect(() => {
    tracking.subscribe(setState);
    tracking.setActive(AppState.currentState === "active");
    const listener = AppState.addEventListener("change", (next) =>
      tracking.setActive(next === "active"),
    );
    return () => {
      listener.remove();
      tracking.dispose();
    };
  }, [tracking]);
  useEffect(() => {
    if (state.error?.status === 401) router.replace("/parear");
  }, [state.error, router]);
  return { ...state, refresh: tracking.refresh };
}

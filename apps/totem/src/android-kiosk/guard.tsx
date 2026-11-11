import { requireOptionalNativeModule } from "expo";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  ActivityIndicator,
  AppState,
  BackHandler,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  checkKioskPolicy,
  startManagedKiosk,
  type KioskBridge,
  type KioskStatus,
} from "./policy";

const KioskContext = createContext<{
  status: KioskStatus | null;
  refreshStatus: () => void;
  start: () => void;
} | null>(null);

export function AndroidKioskGuard({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<KioskStatus | null>(null);
  const [checked, setChecked] = useState(false);
  const policy = useRef({ generation: 0, managed: false });
  const update = useCallback(async (start = false) => {
    const check = ++policy.current.generation;
    let current: KioskStatus;
    try {
      const native = requireOptionalNativeModule<KioskBridge>("TotemKiosk");
      current =
        start && native
          ? await startManagedKiosk(native)
          : await checkKioskPolicy(native);
    } catch {
      current = { mode: "native-error" };
    }
    if (check !== policy.current.generation) return;
    if (current.mode === "managed") policy.current.managed = true;
    setStatus(
      policy.current.managed &&
        "managedPermitted" in current &&
        current.mode !== "managed"
        ? { mode: "policy-error" }
        : current,
    );
    setChecked(true);
  }, []);

  const refresh = useCallback(
    (start = false) => {
      setStatus(null);
      void update(start);
    },
    [update],
  );
  useEffect(() => {
    // Registered before the navigator mounts. Commercial screens handle their own back actions first.
    const back = BackHandler.addEventListener("hardwareBackPress", () => true);
    const current = policy.current;
    const appState = AppState.addEventListener("change", (state) => {
      if (state === "active") refresh();
      if (state === "background") {
        current.generation++;
        setStatus(null);
      }
    });
    void update();
    return () => {
      current.generation++;
      back.remove();
      appState.remove();
    };
  }, [refresh, update]);

  const blocked = !status || !("managedPermitted" in status);
  return (
    <KioskContext.Provider
      value={{ status, refreshStatus: refresh, start: () => refresh(true) }}
    >
      <View style={styles.root}>
        {checked && (
          <View
            style={styles.root}
            pointerEvents={blocked ? "none" : "auto"}
            importantForAccessibility={blocked ? "no-hide-descendants" : "auto"}
          >
            {children}
          </View>
        )}
        {blocked && (
          <View
            style={[StyleSheet.absoluteFill, styles.overlay]}
            accessibilityViewIsModal
          >
            {status ? (
              <>
                <Text style={styles.copy}>
                  {status.mode === "unsupported"
                    ? "Atualize o aplicativo deste terminal. Solicite assistência."
                    : status.mode === "policy-error"
                      ? "O modo dedicado precisa ser verificado. Solicite assistência."
                      : "O terminal precisa de assistência para voltar a operar."}
                </Text>
                <Pressable accessibilityRole="button" onPress={() => refresh()}>
                  <Text style={styles.action}>Verificar novamente</Text>
                </Pressable>
              </>
            ) : (
              <>
                <ActivityIndicator color="#773b2e" />
                <Text style={styles.copy}>Verificando o terminal...</Text>
              </>
            )}
          </View>
        )}
      </View>
    </KioskContext.Provider>
  );
}

export function useAndroidKioskRefresh() {
  return useContext(KioskContext)?.refreshStatus;
}

export function AndroidKioskMode({ setup = false }: { setup?: boolean }) {
  const kiosk = useContext(KioskContext);
  const status = kiosk?.status;
  if (!kiosk) return null;
  if (!status || !("managedPermitted" in status)) {
    if (setup) return null;
    return (
      <Text accessibilityLiveRegion="polite" style={styles.copy}>
        {status
          ? "Modo Android indisponível"
          : "Consultando o modo do Android..."}
      </Text>
    );
  }
  const label = {
    ordinary: "Android em modo comum",
    pinned:
      "Aplicativo fixado pelo Android. A fixação pode ser desfeita no aparelho.",
    managed: "Modo dedicado gerenciado ativo",
  }[status.mode];
  return (
    <View>
      <Text style={styles.copy}>{label}</Text>
      {setup && status.mode === "ordinary" && !status.managedPermitted && (
        <Text style={styles.copy}>
          Para fixação temporária, o responsável pode usar a opção de fixar nos
          aplicativos recentes do Android.
        </Text>
      )}
      {setup && status.mode === "ordinary" && status.managedPermitted && (
        <Pressable accessibilityRole="button" onPress={kiosk.start}>
          <Text style={styles.action}>Iniciar modo dedicado</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  overlay: {
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    padding: 28,
    gap: 16,
  },
  copy: { color: "#716861", textAlign: "center", paddingVertical: 8 },
  action: {
    color: "#773b2e",
    textDecorationLine: "underline",
    textAlign: "center",
    padding: 12,
  },
});

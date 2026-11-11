type DetectedMode = "ordinary" | "pinned" | "managed";

export type KioskStatus =
  | { mode: DetectedMode; managedPermitted: boolean }
  | { mode: "unsupported" | "policy-error" | "native-error" };

export type KioskBridge = {
  getStatus(): Promise<unknown>;
  startManaged(): Promise<unknown>;
};

function decode(value: unknown): KioskStatus {
  if (value && typeof value === "object" && "mode" in value) {
    const { mode } = value;
    if (
      mode === "policy-error" ||
      mode === "native-error" ||
      mode === "unsupported"
    )
      return { mode };
    if (
      (mode === "ordinary" || mode === "pinned" || mode === "managed") &&
      "managedPermitted" in value &&
      typeof value.managedPermitted === "boolean"
    ) {
      if (mode === "managed" && !value.managedPermitted)
        return { mode: "policy-error" };
      return { mode, managedPermitted: value.managedPermitted };
    }
  }
  return { mode: "native-error" };
}

export async function checkKioskPolicy(
  native: KioskBridge | null,
): Promise<KioskStatus> {
  if (!native) return { mode: "unsupported" };
  try {
    return decode(await native.getStatus());
  } catch {
    return { mode: "native-error" };
  }
}

export async function startManagedKiosk(
  native: KioskBridge,
): Promise<KioskStatus> {
  const current = await checkKioskPolicy(native);
  if (current.mode === "managed") return current;
  if (!("managedPermitted" in current)) return current;
  if (current.mode !== "ordinary" || !current.managedPermitted)
    return { mode: "policy-error" };
  try {
    let started = decode(await native.startManaged());
    // Android may update Lock Task state just after startLockTask returns.
    for (
      let retry = 0;
      retry < 3 && started.mode === "ordinary" && started.managedPermitted;
      retry++
    ) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      started = await checkKioskPolicy(native);
    }
    return "managedPermitted" in started && started.mode !== "managed"
      ? { mode: "policy-error" }
      : started;
  } catch {
    return { mode: "native-error" };
  }
}

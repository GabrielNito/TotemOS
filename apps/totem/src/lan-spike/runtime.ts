export function isLanSpikeRuntimeEnabled(
  extra: unknown,
  isDevelopment: boolean,
): boolean {
  if (!isDevelopment || typeof extra !== "object" || extra === null) {
    return false;
  }

  return (extra as { lanSpikeEnabled?: unknown }).lanSpikeEnabled === true;
}

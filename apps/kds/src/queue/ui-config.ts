// Faixas exclusivamente visuais de espera, sem compromisso de prazo/SLA.
export const WAIT_UI = { attentionMinutes: 10, longWaitMinutes: 20 } as const;
export function waitColor(minutes: number): string {
  return minutes >= WAIT_UI.longWaitMinutes
    ? "#F29B9B"
    : minutes >= WAIT_UI.attentionMinutes
      ? "#F7CB73"
      : "#7DE2BC";
}

import type { OpenStatus, Order } from "./types";

// Faixas exclusivamente visuais de espera, sem compromisso de prazo/SLA.
export const WAIT_UI = { attentionMinutes: 10, longWaitMinutes: 20 } as const;

export function waitColor(minutes: number): string {
  return minutes >= WAIT_UI.longWaitMinutes
    ? "#DC2626"
    : minutes >= WAIT_UI.attentionMinutes
      ? "#B45309"
      : "#047857";
}

export const STAGE_UI: Record<
  OpenStatus,
  {
    title: string;
    badgeLabel: string;
    color: string;
    badgeBg: string;
    badgeBorder: string;
  }
> = {
  PENDENTE: {
    title: "Pendentes",
    badgeLabel: "Pendente",
    color: "#1D4ED8",
    badgeBg: "#EFF6FF",
    badgeBorder: "#BFDBFE",
  },
  EM_PREPARO: {
    title: "Em preparo",
    badgeLabel: "Em preparo",
    color: "#B45309",
    badgeBg: "#FFFBEB",
    badgeBorder: "#FDE68A",
  },
  PRONTO: {
    title: "Prontos",
    badgeLabel: "Pronto",
    color: "#047857",
    badgeBg: "#ECFDF5",
    badgeBorder: "#A7F3D0",
  },
};

export function sortOrdersByArrival(
  orders: Order[],
  direction: "asc" | "desc",
): Order[] {
  const factor = direction === "asc" ? 1 : -1;
  return [...orders].sort(
    (a, b) =>
      factor *
      (Date.parse(a.createdAt) - Date.parse(b.createdAt) ||
        a.id.localeCompare(b.id)),
  );
}

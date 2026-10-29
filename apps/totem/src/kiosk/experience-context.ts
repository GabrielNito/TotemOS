import { createContext } from "react";
import type { Mode } from "./reference-model";

export const experienceModes = {
  counter: {
    label: "Retirar no balcão",
    detail: "Escolha, pague e retire seu pedido.",
  },
  table: {
    label: "Tablet · mesa 12",
    detail: "Peça na mesa e pague a conta depois.",
  },
  qr: {
    label: "QR Code · mesa 12",
    detail: "Peça pelo celular. O pagamento fica para depois.",
  },
};

export const ExperienceContext = createContext<{
  mode: Mode;
  openContext?: () => void;
  openStandby?: () => void;
  goHome?: () => void;
  brand?: { name: string; tagline: string };
}>({ mode: "counter" });

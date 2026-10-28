export type DeviceType = "TOTEM" | "PAINEL";

export interface DeviceIdentity {
  id: string;
  negocioId: string;
  nome: string;
  tipo: DeviceType;
  pareadoEm: string | null;
  ativo: boolean;
  revogadoEm: string | null;
  createdAt: string;
}

export interface DeviceActivationResponse {
  deviceToken: string;
  dispositivo: DeviceIdentity;
}

export interface DeviceMeResponse {
  dispositivo: DeviceIdentity;
}

import {
  LAN_SPIKE_PROTOCOL,
  LAN_SPIKE_PROTOCOL_VERSION,
  selectKdsService,
  serviceEndpoint,
} from "./discovery";

describe("descoberta mDNS do KDS", () => {
  it("seleciona serviço compatível pelo TXT e endereço resolvido", () => {
    const service = selectKdsService([
      {
        name: "Outro serviço",
        host: "outro.local.",
        port: 80,
        txt: { protocol: "outro", version: "1" },
      },
      {
        name: "TotemOS KDS Spike",
        host: "kds.local.",
        ipv4: ["192.168.0.20"],
        port: 43210,
        txt: {
          protocol: LAN_SPIKE_PROTOCOL,
          version: String(LAN_SPIKE_PROTOCOL_VERSION),
        },
      },
    ]);

    expect(service?.name).toBe("TotemOS KDS Spike");
    expect(serviceEndpoint(service!)).toEqual({
      httpUrl: "http://192.168.0.20:43210",
      websocketUrl: "ws://192.168.0.20:43210/_spike/ws",
    });
  });

  it("não seleciona serviço sem resolução de endereço ou com versão incompatível", () => {
    expect(
      selectKdsService([
        {
          name: "Sem endereço",
          host: "",
          port: 43210,
          txt: { protocol: LAN_SPIKE_PROTOCOL, version: "1" },
        },
        {
          name: "Versão futura",
          host: "kds.local.",
          port: 43210,
          txt: { protocol: LAN_SPIKE_PROTOCOL, version: "99" },
        },
      ]),
    ).toBeNull();
  });
});

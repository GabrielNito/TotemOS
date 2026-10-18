import { isLanSpikeRuntimeEnabled } from "./runtime";

describe("habilitação runtime do spike LAN do Totem", () => {
  it("habilita somente quando o app config marcou o build experimental", () => {
    expect(isLanSpikeRuntimeEnabled({ lanSpikeEnabled: true }, true)).toBe(true);
  });

  it("desabilita quando a flag do app config está ausente ou falsa", () => {
    expect(isLanSpikeRuntimeEnabled({}, true)).toBe(false);
    expect(isLanSpikeRuntimeEnabled({ lanSpikeEnabled: false }, true)).toBe(false);
  });

  it("desabilita o spike fora de development", () => {
    expect(isLanSpikeRuntimeEnabled({ lanSpikeEnabled: true }, false)).toBe(false);
  });
});

import { sanitizePairingCode } from "./pairing-code";

describe("sanitizePairingCode", () => {
  it("mantém apenas os seis primeiros dígitos", () => {
    expect(sanitizePairingCode("12a-345678")).toBe("123456");
  });
});

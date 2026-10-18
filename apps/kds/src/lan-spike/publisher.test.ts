import { createKdsServicePublisher } from "./publisher";

describe("publicação mDNS do KDS", () => {
  it("publica somente metadados do protocolo experimental", async () => {
    const backend = {
      publishService: jest.fn(async () => undefined),
      unpublishService: jest.fn(async () => undefined),
      removeDeviceListeners: jest.fn(),
    };
    const publisher = createKdsServicePublisher(backend);

    await publisher.start(43210);

    expect(backend.publishService).toHaveBeenCalledWith({
      type: "totemos-kds",
      protocol: "tcp",
      domain: "local.",
      name: "TotemOS KDS Spike",
      port: 43210,
      txt: { protocol: "totemos-lan-spike", version: "1" },
    });
  });

  it("despublica e remove listeners exatamente uma vez", async () => {
    const backend = {
      publishService: jest.fn(async () => undefined),
      unpublishService: jest.fn(async () => undefined),
      removeDeviceListeners: jest.fn(),
    };
    const publisher = createKdsServicePublisher(backend);

    await publisher.start(43210);
    await publisher.stop();
    await publisher.stop();

    expect(backend.unpublishService).toHaveBeenCalledWith("TotemOS KDS Spike");
    expect(backend.unpublishService).toHaveBeenCalledTimes(1);
    expect(backend.removeDeviceListeners).toHaveBeenCalledTimes(1);
  });

  it("usa o nome efetivo quando o mDNS resolve um conflito de nome", async () => {
    const backend = {
      publishService: jest.fn(async () => ({ name: "TotemOS KDS Spike (2)" })),
      unpublishService: jest.fn(async () => undefined),
      removeDeviceListeners: jest.fn(),
    };
    const publisher = createKdsServicePublisher(backend);

    await publisher.start(43210);
    await publisher.stop();

    expect(backend.unpublishService).toHaveBeenCalledWith(
      "TotemOS KDS Spike (2)",
    );
  });
});

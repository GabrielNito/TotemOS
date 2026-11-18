import { createPreviewQueueController } from "./preview";

it("carrega pedidos mockados, destaca novo pedido e avança etapas em memória", async () => {
  const controller = createPreviewQueueController();
  try {
    await controller.start();
    expect(controller.state.orders).toHaveLength(3);
    expect(controller.state.newIds).toEqual([]);

    await controller.refresh();
    expect(controller.state.orders).toHaveLength(4);
    expect(controller.state.newIds).toEqual([
      "00000000-0000-4000-8000-000000000103",
    ]);
    const incoming = controller.state.orders.find(
      (o) => o.id === "00000000-0000-4000-8000-000000000103",
    );
    expect(incoming?.senha).toBe(103);

    await controller.act(incoming!);
    expect(
      controller.state.orders.find((o) => o.id === incoming!.id)?.status,
    ).toBe("EM_PREPARO");
  } finally {
    controller.stop();
  }
});

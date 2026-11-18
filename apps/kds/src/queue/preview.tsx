import { useEffect, useState } from "react";
import { QueueController } from "./controller";
import { KitchenBoard } from "./kitchen-board";
import type { Order, PendingOperation } from "./types";

function minutesAgo(minutes: number): string {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

export function createPreviewQueueController(): QueueController {
  const today = new Date().toISOString().slice(0, 10);
  let nextSenha = 102;
  let seq = 0;
  let reads = 0;
  let pendingOps: PendingOperation[] = [];

  const orders: Order[] = [
    {
      id: "00000000-0000-4000-8000-000000000102",
      status: "PENDENTE",
      senha: 102,
      dataOperacional: today,
      versao: 2,
      demo: false,
      demoAmbiente: null,
      createdAt: minutesAgo(12),
      preparoZero: false,
      elegivelCozinha: true,
      autorizacaoOperacional: null,
      itens: [
        {
          nomeProduto: "Bacon Melt",
          quantidade: 2,
          variacaoNome: "Carne 120 g",
          observacao: "Sem cebola caramelizada e molho extra à parte.",
          adicionais: [
            { nomeAdicional: "Bacon extra", quantidade: 1 },
            { nomeAdicional: "Cheddar extra", quantidade: 1 },
          ],
          escolhas: [{ nomeItem: "Pão brioche" }],
        },
      ],
    },
    {
      id: "00000000-0000-4000-8000-000000000101",
      status: "EM_PREPARO",
      senha: 101,
      dataOperacional: today,
      versao: 3,
      demo: true,
      demoAmbiente: "homolog",
      createdAt: minutesAgo(22),
      preparoZero: false,
      elegivelCozinha: true,
      autorizacaoOperacional: { tipo: "DEMO", financeira: false },
      itens: [
        {
          nomeProduto: "Combo Smash Clássico",
          quantidade: 1,
          variacaoNome: "Duplo",
          observacao: null,
          adicionais: [],
          escolhas: [
            { nomeItem: "Batata Rústica" },
            { nomeItem: "Coca-Cola 350 ml" },
          ],
        },
      ],
    },
    {
      id: "00000000-0000-4000-8000-000000000099",
      status: "PRONTO",
      senha: 99,
      dataOperacional: today,
      versao: 4,
      demo: false,
      demoAmbiente: null,
      createdAt: minutesAgo(4),
      preparoZero: true,
      elegivelCozinha: true,
      autorizacaoOperacional: null,
      itens: [
        {
          nomeProduto: "Refrigerante Lata",
          quantidade: 2,
          variacaoNome: "350 ml",
          observacao: "Entregar gelado com dois canudos.",
          adicionais: [],
          escolhas: [{ nomeItem: "Guaraná" }],
        },
      ],
    },
  ];

  const incomingOrder: Order = {
    id: "00000000-0000-4000-8000-000000000103",
    status: "PENDENTE",
    senha: null,
    dataOperacional: null,
    versao: 1,
    demo: false,
    demoAmbiente: null,
    createdAt: minutesAgo(1),
    preparoZero: false,
    elegivelCozinha: true,
    autorizacaoOperacional: null,
    itens: [
      {
        nomeProduto: "Chicken Crispy",
        quantidade: 1,
        variacaoNome: null,
        observacao: "Cortar o lanche ao meio.",
        adicionais: [{ nomeAdicional: "Picles", quantidade: 1 }],
        escolhas: [],
      },
    ],
  };

  return new QueueController(
    {
      list: async () => {
        reads += 1;
        if (reads === 2 && !orders.some((o) => o.id === incomingOrder.id)) {
          orders.unshift(incomingOrder);
        }
        return JSON.parse(
          JSON.stringify(
            orders.filter((o) =>
              ["PENDENTE", "EM_PREPARO", "PRONTO"].includes(o.status),
            ),
          ),
        ) as Order[];
      },
      execute: async (op) => {
        const order = orders.find((o) => o.id === op.orderId);
        if (!order) throw new Error("Pedido mockado não encontrado");
        if (op.kind === "senha" && order.senha === null) {
          order.senha = ++nextSenha;
          order.dataOperacional = today;
          order.versao += 1;
        } else if (op.kind === "status" && op.target) {
          order.status = op.target as Order["status"];
          order.versao += 1;
        }
        return {
          id: order.id,
          status: order.status,
          senha: order.senha,
          dataOperacional: order.dataOperacional,
          versao: order.versao,
          demo: order.demo,
        };
      },
    },
    {
      load: async () => pendingOps,
      save: async (ops) => {
        pendingOps = ops;
      },
    },
    () => `preview-${++seq}`,
    () => undefined,
    60000,
  );
}

export function PreviewPedidos() {
  const [controller] = useState(() => createPreviewQueueController());
  useEffect(() => {
    let active = true;
    void controller.start().then(() => {
      if (active) void controller.refresh();
    });
    return () => {
      active = false;
      controller.stop();
    };
  }, [controller]);
  return (
    <KitchenBoard name="Cozinha Principal (Preview)" controller={controller} />
  );
}

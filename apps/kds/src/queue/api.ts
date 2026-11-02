import { PairingApiError, request } from "../device-pairing/api";
import type { Order, PendingOperation, QueueApi, Summary } from "./types";
import { QueueJournalError } from "./types";
const record = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null;
const nullableString = (v: unknown) => v === null || typeof v === "string";
export function parseSummary(v: unknown): Summary {
  if (
    !record(v) ||
    typeof v.id !== "string" ||
    !/^[0-9a-f-]{36}$/i.test(v.id) ||
    typeof v.status !== "string" ||
    ![
      "AGUARDANDO_PAGAMENTO",
      "PENDENTE",
      "EM_PREPARO",
      "PRONTO",
      "ENTREGUE",
      "CANCELADO",
      "CANCELADO_AGUARDANDO_ESTORNO",
    ].includes(v.status) ||
    !(v.senha === null || (Number.isInteger(v.senha) && Number(v.senha) > 0)) ||
    !nullableString(v.dataOperacional) ||
    !Number.isInteger(v.versao) ||
    Number(v.versao) < 1 ||
    typeof v.demo !== "boolean"
  )
    throw new Error("Resposta inválida do serviço.");
  return v as unknown as Summary;
}
export function parsePage(v: unknown): {
  pedidos: Order[];
  proximoCursor: string | null;
} {
  if (
    !record(v) ||
    !Array.isArray(v.pedidos) ||
    !nullableString(v.proximoCursor)
  )
    throw new Error("Fila inválida.");
  for (const p of v.pedidos) {
    parseSummary(p);
    if (
      !record(p) ||
      !["PENDENTE", "EM_PREPARO", "PRONTO"].includes(String(p.status)) ||
      typeof p.createdAt !== "string" ||
      !Number.isFinite(Date.parse(p.createdAt)) ||
      typeof p.preparoZero !== "boolean" ||
      p.elegivelCozinha !== true ||
      !nullableString(p.demoAmbiente) ||
      !(
        p.autorizacaoOperacional === null ||
        (record(p.autorizacaoOperacional) &&
          p.autorizacaoOperacional.tipo === "DEMO" &&
          p.autorizacaoOperacional.financeira === false)
      ) ||
      !Array.isArray(p.itens)
    )
      throw new Error("Pedido inválido.");
    for (const i of p.itens) {
      if (
        !record(i) ||
        typeof i.nomeProduto !== "string" ||
        typeof i.quantidade !== "number" ||
        !nullableString(i.variacaoNome) ||
        !nullableString(i.observacao) ||
        !Array.isArray(i.adicionais) ||
        !i.adicionais.every(
          (a) =>
            record(a) &&
            typeof a.nomeAdicional === "string" &&
            typeof a.quantidade === "number",
        ) ||
        !Array.isArray(i.escolhas) ||
        !i.escolhas.every((e) => record(e) && typeof e.nomeItem === "string")
      )
        throw new Error("Item inválido.");
    }
  }
  return v as unknown as { pedidos: Order[]; proximoCursor: string | null };
}
export function createQueueApi(token: string): QueueApi {
  const headers = { Authorization: `Bearer ${token}` };
  return {
    async list(signal) {
      const read = async () => {
        let inconsistent = false;
        const orders = new Map<string, Order>();
        const cursors = new Set<string>();
        let cursor: string | null = null;
        for (let page = 0; page < 100; page++) {
          const result = parsePage(
            await request<unknown>(
              `/pedidos/fila?limite=50${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`,
              { headers, signal, method: "GET", cache: "no-store" },
            ),
          );
          for (const order of result.pedidos) {
            const previous = orders.get(order.id);
            if (previous && JSON.stringify(previous) !== JSON.stringify(order))
              inconsistent = true;
            if (!previous || order.versao >= previous.versao)
              orders.set(order.id, order);
          }
          if (result.proximoCursor === null)
            return { orders: [...orders.values()], inconsistent };
          cursor = result.proximoCursor;
          if (cursors.has(cursor)) throw new Error("Paginação repetida.");
          cursors.add(cursor);
        }
        throw new Error("Fila excedeu limite de paginação. Tente atualizar.");
      };
      const first = await read();
      if (!first.inconsistent) return first.orders;
      const second = await read();
      if (
        second.inconsistent ||
        second.orders.some((o) =>
          first.orders.some((p) => p.id === o.id && p.versao > o.versao),
        )
      )
        throw new Error(
          "Fila mudou durante a paginação. Nova leitura necessária.",
        );
      return second.orders;
    },
    async execute(op: PendingOperation, signal) {
      const result = await request<unknown>(
        `/pedidos/${encodeURIComponent(op.orderId)}/${op.kind === "senha" ? "senha" : "status"}`,
        {
          method: op.kind === "senha" ? "POST" : "PATCH",
          headers: { ...headers, "Idempotency-Key": op.key },
          body: JSON.stringify(
            op.kind === "senha"
              ? {}
              : { status: op.target, versaoEsperada: op.version },
          ),
          signal,
        },
      );
      if (
        !record(result) ||
        !record(result.resultadoOperacao) ||
        result.resultadoOperacao.tipo !==
          (op.kind === "senha" ? "ATRIBUICAO_SENHA" : "TRANSICAO") ||
        typeof result.resultadoOperacao.repetida !== "boolean"
      )
        throw new Error("Operação sem confirmação válida.");
      const summary = parseSummary(result.pedido);
      if (op.version !== undefined && summary.versao <= op.version)
        throw new Error("Versão da operação não confirmada.");
      if (
        op.kind === "senha" &&
        (summary.senha === null || !summary.dataOperacional)
      )
        throw new Error("Senha não confirmada.");
      if (summary.id !== op.orderId) throw new Error("Pedido divergente.");
      return summary;
    },
  };
}
export function safeQueueError(error: unknown): string {
  if (error instanceof QueueJournalError)
    return "Diário inválido. Operações preservadas; solicite diagnóstico antes de limpar os dados do aplicativo.";
  const code = error instanceof PairingApiError ? error.statusCode : 0;
  return (
    (
      {
        401: "Sessão expirada. Faça o pareamento novamente.",
        403: "Painel sem permissão para esta operação.",
        404: "Pedido não está mais disponível. A fila será reconsultada.",
        409: "Outro painel pode ter alterado o pedido ou a política DEMO impede a operação. Confira a fila após atualizar e decida novamente.",
        429: "Muitas solicitações. Aguarde a próxima tentativa.",
        503: "Serviço indisponível. Operações pendentes serão recuperadas.",
      } as Record<number, string>
    )[code] ?? "Falha de comunicação. Dados desatualizados; tente atualizar."
  );
}

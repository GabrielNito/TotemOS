import * as SecureStore from "expo-secure-store";
import { normalizeCatalog, type CartLine } from "./model";

const writes = new Map<string, Promise<void>>();
function storageKey(negocioId: string) {
  if (!/^[a-zA-Z0-9_-]+$/.test(negocioId))
    throw new Error("Negócio não identificado.");
  return `totemos.cart.${negocioId}`;
}
function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}
function parseCart(value: unknown): CartLine[] | null {
  if (!Array.isArray(value)) return null;
  const keys = new Set<string>();
  const cart: CartLine[] = [];
  for (const input of value) {
    const line = record(input),
      selection = record(line?.selection),
      originalProduct = record(line?.product);
    if (
      !line ||
      !selection ||
      !originalProduct ||
      typeof line.key !== "string" ||
      !line.key ||
      keys.has(line.key) ||
      typeof line.quantidade !== "number" ||
      !Number.isInteger(line.quantidade) ||
      line.quantidade < 1 ||
      line.quantidade > 99 ||
      typeof line.precoNoMomento !== "number" ||
      !Number.isFinite(line.precoNoMomento) ||
      line.precoNoMomento < 0
    )
      return null;
    const product = normalizeCatalog([
      { id: "snapshot", nome: "Snapshot", produtos: [originalProduct] },
    ])[0]?.produtos[0];
    if (
      !product ||
      product.precoBase < 0 ||
      product.variacoes.some((item) => item.preco < 0) ||
      product.adicionais.some((item) => item.preco < 0)
    )
      return null;
    const variationId = selection.variacaoId;
    if (variationId !== null && typeof variationId !== "string") return null;
    if (
      product.variacoes.length
        ? !product.variacoes.some((item) => item.id === variationId)
        : variationId !== null
    )
      return null;
    const requested = record(selection.adicionais);
    if (!requested) return null;
    const adicionais: Record<string, number> = {};
    for (const [id, quantity] of Object.entries(requested)) {
      const additional = product.adicionais.find((item) => item.id === id);
      if (
        !additional ||
        typeof quantity !== "number" ||
        !Number.isInteger(quantity) ||
        quantity < 0 ||
        quantity > additional.maximo
      )
        return null;
      adicionais[id] = quantity;
    }
    if (originalProduct.ativo === undefined) delete product.ativo;
    if (originalProduct.esgotado === undefined) delete product.esgotado;
    keys.add(line.key);
    cart.push({
      key: line.key,
      product,
      selection: { variacaoId: variationId, adicionais },
      quantidade: line.quantidade,
      precoNoMomento: line.precoNoMomento,
    });
  }
  return cart;
}

export async function loadBusinessCart(negocioId: string): Promise<CartLine[]> {
  const key = storageKey(negocioId);
  await writes.get(key);
  try {
    const stored = record(
      JSON.parse((await SecureStore.getItemAsync(key)) ?? "null"),
    );
    if (stored?.negocioId !== negocioId) return [];
    return parseCart(stored.cart) ?? [];
  } catch {
    return [];
  }
}

export function saveBusinessCart(
  negocioId: string,
  cart: CartLine[],
): Promise<void> {
  const key = storageKey(negocioId);
  const snapshot = JSON.stringify({ negocioId, cart });
  const task = (writes.get(key) ?? Promise.resolve())
    .then(() => SecureStore.setItemAsync(key, snapshot))
    .catch(() => {
      /* Keep the in-memory order usable if persistence fails. */
    })
    .finally(() => {
      if (writes.get(key) === task) writes.delete(key);
    });
  writes.set(key, task);
  return task;
}

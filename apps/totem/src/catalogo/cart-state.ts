import type { CartLine } from "./model";

function signature(line: CartLine) {
  return JSON.stringify([
    line.product.id,
    line.precoNoMomento,
    line.selection.variacaoId,
    Object.entries(line.selection.adicionais)
      .filter(([, count]) => count > 0)
      .sort(([left], [right]) => left.localeCompare(right)),
  ]);
}

export function cartTotal(cart: CartLine[]): number {
  return (
    cart.reduce(
      (sum, line) =>
        sum + Math.round(line.precoNoMomento * 100) * line.quantidade,
      0,
    ) / 100
  );
}

export function changeCartQuantity(
  cart: CartLine[],
  key: string,
  quantity: number,
): CartLine[] {
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) return cart;
  return cart.map((line) =>
    line.key === key ? { ...line, quantidade: quantity } : line,
  );
}

export function saveCartLine(
  cart: CartLine[],
  next: CartLine,
  editingKey?: string,
): CartLine[] {
  const matching = cart.find(
    (line) => line.key !== editingKey && signature(line) === signature(next),
  );
  if (matching)
    return cart
      .filter((line) => line.key !== editingKey)
      .map((line) =>
        line.key === matching.key
          ? {
              ...line,
              quantidade: Math.min(99, line.quantidade + next.quantidade),
            }
          : line,
      );
  if (editingKey)
    return cart.map((line) =>
      line.key === editingKey ? { ...next, key: editingKey } : line,
    );
  return [...cart, next];
}

export type Mode = "counter" | "table" | "qr";
export type Category = "Todos" | "Lanches" | "Combos" | "Porções" | "Bebidas";
export type Product = {
  id: string;
  name: string;
  image: string;
  price: number;
  oldPrice?: number;
  description: string;
  detail: string;
  category: Category;
  ingredients: string[];
  patties?: number;
  combo?: string;
};
export type Configuration = {
  patties: number;
  removed: string[];
  extras: Record<string, number>;
  drink: boolean;
  side: boolean;
};
export type Line = {
  key: string;
  productId: string;
  configuration: Configuration;
  quantity: number;
};
export const products: Product[] = [
  {
    id: "bacon",
    name: "Bacon Melt",
    image: "/products/product-2.png",
    price: 2890,
    oldPrice: 3290,
    description:
      "Carne bovina de 120 g, cheddar, bacon crocante, cebola caramelizada e molho especial no pão brioche.",
    detail: "Carne bovina de 120 g",
    category: "Lanches",
    patties: 1,
    ingredients: ["Cheddar", "Bacon", "Cebola caramelizada", "Molho especial"],
  },
  {
    id: "smash",
    name: "Smash Clássico",
    image: "/products/product-1.png",
    price: 2190,
    description: "Carne bovina de 120 g, queijo e molho especial.",
    detail: "Carne bovina de 120 g",
    category: "Lanches",
    patties: 1,
    ingredients: ["Queijo", "Molho especial"],
  },
  {
    id: "chicken",
    name: "Chicken Crispy",
    image: "/products/product-4.png",
    price: 2790,
    description: "Filé de frango crocante, alface e molho especial.",
    detail: "Filé de frango crocante",
    category: "Lanches",
    ingredients: ["Alface", "Molho especial"],
  },
  {
    id: "double",
    name: "Double Cheddar",
    image: "/products/product-3.png",
    price: 3490,
    description: "Duas carnes de 120 g, cheddar cremoso e molho especial.",
    detail: "Duas carnes de 120 g",
    category: "Lanches",
    patties: 2,
    ingredients: ["Cheddar", "Molho especial"],
  },
  {
    id: "combo-smash",
    name: "Combo Smash",
    image: "/products/product-1.png",
    price: 3590,
    description: "Smash Clássico com batata rústica e Coca-Cola 350 ml.",
    detail: "Lanche + porção + bebida",
    category: "Combos",
    ingredients: ["Queijo", "Molho especial"],
    combo: "Batata rústica + Coca-Cola 350 ml",
  },
  {
    id: "combo-bacon",
    name: "Combo Bacon Melt",
    image: "/products/product-2.png",
    price: 4290,
    oldPrice: 4790,
    description: "Bacon Melt com batata rústica e Coca-Cola 350 ml.",
    detail: "Lanche + porção + bebida",
    category: "Combos",
    ingredients: ["Cheddar", "Bacon", "Cebola caramelizada", "Molho especial"],
    combo: "Batata rústica + Coca-Cola 350 ml",
  },
  {
    id: "combo-chicken",
    name: "Combo Chicken",
    image: "/products/product-4.png",
    price: 3990,
    description: "Chicken Crispy com onion rings e Coca-Cola 350 ml.",
    detail: "Lanche + porção + bebida",
    category: "Combos",
    ingredients: ["Alface", "Molho especial"],
    combo: "Onion rings + Coca-Cola 350 ml",
  },
  {
    id: "potato",
    name: "Batata Rústica",
    image: "/products/product-5.png",
    price: 1290,
    description:
      "Batatas com casca, temperadas e assadas. Acompanhadas de molho da casa.",
    detail: "Porção individual",
    category: "Porções",
    ingredients: [],
  },
  {
    id: "onion",
    name: "Onion Rings",
    image: "/products/product-6.png",
    price: 1390,
    description:
      "Anéis de cebola dourados e crocantes, com molho da casa para acompanhar.",
    detail: "Porção individual",
    category: "Porções",
    ingredients: [],
  },
  {
    id: "coca",
    name: "Coca-Cola",
    image: "/products/featured-6.png",
    price: 700,
    description: "Coca-Cola original. Lata de 350 ml.",
    detail: "Lata de 350 ml",
    category: "Bebidas",
    ingredients: [],
  },
];
export const extras = [
  { id: "bacon", name: "Bacon extra", price: 500 },
  { id: "cheddar", name: "Cheddar extra", price: 450 },
  { id: "egg", name: "Ovo na chapa", price: 390 },
  { id: "onion", name: "Cebola caramelizada", price: 290 },
];
export const money = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const findProduct = (id: string) =>
  products.find((p) => p.id === id) ?? products[0];
export const initialConfiguration = (p: Product): Configuration => ({
  patties: p.patties ?? 0,
  removed: [],
  extras: {},
  drink: false,
  side: false,
});
export function pattyPrice(p: Product, count: number) {
  const additional = Math.max(0, count - (p.patties ?? 0));
  return additional === 2 ? 2090 : additional * 1090;
}
export function unitPrice(p: Product, c: Configuration) {
  return (
    p.price +
    pattyPrice(p, c.patties) +
    extras.reduce((sum, e) => sum + (c.extras[e.id] ?? 0) * e.price, 0) +
    (c.drink ? 700 : 0) +
    (c.side ? 1290 : 0)
  );
}
export function configurationText(p: Product, c: Configuration): string[] {
  return [
    ...(p.patties
      ? [`${c.patties} ${c.patties === 1 ? "carne" : "carnes"} de 120 g`]
      : [p.detail]),
    ...(p.combo ? [p.combo] : []),
    ...c.removed.map((x) => `Sem ${x.toLocaleLowerCase("pt-BR")}`),
    ...extras
      .filter((e) => c.extras[e.id])
      .map((e) => `${e.name} ×${c.extras[e.id]}`),
    ...(c.drink ? ["Coca-Cola 350 ml"] : []),
    ...(c.side ? ["Batata rústica"] : []),
  ];
}
export function signature(line: Pick<Line, "productId" | "configuration">) {
  const c = line.configuration;
  return JSON.stringify([
    line.productId,
    c.patties,
    [...c.removed].sort(),
    extras.map((e) => c.extras[e.id] ?? 0),
    c.drink,
    c.side,
  ]);
}
export function saveLine(cart: Line[], line: Line, editing?: string): Line[] {
  const rest = cart.filter((l) => l.key !== editing);
  const match = rest.find((l) => signature(l) === signature(line));
  if (match)
    return rest.map((l) =>
      l.key === match.key ? { ...l, quantity: l.quantity + line.quantity } : l,
    );
  if (editing) {
    const index = cart.findIndex((l) => l.key === editing);
    rest.splice(Math.max(0, index), 0, line);
    return rest;
  }
  return [...rest, line];
}
export const cartTotal = (cart: Line[]) =>
  cart.reduce(
    (sum, l) =>
      sum + unitPrice(findProduct(l.productId), l.configuration) * l.quantity,
    0,
  );
export const cartSavings = (cart: Line[]) =>
  cart.reduce((sum, l) => {
    const p = findProduct(l.productId);
    return sum + Math.max(0, (p.oldPrice ?? p.price) - p.price) * l.quantity;
  }, 0);
export const itemCount = (cart: Line[]) =>
  cart.reduce((sum, l) => sum + l.quantity, 0);
export function validCart(value: unknown): value is Line[] {
  return (
    Array.isArray(value) &&
    value.every((l) => {
      if (
        !l ||
        typeof l.key !== "string" ||
        !products.some((p) => p.id === l.productId) ||
        !Number.isInteger(l.quantity) ||
        l.quantity < 1 ||
        l.quantity > 99
      )
        return false;
      const p = findProduct(l.productId),
        c = l.configuration;
      return (
        c &&
        Number.isInteger(c.patties) &&
        c.patties >= (p.patties ?? 0) &&
        c.patties <= (p.patties ? 3 : 0) &&
        Array.isArray(c.removed) &&
        c.removed.every(
          (x: unknown) => typeof x === "string" && p.ingredients.includes(x),
        ) &&
        c.extras &&
        typeof c.extras === "object" &&
        Object.entries(c.extras).every(
          ([id, n]) =>
            extras.some((e) => e.id === id) &&
            Number.isInteger(n) &&
            (n as number) >= 0 &&
            (n as number) <= 9,
        ) &&
        typeof c.drink === "boolean" &&
        typeof c.side === "boolean"
      );
    })
  );
}

export type MoneyValue = number | string;

export interface CatalogVariation {
  id: string;
  nome: string;
  preco: number;
  esgotado: boolean;
}

export interface CatalogAdditional {
  id: string;
  nome: string;
  preco: number;
  maximo: number;
  esgotado: boolean;
}

export interface CatalogProduct {
  id: string;
  nome: string;
  descricao: string | null;
  precoBase: number;
  imagemUrl: string | null;
  tempoEstimadoPreparo: number;
  esgotado?: boolean;
  ativo?: boolean;
  variacoes: CatalogVariation[];
  adicionais: CatalogAdditional[];
}

export interface CatalogCategory {
  id: string;
  nome: string;
  produtos: CatalogProduct[];
}

export interface ProductSelection {
  variacaoId: string | null;
  adicionais: Record<string, number>;
}

export interface CartLine {
  key: string;
  product: CatalogProduct;
  selection: ProductSelection;
  quantidade: number;
  precoNoMomento: number;
}

export function createCartLine(
  product: CatalogProduct,
  selection: ProductSelection,
  quantidade: number,
): CartLine {
  const summary = getSelectionSummary(product, selection);
  if (
    !Number.isInteger(quantidade) ||
    quantidade < 1 ||
    quantidade > 99 ||
    (product.variacoes.length > 0 && !summary.variacao)
  ) {
    throw new Error("Selecione uma variação e uma quantidade válida.");
  }
  return {
    key: `${product.id}:${Date.now()}:${Math.random()}`,
    product: {
      ...product,
      variacoes: product.variacoes.map((variation) => ({ ...variation })),
      adicionais: product.adicionais.map((additional) => ({ ...additional })),
    },
    selection: { ...selection, adicionais: { ...selection.adicionais } },
    quantidade,
    precoNoMomento: summary.total,
  };
}

export interface SelectedAdditional {
  id: string;
  nome: string;
  preco: number;
  quantidade: number;
  subtotal: number;
}

export interface ProductSelectionSummary {
  basePrice: number;
  variacao: CatalogVariation | null;
  adicionais: SelectedAdditional[];
  total: number;
}

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`A API retornou ${label} inválido`);
  }

  return value as Record<string, unknown>;
}

function requiredString(
  record: Record<string, unknown>,
  key: string,
  label: string,
): string {
  const value = record[key];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`A API retornou ${label} inválido`);
  }

  return value;
}

function optionalString(
  record: Record<string, unknown>,
  key: string,
): string | null {
  const value = record[key];
  return typeof value === "string" ? value : null;
}

function booleanWithDefault(
  record: Record<string, unknown>,
  key: string,
  defaultValue: boolean,
): boolean {
  const value = record[key];
  return value === undefined ? defaultValue : value === true;
}

function money(value: unknown, label: string): number {
  const parsed =
    typeof value === "number" || typeof value === "string"
      ? Number(value)
      : Number.NaN;

  if (!Number.isFinite(parsed)) {
    throw new Error(`A API retornou ${label} inválido`);
  }

  return parsed;
}

function nonNegativeInteger(
  value: unknown,
  label: string,
  defaultValue: number,
): number {
  if (value === undefined) return defaultValue;

  const parsed = money(value, label);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`A API retornou ${label} inválido`);
  }

  return parsed;
}

function positiveInteger(
  value: unknown,
  label: string,
  defaultValue: number,
): number {
  if (value === undefined) return defaultValue;

  const parsed = money(value, label);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`A API retornou ${label} inválido`);
  }

  return parsed;
}

function arrayOrEmpty(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function normalizeVariation(value: unknown): CatalogVariation {
  const record = asRecord(value, "variação");
  return {
    id: requiredString(record, "id", "ID da variação"),
    nome: requiredString(record, "nome", "nome da variação"),
    preco: money(record.preco, "preço da variação"),
    esgotado: booleanWithDefault(record, "esgotado", false),
  };
}

function normalizeAdditional(value: unknown): CatalogAdditional {
  const record = asRecord(value, "adicional");
  return {
    id: requiredString(record, "id", "ID do adicional"),
    nome: requiredString(record, "nome", "nome do adicional"),
    preco: money(record.preco, "preço do adicional"),
    maximo: positiveInteger(record.maximo, "máximo do adicional", 1),
    esgotado: booleanWithDefault(record, "esgotado", false),
  };
}

function normalizeProduct(value: unknown): CatalogProduct {
  const record = asRecord(value, "produto");
  const variacoes = arrayOrEmpty(record.variacoes)
    .map(normalizeVariation)
    .filter((variacao) => !variacao.esgotado);
  const adicionais = arrayOrEmpty(record.adicionais)
    .map(normalizeAdditional)
    .filter((adicional) => !adicional.esgotado);

  return {
    id: requiredString(record, "id", "ID do produto"),
    nome: requiredString(record, "nome", "nome do produto"),
    descricao: optionalString(record, "descricao"),
    precoBase: money(record.precoBase, "preço base"),
    imagemUrl: optionalString(record, "imagemUrl"),
    tempoEstimadoPreparo: nonNegativeInteger(
      record.tempoEstimadoPreparo,
      "tempo de preparo",
      0,
    ),
    ativo: booleanWithDefault(record, "ativo", true),
    esgotado: booleanWithDefault(record, "esgotado", false),
    variacoes,
    adicionais,
  };
}

function normalizeCategory(value: unknown): CatalogCategory {
  const record = asRecord(value, "categoria");
  return {
    id: requiredString(record, "id", "ID da categoria"),
    nome: requiredString(record, "nome", "nome da categoria"),
    produtos: arrayOrEmpty(record.produtos)
      .map(normalizeProduct)
      .filter((produto) => produto.ativo !== false && !produto.esgotado),
  };
}

export function normalizeCatalog(payload: unknown): CatalogCategory[] {
  if (!Array.isArray(payload)) {
    throw new Error("A API retornou um catálogo inválido");
  }

  return payload
    .filter((value) =>
      booleanWithDefault(asRecord(value, "categoria"), "ativo", true),
    )
    .map(normalizeCategory)
    .filter((categoria) => categoria.produtos.length > 0);
}

export function createInitialSelection(
  _product: CatalogProduct,
): ProductSelection {
  return { variacaoId: null, adicionais: {} };
}

export function selectVariation(
  product: CatalogProduct,
  selection: ProductSelection,
  variacaoId: string | null,
): ProductSelection {
  if (variacaoId === null) {
    return { ...selection, variacaoId: null };
  }

  const variationAvailable = product.variacoes.some(
    (variacao) => variacao.id === variacaoId && !variacao.esgotado,
  );
  return variationAvailable ? { ...selection, variacaoId } : selection;
}

export function updateAdditionalQuantity(
  product: CatalogProduct,
  selection: ProductSelection,
  adicionalId: string,
  delta: number,
): ProductSelection {
  const additional = product.adicionais.find(
    (item) => item.id === adicionalId && !item.esgotado,
  );
  if (!additional) return selection;

  const currentQuantity = selection.adicionais[adicionalId] ?? 0;
  const nextQuantity = Math.min(
    additional.maximo,
    Math.max(0, currentQuantity + delta),
  );
  if (nextQuantity === currentQuantity) return selection;

  const adicionais = { ...selection.adicionais };
  if (nextQuantity === 0) {
    delete adicionais[adicionalId];
  } else {
    adicionais[adicionalId] = nextQuantity;
  }

  return { ...selection, adicionais };
}

function toCents(value: number): number {
  return Math.round(value * 100);
}

function fromCents(value: number): number {
  return value / 100;
}

export function getSelectionSummary(
  product: CatalogProduct,
  selection: ProductSelection,
): ProductSelectionSummary {
  const variacao =
    product.variacoes.find(
      (item) => item.id === selection.variacaoId && !item.esgotado,
    ) ?? null;
  const basePrice = variacao?.preco ?? product.precoBase;
  const adicionais = product.adicionais.reduce<SelectedAdditional[]>(
    (selected, additional) => {
      if (additional.esgotado) return selected;

      const requestedQuantity = selection.adicionais[additional.id] ?? 0;
      const quantidade = Math.min(
        additional.maximo,
        Math.max(0, requestedQuantity),
      );
      if (quantidade === 0) return selected;

      selected.push({
        id: additional.id,
        nome: additional.nome,
        preco: additional.preco,
        quantidade,
        subtotal: fromCents(toCents(additional.preco) * quantidade),
      });
      return selected;
    },
    [],
  );
  const adicionaisTotal = adicionais.reduce(
    (total, additional) => total + toCents(additional.subtotal),
    0,
  );

  return {
    basePrice,
    variacao,
    adicionais,
    total: fromCents(toCents(basePrice) + adicionaisTotal),
  };
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

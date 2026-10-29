import type { MenuItem, MenuSection } from "../kiosk/menu-screen";
import type { CatalogCategory, CatalogProduct } from "./model";

export type BusinessMenuProduct = MenuItem & {
  image: string;
  raw: CatalogProduct;
};

export function resolveProductImage(
  value: string | null,
  apiBaseUrl: string,
): string {
  if (!value?.trim()) return "";
  try {
    const url = new URL(
      value,
      apiBaseUrl.endsWith("/") ? apiBaseUrl : `${apiBaseUrl}/`,
    );
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.href
      : "";
  } catch {
    return "";
  }
}

export function toMenuSections(
  categories: CatalogCategory[],
  apiBaseUrl: string,
): MenuSection<BusinessMenuProduct>[] {
  return categories.map((category) => ({
    id: category.id,
    name: category.nome,
    products: category.produtos.map((product) => ({
      id: product.id,
      name: product.nome,
      description: product.descricao ?? "",
      price: Math.round(product.precoBase * 100),
      image: resolveProductImage(product.imagemUrl, apiBaseUrl),
      raw: product,
    })),
  }));
}

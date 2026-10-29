import { toMenuSections, resolveProductImage } from "./menu-model";
import type { CatalogCategory } from "./model";

test("maps the paired catalog without replacing IDs, categories, prices or descriptions with demo data", () => {
  const categories: CatalogCategory[] = [
    {
      id: "tenant-category",
      nome: "Cafés",
      produtos: [
        {
          id: "tenant-product",
          nome: "Café da casa",
          descricao: "Grãos selecionados",
          precoBase: 8.9,
          imagemUrl: "/media/coffee.png",
          tempoEstimadoPreparo: 2,
          variacoes: [],
          adicionais: [],
        },
      ],
    },
  ];
  const menu = toMenuSections(categories, "https://api.example.com");
  expect(menu[0].id).toBe("tenant-category");
  expect(menu[0].name).toBe("Cafés");
  expect(menu[0].products[0]).toMatchObject({
    id: "tenant-product",
    name: "Café da casa",
    description: "Grãos selecionados",
    price: 890,
    image: "https://api.example.com/media/coffee.png",
  });
  expect(menu[0].products[0].raw).toBe(categories[0].produtos[0]);
  expect(menu[0].products[0].oldPrice).toBeUndefined();
});

test("missing images keep an empty source for the native placeholder", () => {
  expect(resolveProductImage(null, "https://api.example.com")).toBe("");
  expect(
    resolveProductImage(
      "https://cdn.example.com/photo.png",
      "https://api.example.com",
    ),
  ).toBe("https://cdn.example.com/photo.png");
  expect(
    resolveProductImage("media/photo.png", "https://api.example.com/v1/"),
  ).toBe("https://api.example.com/v1/media/photo.png");
});

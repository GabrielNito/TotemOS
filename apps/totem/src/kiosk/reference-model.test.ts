import {
  configurationText,
  findProduct,
  initialConfiguration,
  saveLine,
  unitPrice,
  validCart,
  type Line,
} from "./reference-model";

describe("V2 demonstrative order behavior", () => {
  const product = findProduct("bacon");
  const line = (key: string): Line => ({
    key,
    productId: product.id,
    configuration: initialConfiguration(product),
    quantity: 1,
  });
  it("merges identical configurations and preserves distinct configurations", () => {
    const first = line("first");
    const merged = saveLine([first], line("second"));
    expect(merged).toHaveLength(1);
    expect(merged[0].quantity).toBe(2);
    const removed = line("removed");
    removed.configuration.removed = ["Bacon"];
    expect(saveLine(merged, removed)).toHaveLength(2);
  });
  it("calculates all configured components in cents", () => {
    const configuration = {
      ...initialConfiguration(product),
      patties: 3,
      extras: { bacon: 2 },
      drink: true,
      side: true,
    };
    expect(unitPrice(product, configuration)).toBe(7970);
    expect(configurationText(product, configuration)).toContain(
      "Bacon extra ×2",
    );
  });
  it("rejects restored state with unavailable products or quantities", () => {
    expect(validCart([line("valid")])).toBe(true);
    expect(validCart([{ ...line("bad"), quantity: 0 }])).toBe(false);
    expect(validCart([{ ...line("bad"), productId: "missing" }])).toBe(false);
  });
});

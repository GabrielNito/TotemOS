import { useState, type ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { ArrowRight, Plus, ShoppingBag } from "lucide-react-native";
import { money } from "./reference-model";
import { CategoryRail, type RailCategory } from "./category-rail";
import { Action, BrandHeader, Dock, KioskText as Text, colors } from "./ui";

export type MenuItem = {
  id: string;
  name: string;
  description: string;
  price: number;
  oldPrice?: number;
};
export type MenuSection<T extends MenuItem> = {
  id: string;
  name: string;
  products: T[];
};

export function MenuScreen<T extends MenuItem>({
  category,
  initialScrollOffset,
  onScrollOffsetChange,
  onCategoryChange,
  count,
  total,
  onProduct,
  onCart,
  sections: allSections,
  categories,
  allCategory,
  featuredProductId,
  renderArt,
  description,
  footer,
  footerAccessory,
}: {
  category: string;
  initialScrollOffset: number;
  onScrollOffsetChange: (offset: number) => void;
  onCategoryChange: (category: string) => void;
  count: number;
  total: number;
  onProduct: (product: T) => void;
  onCart: () => void;
  sections: MenuSection<T>[];
  categories: RailCategory[];
  allCategory: string;
  featuredProductId?: string;
  renderArt: (product: T, featured: boolean) => ReactNode;
  description?: (product: T, featured: boolean) => string;
  footer: string;
  footerAccessory?: ReactNode;
}) {
  const [initialOffset] = useState(() => ({ x: 0, y: initialScrollOffset }));
  const sections = allSections.filter(
    (item) => category === allCategory || category === item.id,
  );
  return (
    <View style={s.root}>
      <ScrollView
        contentOffset={initialOffset}
        onScroll={(event) =>
          onScrollOffsetChange(event.nativeEvent.contentOffset.y)
        }
        scrollEventThrottle={16}
        contentContainerStyle={s.scroll}
        stickyHeaderIndices={[2]}
        showsVerticalScrollIndicator={false}
      >
        <BrandHeader />
        <View style={[s.content, s.intro]}>
          <Text style={s.title}>Cardápio</Text>
          <Text style={s.subtitle}>Lanches, combos e acompanhamentos.</Text>
        </View>
        <CategoryRail
          value={category}
          onChange={onCategoryChange}
          items={categories}
        />
        {sections.map((section, sectionIndex) => (
          <View
            key={section.id}
            style={[s.content, sectionIndex > 0 && s.nextSection]}
          >
            <View style={s.sectionHeading}>
              <Text style={s.sectionTitle}>{section.name}</Text>
              <Text style={s.sectionCount}>
                {section.products.length}{" "}
                {section.products.length === 1 ? "opção" : "opções"}
              </Text>
            </View>
            {section.products.map((product, index, items) => {
              const featured = product.id === featuredProductId;
              const discounted =
                !!product.oldPrice && product.oldPrice > product.price;
              return (
                <Pressable
                  key={product.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Personalizar ${product.name}`}
                  onPress={() => onProduct(product)}
                >
                  <View
                    style={[
                      s.card,
                      index === items.length - 1 && s.lastCard,
                      featured && s.featured,
                    ]}
                  >
                    {featured && (
                      <View style={s.promo}>
                        <Text style={s.promoLabel}>
                          {discounted ? "PREÇO ESPECIAL" : "DESTAQUE"}
                        </Text>
                        {discounted && (
                          <View style={s.badge}>
                            <Text style={s.badgeText}>
                              −
                              {Math.round(
                                (1 - product.price / product.oldPrice!) * 100,
                              )}
                              %
                            </Text>
                          </View>
                        )}
                      </View>
                    )}
                    <View
                      style={[
                        s.row,
                        featured && {
                          flexDirection: "row-reverse",
                          gap: 8,
                        },
                      ]}
                    >
                      {renderArt(product, featured)}
                      <View
                        style={[s.copy, featured && { paddingVertical: 8 }]}
                      >
                        <Text style={featured ? s.featuredName : s.name}>
                          {product.name}
                        </Text>
                        <Text
                          style={[
                            s.description,
                            featured && { marginTop: 10, marginBottom: 15 },
                          ]}
                        >
                          {description?.(product, featured) ??
                            product.description}
                        </Text>
                        <View style={s.prices}>
                          <Text style={featured ? s.featuredPrice : s.price}>
                            {money(product.price)}
                          </Text>
                          {product.oldPrice && (
                            <Text style={s.oldPrice}>
                              {money(product.oldPrice)}
                            </Text>
                          )}
                        </View>
                        {featured ? (
                          <View style={s.personalize}>
                            <Text style={s.personalizeLabel}>Personalizar</Text>
                            <ArrowRight size={18} color={colors.action} />
                          </View>
                        ) : (
                          <View style={s.plus}>
                            <Plus size={20} color={colors.action} />
                          </View>
                        )}
                      </View>
                    </View>
                  </View>
                </Pressable>
              );
            })}
          </View>
        ))}
        <View style={[s.footer, { marginHorizontal: 20 }]}>
          <Text style={s.footerText}>{footer}</Text>
          <View>
            {footerAccessory}
            <Text style={[s.footerText, !!footerAccessory && { marginTop: 5 }]}>
              TotemOS
            </Text>
          </View>
        </View>
      </ScrollView>
      <Dock
        value={total}
        description={
          count
            ? `${count} ${count === 1 ? "item no pedido" : "itens no pedido"}`
            : "Seu pedido está vazio"
        }
      >
        <Action disabled={!count} onPress={onCart}>
          <ShoppingBag size={18} color={count ? "#fff" : "#737982"} />
          Ver pedido
        </Action>
      </Dock>
    </View>
  );
}
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#fff" },
  scroll: { paddingBottom: 110 },
  content: { paddingHorizontal: 20 },
  intro: { paddingTop: 22, paddingBottom: 18 },
  title: {
    fontFamily: "BarlowCondensed",
    fontSize: 36,
    lineHeight: 36,
    fontWeight: "600",
    letterSpacing: -0.54,
  },
  subtitle: { fontSize: 13, lineHeight: 19.5, color: "#716861", marginTop: 8 },
  nextSection: { marginTop: 18 },
  lastCard: { borderBottomWidth: 0 },
  sectionHeading: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    paddingTop: 22,
    paddingBottom: 16,
  },
  sectionTitle: { fontSize: 19, fontWeight: "600", letterSpacing: -0.475 },
  sectionCount: { fontSize: 12, color: "#716861" },
  card: {
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#e8e2dc",
  },
  row: { flexDirection: "row", gap: 18, alignItems: "center" },
  copy: { flex: 1, minWidth: 0, paddingVertical: 4 },
  name: {
    fontSize: 17,
    fontWeight: "600",
    lineHeight: 21.25,
    letterSpacing: -0.425,
  },
  description: {
    fontSize: 12,
    lineHeight: 18,
    color: "#716861",
    marginTop: 7,
    marginBottom: 13,
  },
  prices: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "baseline",
    gap: 6,
    paddingRight: 30,
  },
  price: {
    fontSize: 16,
    letterSpacing: -0.32,
    fontWeight: "600",
    lineHeight: 22.4,
    color: "#306b43",
  },
  oldPrice: {
    fontSize: 10,
    lineHeight: 14,
    color: "#716861",
    textDecorationLine: "line-through",
  },
  plus: {
    position: "absolute",
    right: 0,
    bottom: 0,
    width: 32,
    height: 32,
    borderWidth: 1,
    borderColor: "#e8e2dc",
    borderRadius: 5,
    alignItems: "center",
    justifyContent: "center",
  },
  featured: {
    backgroundColor: "#f0e5d4",
    borderBottomWidth: 0,
    borderRadius: 6,
    padding: 20,
    marginBottom: 6,
  },
  promo: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    marginBottom: 14,
  },
  promoLabel: { fontSize: 9, color: "#773b2e", letterSpacing: 0.405 },
  badge: {
    paddingVertical: 5,
    paddingHorizontal: 9,
    backgroundColor: "#773b2e",
    borderRadius: 4,
  },
  badgeText: { fontSize: 14, fontWeight: "600", color: "#fff" },
  featuredName: {
    fontFamily: "BarlowCondensed",
    fontSize: 38,
    lineHeight: 38,
    fontWeight: "700",
    letterSpacing: -0.95,
    textTransform: "uppercase",
  },
  featuredPrice: {
    fontSize: 26,
    letterSpacing: -0.52,
    fontWeight: "600",
    lineHeight: 36.4,
    color: "#306b43",
  },
  personalize: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    minHeight: 32,
    marginTop: 10,
  },
  personalizeLabel: { fontSize: 12, fontWeight: "600", color: "#773b2e" },
  footer: {
    marginTop: 30,
    paddingVertical: 22,
    borderTopWidth: 1,
    borderTopColor: "#e8e2dc",
    gap: 15,
  },
  footerText: { fontSize: 10, color: "#716861" },
});

import { MenuScreen } from "./menu-screen";
import { Alert, Pressable } from "react-native";
import * as Linking from "expo-linking";
import { KioskText } from "./ui";
import { ProductArt } from "./product-art";
import { menuCategories } from "./category-rail";
import { products, type Category, type Product } from "./reference-model";

export function CatalogScreen(props: {
  category: Category;
  initialScrollOffset: number;
  onScrollOffsetChange: (offset: number) => void;
  onCategoryChange: (category: Category) => void;
  count: number;
  total: number;
  onProduct: (product: Product) => void;
  onCart: () => void;
}) {
  return (
    <MenuScreen
      {...props}
      onCategoryChange={(value) => {
        const category = menuCategories.find((item) => item.name === value);
        if (category) props.onCategoryChange(category.name);
      }}
      allCategory="Todos"
      categories={menuCategories.map((item) => ({ ...item, id: item.name }))}
      sections={menuCategories
        .filter((item) => item.name !== "Todos")
        .map((item) => ({
          id: item.name,
          name: item.name,
          products: products.filter(
            (product) => product.category === item.name,
          ),
        }))}
      featuredProductId="bacon"
      renderArt={(product, featured) => (
        <ProductArt
          product={product}
          featured={featured}
          style={
            !featured && {
              alignSelf: "stretch",
              height: undefined,
              minHeight: 120,
            }
          }
        />
      )}
      description={(product, featured) =>
        product.combo ??
        (featured
          ? "Carne de 120 g, cheddar, bacon e cebola caramelizada no pão brioche."
          : product.description)
      }
      footer="Brioche · Cardápio demonstrativo"
      footerAccessory={
        <Pressable
          accessibilityRole="link"
          accessibilityLabel="Comparar com V1, abrir no navegador"
          onPress={() => {
            void Linking.openURL(
              "https://totemos-kiosk-preview.vercel.app/",
            ).catch(() => {
              Alert.alert(
                "Não foi possível abrir a referência",
                "Verifique a conexão e tente novamente.",
              );
            });
          }}
        >
          <KioskText
            style={{
              fontSize: 10,
              lineHeight: 15,
              color: "#716861",
              textDecorationLine: "underline",
              marginLeft: 8,
              paddingVertical: 8,
            }}
          >
            Comparar com V1 ↗
          </KioskText>
        </Pressable>
      }
    />
  );
}

import {
  useCallback,
  useContext,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  Image,
  StyleSheet,
  View,
  Text,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { ProductMotionContext, type ArtProduct } from "./product-motion";

const images = {
  "/products/product-1.png": require("../../assets/products/product-1.png"),
  "/products/product-2.png": require("../../assets/products/product-2.png"),
  "/products/product-3.png": require("../../assets/products/product-3.png"),
  "/products/product-4.png": require("../../assets/products/product-4.png"),
  "/products/product-5.png": require("../../assets/products/product-5.png"),
  "/products/product-6.png": require("../../assets/products/product-6.png"),
  "/products/featured-6.png": require("../../assets/products/featured-6.png"),
};
export function productImage(product: Pick<ArtProduct, "image">) {
  return (
    images[product.image as keyof typeof images] ??
    (product.image ? { uri: product.image } : undefined)
  );
}
export function ProductArt({
  product,
  detail = false,
  featured = false,
  overlay = false,
  style,
}: {
  product: ArtProduct;
  detail?: boolean;
  featured?: boolean;
  overlay?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const failed = failedSource === product.image;
  const image = productImage(product);
  const motion = useContext(ProductMotionContext);
  const node = useRef<View | null>(null);
  const key = `${detail ? "product" : "catalog"}:${product.id}`;
  const register = motion?.register;
  const reportTarget = motion?.reportTarget;
  const transition = motion?.transition;
  const attach = useCallback(
    (view: View | null) => {
      node.current = view;
      if (!overlay)
        register?.(key, view ? { node: view, detail, featured } : null);
    },
    [key, overlay, detail, featured, register],
  );
  useLayoutEffect(() => {
    if (overlay || !transition) return;
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => {
        if (node.current) reportTarget?.(key, node.current, transition.id);
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [overlay, key, reportTarget, transition]);
  const hidden =
    !overlay &&
    transition?.product.id === product.id &&
    (key === `${transition.source}:${product.id}` ||
      key === `${transition.target}:${product.id}`);
  return (
    <View
      ref={attach}
      collapsable={false}
      style={[
        styles.art,
        detail && styles.detail,
        featured && styles.featured,
        !!product.combo && styles.comboBox,
        style,
        hidden && { opacity: 0 },
      ]}
    >
      {image && !failed ? (
        <View
          style={[
            styles.multiply,
            !product.combo && !featured && styles.main,
            !product.combo && !featured && detail && styles.mainDetail,
            !product.combo && featured && styles.featuredMain,
            !!product.combo && styles.comboMain,
            !!product.combo && detail && styles.comboMainDetail,
          ]}
        >
          <Image
            source={image}
            onError={() => setFailedSource(product.image)}
            resizeMode="contain"
            style={styles.image}
          />
        </View>
      ) : (
        <Text
          style={{
            fontFamily: "BarlowCondensed_600SemiBold",
            fontSize: 44,
            color: "#773b2e",
            textAlign: "center",
            margin: "auto",
          }}
          accessibilityLabel={product.name}
        >
          {product.name.slice(0, 1).toLocaleUpperCase("pt-BR")}
        </Text>
      )}
      {product.combo && (
        <>
          <View
            style={[styles.side, styles.multiply, detail && styles.sideDetail]}
          >
            <Image
              source={
                product.id === "combo-chicken"
                  ? images["/products/product-6.png"]
                  : images["/products/product-5.png"]
              }
              resizeMode="contain"
              style={styles.image}
            />
          </View>
          <View
            style={[
              styles.drink,
              styles.multiply,
              detail && styles.drinkDetail,
            ]}
          >
            <Image
              source={images["/products/featured-6.png"]}
              resizeMode="contain"
              style={styles.image}
            />
          </View>
        </>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  art: {
    width: 110,
    height: 120,
    borderRadius: 6,
    backgroundColor: "#f5f2ee",
    padding: 8,
    position: "relative",
    overflow: "hidden",
  },
  detail: { width: 112, height: 150, backgroundColor: "#f0e5d4", padding: 16 },
  featured: {
    flex: 1,
    width: undefined,
    height: 166,
    backgroundColor: "transparent",
    padding: 0,
    overflow: "visible",
  },
  image: { width: "100%", height: "100%" },
  main: { position: "absolute", top: 8, right: 8, bottom: 8, left: 8 },
  mainDetail: { top: 16, right: 16, bottom: 16, left: 16 },
  featuredMain: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: "-10%",
    right: "-10%",
  },
  comboBox: { padding: 0 },
  multiply: { mixBlendMode: "multiply" },
  comboMain: {
    position: "absolute",
    left: 0,
    top: 0,
    width: "78%",
    height: "100%",
    padding: 8,
  },
  comboMainDetail: {
    left: 8,
    top: 8,
    bottom: 8,
    height: undefined,
    width: "67%",
  },
  side: {
    position: "absolute",
    width: "46%",
    height: "50%",
    right: "3%",
    bottom: "1%",
    zIndex: 2,
  },
  sideDetail: { width: "45%", height: "45%", right: "4%", bottom: "5%" },
  drink: {
    position: "absolute",
    width: "18%",
    height: "69%",
    right: "6%",
    top: "7%",
  },
  drinkDetail: { width: "17%", height: "65%", right: "7%", top: "10%" },
});

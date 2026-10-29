import { KioskStandby } from "./standby";
import { s } from "./kiosk-styles";
import { useKioskFonts } from "./use-kiosk-fonts";
import { useCallback, useEffect, useRef, useState } from "react";
import { BackHandler, Platform, StyleSheet, View } from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { CatalogScreen } from "./catalog";
import { ProductScreen } from "./product";
import { CartScreen } from "./cart";
import { CheckoutScreen, type CheckoutIdentity } from "./checkout";
import { OrderNotice } from "./notice";
import { ContextDialog } from "./context-dialog";
import { MotionScene, ProductMotionOverlay } from "./motion";
import { useReducedMotion } from "react-native-reanimated";
import { ProductMotionContext, useProductMotion } from "./product-motion";
import { loadPreviewSession, savePreviewSession } from "./preview-session";
import { productImage } from "./product-art";
import { ExperienceContext } from "./experience-context";
import {
  cartTotal,
  configurationText,
  findProduct,
  itemCount,
  saveLine,
  unitPrice,
  type Line,
  type Product,
  type Mode,
  type Category,
} from "./reference-model";

type Screen =
  | "catalog"
  | "product"
  | "cart"
  | "identification"
  | "payment"
  | "confirmation";

/** Native reproduction of the explicitly simulated V2 preview. The live catalog route stays separate. */
export function KioskPreviewScreen() {
  const insets = useSafeAreaInsets();
  const [fontsLoaded] = useKioskFonts();
  const [screen, setCurrentScreen] = useState<Screen>("catalog");
  const [category, setCategory] = useState<Category>("Todos");
  const [catalogScroll, setCatalogScroll] = useState(0);
  const [cart, setCart] = useState<Line[]>([]);
  const [receipt, setReceipt] = useState<Line[]>([]);
  const [identity, setIdentity] = useState<CheckoutIdentity>({
    name: "",
    cpf: "",
    wantsCpf: false,
  });
  const [product, setProduct] = useState<Product>(findProduct("bacon"));
  const viewport = useRef<View>(null);
  const motion = useProductMotion(screen, viewport, useReducedMotion());
  const { navigate, transition } = motion;
  const setScreen = useCallback(
    (next: Screen) => {
      navigate(next, product, () => setCurrentScreen(next));
    },
    [navigate, product],
  );
  const [editing, setEditing] = useState<Line>();
  const [standby, setStandby] = useState(true);
  const [mode, setMode] = useState<Mode>("counter");
  const [sessionReady, setSessionReady] = useState(false);
  useEffect(() => {
    let mounted = true;
    void loadPreviewSession().then((session) => {
      if (!mounted) return;
      setCart(session.cart);
      setMode(session.mode);
      setSessionReady(true);
    });
    return () => {
      mounted = false;
    };
  }, []);
  useEffect(() => {
    if (sessionReady) void savePreviewSession({ cart, mode });
  }, [cart, mode, sessionReady]);
  const [contextOpen, setContextOpen] = useState(false);
  const [removalDialogOpen, setRemovalDialogOpen] = useState(false);
  const [notice, setNotice] = useState({ message: "", version: 0 });
  const [removed, setRemoved] = useState<Line | null>(null);
  const showNotice = (message: string) =>
    setNotice((current) => ({ message, version: current.version + 1 }));
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resetIdle = useCallback(() => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    if (!standby && !contextOpen && !removalDialogOpen)
      idleTimer.current = setTimeout(() => setStandby(true), 60000);
  }, [standby, contextOpen, removalDialogOpen]);
  useEffect(() => {
    resetIdle();
    return () => {
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };
  }, [resetIdle]);
  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        if (standby) {
          setStandby(false);
          return true;
        }
        if (screen === "catalog") return false;
        setScreen(
          screen === "product"
            ? editing
              ? "cart"
              : "catalog"
            : screen === "cart" || screen === "confirmation"
              ? "catalog"
              : screen === "payment"
                ? "identification"
                : "cart",
        );
        return true;
      },
    );
    return () => subscription.remove();
  }, [screen, editing, standby, setScreen]);
  const openProduct = (next: Product, line?: Line) => {
    setProduct(next);
    setEditing(line);
    navigate("product", next, () => setCurrentScreen("product"));
  };
  const total = cartTotal(cart) / 100;
  const lines = screen === "confirmation" ? receipt : cart;
  const items = lines.map((line) => {
    const p = findProduct(line.productId);
    return {
      key: line.key,
      name: p.name,
      image: productImage(p),
      quantity: line.quantity,
      description: configurationText(p, line.configuration).join(" · "),
      unitPrice: unitPrice(p, line.configuration) / 100,
      originalUnitPrice:
        (unitPrice(p, line.configuration) +
          Math.max(0, (p.oldPrice ?? p.price) - p.price)) /
        100,
      total: (unitPrice(p, line.configuration) * line.quantity) / 100,
    };
  });
  if (!fontsLoaded || !sessionReady) return <View style={s.root} />;
  return (
    <ExperienceContext.Provider
      value={{
        mode,
        openContext: () => setContextOpen(true),
        openStandby: () => setStandby(true),
        goHome: () => {
          setScreen("catalog");
        },
      }}
    >
      <SafeAreaView
        style={[
          s.root,
          contextOpen &&
            Platform.OS === "android" &&
            Number(Platform.Version) >= 31 &&
            s.blurred,
        ]}
        edges={["top", "bottom"]}
        onTouchStart={resetIdle}
      >
        <StatusBar style="dark" />
        <View
          ref={viewport}
          collapsable={false}
          style={s.root}
          accessibilityElementsHidden={standby}
          importantForAccessibility={standby ? "no-hide-descendants" : "auto"}
        >
          <ProductMotionContext.Provider value={motion}>
            {(screen === "catalog" || transition?.source === "catalog") && (
              <MotionScene
                key="catalog"
                style={StyleSheet.absoluteFill}
                active={screen === "catalog"}
                shared={!!transition}
                ready={!!transition?.to}
              >
                <CatalogScreen
                  category={category}
                  initialScrollOffset={catalogScroll}
                  onScrollOffsetChange={setCatalogScroll}
                  onCategoryChange={setCategory}
                  count={itemCount(cart)}
                  total={total}
                  onProduct={openProduct}
                  onCart={() => setScreen("cart")}
                />
              </MotionScene>
            )}
            {(screen === "product" || transition?.source === "product") && (
              <MotionScene
                key="product"
                style={StyleSheet.absoluteFill}
                active={screen === "product"}
                shared={!!transition}
                ready={!!transition?.to}
              >
                <ProductScreen
                  key={product.id}
                  product={product}
                  initialLine={editing}
                  onBack={() => setScreen(editing ? "cart" : "catalog")}
                  onSave={(configuration, quantity) => {
                    const line: Line = {
                      key: editing?.key ?? `${Date.now()}-${Math.random()}`,
                      productId: product.id,
                      configuration,
                      quantity,
                    };
                    setCart((current) => saveLine(current, line, editing?.key));
                    setRemoved(null);
                    showNotice(
                      editing
                        ? "Alterações salvas no pedido."
                        : `${quantity > 1 ? `${quantity} × ` : ""}${product.name} no pedido.`,
                    );
                    setScreen(editing ? "cart" : "catalog");
                    setEditing(undefined);
                  }}
                />
              </MotionScene>
            )}
            {screen !== "catalog" && screen !== "product" && (
              <MotionScene key={screen} style={s.root}>
                {screen === "cart" && (
                  <CartScreen
                    onDialogVisibilityChange={setRemovalDialogOpen}
                    items={items}
                    onBack={() => setScreen("catalog")}
                    onEdit={(key) => {
                      const line = cart.find((item) => item.key === key);
                      if (line) openProduct(findProduct(line.productId), line);
                    }}
                    onQuantity={(key, n) =>
                      setCart((current) =>
                        current.map((line) =>
                          line.key === key ? { ...line, quantity: n } : line,
                        ),
                      )
                    }
                    onRemove={(key) => {
                      const line = cart.find((item) => item.key === key);
                      if (!line) return;
                      setRemoved(line);
                      setCart((current) =>
                        current.filter((item) => item.key !== key),
                      );
                      showNotice(
                        `${findProduct(line.productId).name} removido.`,
                      );
                    }}
                    onCheckout={() => {
                      if (mode === "counter") setScreen("identification");
                      else {
                        setReceipt(cart);
                        setCart([]);
                        setIdentity((current) => ({ ...current, cpf: "" }));
                        setScreen("confirmation");
                      }
                    }}
                  />
                )}
                {(screen === "identification" ||
                  screen === "payment" ||
                  screen === "confirmation") && (
                  <CheckoutScreen
                    identity={identity}
                    onIdentityChange={setIdentity}
                    stage={screen}
                    total={
                      screen === "confirmation"
                        ? cartTotal(receipt) / 100
                        : total
                    }
                    items={items}
                    onEditItem={(key) => {
                      const line = cart.find((item) => item.key === key);
                      if (line) openProduct(findProduct(line.productId), line);
                    }}
                    onBack={() =>
                      setScreen(
                        screen === "payment" ? "identification" : "cart",
                      )
                    }
                    onComplete={() => {
                      if (screen === "identification") {
                        setScreen("payment");
                        return;
                      }
                      setReceipt(cart);
                      setCart([]);
                      setIdentity((current) => ({ ...current, cpf: "" }));
                      setScreen("confirmation");
                    }}
                    onRestart={() => {
                      setReceipt([]);
                      setIdentity({ name: "", cpf: "", wantsCpf: false });
                      setScreen("catalog");
                    }}
                  />
                )}
              </MotionScene>
            )}
            {transition && (
              <ProductMotionOverlay
                key={transition.id}
                transition={transition}
                onComplete={motion.complete}
              />
            )}
          </ProductMotionContext.Provider>
          <OrderNotice
            message={notice.message}
            version={notice.version}
            onClose={() => {
              setNotice((current) => ({ ...current, message: "" }));
              setRemoved(null);
            }}
            actionLabel={removed ? "Desfazer" : "Ver pedido"}
            onAction={() => {
              if (removed) {
                setCart((current) => saveLine(current, removed));
                setRemoved(null);
                showNotice("Item restaurado.");
              } else {
                setNotice((current) => ({ ...current, message: "" }));
                setScreen("cart");
              }
            }}
          />
        </View>
        {standby && (
          <View
            style={[
              StyleSheet.absoluteFill,
              {
                top: insets.top,
                bottom: insets.bottom,
                zIndex: 100,
                elevation: 100,
              },
            ]}
            accessibilityViewIsModal
          >
            <KioskStandby
              continuing={!!cart.length || screen !== "catalog"}
              mode={mode}
              brand={{ name: "brioche", tagline: "HAMBURGUERIA" }}
              hero={productImage(findProduct("bacon"))}
              onContinue={() => setStandby(false)}
            />
          </View>
        )}
        <ContextDialog
          visible={contextOpen}
          mode={mode}
          onClose={() => setContextOpen(false)}
          onStandby={() => {
            setContextOpen(false);
            setStandby(true);
          }}
          onChange={(next) => {
            setMode(next);
            setContextOpen(false);
            if (screen === "identification" || screen === "payment")
              setScreen("cart");
          }}
        />
      </SafeAreaView>
    </ExperienceContext.Provider>
  );
}

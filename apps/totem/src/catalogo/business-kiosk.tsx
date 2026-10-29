import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BackHandler, Platform, StyleSheet, View } from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useReducedMotion } from "react-native-reanimated";
import {
  LayoutGrid,
  Sandwich,
  Layers3,
  CookingPot,
  CupSoda,
} from "lucide-react-native";
import { MenuScreen } from "../kiosk/menu-screen";
import { CartScreen } from "../kiosk/cart";
import { CheckoutScreen, type CheckoutIdentity } from "../kiosk/checkout";
import { MotionScene, ProductMotionOverlay } from "../kiosk/motion";
import {
  ProductMotionContext,
  useProductMotion,
} from "../kiosk/product-motion";
import { ProductArt, productImage } from "../kiosk/product-art";
import { ExperienceContext } from "../kiosk/experience-context";
import { KioskStandby } from "../kiosk/standby";
import { OrderNotice } from "../kiosk/notice";
import { ContextDialog } from "../kiosk/context-dialog";
import { s } from "../kiosk/kiosk-styles";
import { BusinessProductScreen } from "./business-product";
import {
  toMenuSections,
  resolveProductImage,
  type BusinessMenuProduct,
} from "./menu-model";
import { getApiBaseUrl } from "./api";
import {
  createCartLine,
  getSelectionSummary,
  type CartLine,
  type CatalogCategory,
} from "./model";
import { cartTotal, saveCartLine, changeCartQuantity } from "./cart-state";
import { loadBusinessCart, saveBusinessCart } from "./cart-storage";
import { createOrderSubmission } from "./order-api";
import { buildOrderRequest, type PendingOrder } from "./order-submission";
import { OrderStatus } from "./order-status";

type Screen = "catalog" | "product" | "cart" | "identification" | "order";
const allCategory = "__all__";
function categoryIcon(name: string) {
  const value = name.toLocaleLowerCase("pt-BR");
  return value.includes("lanche")
    ? Sandwich
    : value.includes("combo")
      ? Layers3
      : value.includes("porç")
        ? CookingPot
        : value.includes("bebida")
          ? CupSoda
          : LayoutGrid;
}

type BusinessKioskProps = {
  negocioId: string;
  businessName?: string;
  welcome?: string;
  categories: CatalogCategory[];
  identificationMode?: "NOME" | "CODIGO" | "OPCIONAL";
};

export function BusinessKioskScreen(props: BusinessKioskProps) {
  return <BusinessKiosk key={props.negocioId} {...props} />;
}

function BusinessKiosk({
  negocioId,
  businessName = "TotemOS",
  welcome,
  categories,
  identificationMode = "OPCIONAL",
}: BusinessKioskProps) {
  const sections = useMemo(
    () => toMenuSections(categories, getApiBaseUrl()),
    [categories],
  );
  const rails = useMemo(
    () => [
      { id: allCategory, name: "Todos", icon: LayoutGrid },
      ...sections.map((section) => ({
        id: section.id,
        name: section.name,
        icon: categoryIcon(section.name),
      })),
    ],
    [sections],
  );
  const [screen, setCurrentScreen] = useState<Screen>("catalog");
  const [category, setCategory] = useState(allCategory);
  const [scrollOffset, setScrollOffset] = useState(0);
  const [product, setProduct] = useState<BusinessMenuProduct | undefined>(
    sections[0]?.products[0],
  );
  const [editing, setEditing] = useState<CartLine>();
  const [cart, setCart] = useState<CartLine[]>([]);
  const [cartReady, setCartReady] = useState(false);
  const submission = useMemo(
    () => createOrderSubmission(negocioId),
    [negocioId],
  );
  const [orderResult, setOrderResult] = useState<PendingOrder>();
  const [orderBusy, setOrderBusy] = useState(false);
  const orderSending = useRef(false);
  const [orderError, setOrderError] = useState("");
  const [restoreFailed, setRestoreFailed] = useState(false);
  useEffect(() => {
    let mounted = true;
    void Promise.all([loadBusinessCart(negocioId), submission.restore()])
      .then(([stored]) => {
        if (!mounted) return;
        setCart(stored);
        if (submission.attempt) {
          setCurrentScreen("order");
          setOrderResult(submission.attempt.result);
        }
        setCartReady(true);
      })
      .catch(() => {
        if (!mounted) return;
        setRestoreFailed(true);
        setOrderError(
          "Não foi possível recuperar o pedido salvo. Consulte novamente antes de continuar.",
        );
        setCurrentScreen("order");
        setCartReady(true);
      });
    return () => {
      mounted = false;
    };
  }, [negocioId, submission]);
  useEffect(() => {
    if (cartReady && !restoreFailed) void saveBusinessCart(negocioId, cart);
  }, [negocioId, cart, cartReady, restoreFailed]);
  const [identity, setIdentity] = useState<CheckoutIdentity>({
    name: "",
    cpf: "",
    wantsCpf: false,
  });
  const [notice, setNotice] = useState({ message: "", version: 0 });
  const [removed, setRemoved] = useState<CartLine | null>(null);
  const [standby, setStandby] = useState(true);
  const [removalOpen, setRemovalOpen] = useState(false);
  const [contextOpen, setContextOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const viewport = useRef<View>(null);
  const motion = useProductMotion(screen, viewport, useReducedMotion());
  const { transition, navigate } = motion;
  const go = useCallback(
    (next: Screen) => {
      if (
        (submission.attempt || orderBusy || restoreFailed) &&
        next !== "order"
      )
        return;
      if (product) navigate(next, product, () => setCurrentScreen(next));
      else setCurrentScreen(next);
    },
    [navigate, product, submission, orderBusy, restoreFailed],
  );
  const back = useCallback(
    () =>
      go(
        screen === "product"
          ? editing
            ? "cart"
            : "catalog"
          : screen === "cart"
            ? "catalog"
            : "cart",
      ),
    [screen, editing, go],
  );
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resetIdle = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    if (!standby && !removalOpen && !contextOpen)
      timer.current = setTimeout(() => setStandby(true), 60000);
  }, [standby, removalOpen, contextOpen]);
  useEffect(() => {
    resetIdle();
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [resetIdle]);
  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        if (screen === "order") return true;
        if (standby) {
          setStandby(false);
          return true;
        }
        if (screen === "catalog") return false;
        back();
        return true;
      },
    );
    return () => subscription.remove();
  }, [standby, screen, back]);
  const showNotice = (message: string) =>
    setNotice((current) => ({ message, version: current.version + 1 }));
  const sendOrder = async () => {
    if (orderSending.current) return;
    orderSending.current = true;
    setOrderBusy(true);
    setOrderError("");
    setCurrentScreen("order");
    try {
      if (restoreFailed) {
        await submission.restore();
        setCart(await loadBusinessCart(negocioId));
        setRestoreFailed(false);
        if (!submission.attempt) {
          setCurrentScreen("cart");
          return;
        }
      }
      if (!submission.attempt)
        await submission.prepare(
          buildOrderRequest(cart, identity.name, identificationMode),
        );
      setOrderResult(await submission.submit());
    } catch (error) {
      setOrderError(
        error instanceof Error
          ? error.message
          : "Não foi possível confirmar o pedido. Consulte novamente.",
      );
    } finally {
      orderSending.current = false;
      setOrderBusy(false);
    }
  };
  const openProduct = (next: BusinessMenuProduct, line?: CartLine) => {
    setProduct(next);
    setEditing(line);
    navigate("product", next, () => setCurrentScreen("product"));
  };
  const editItem = (key: string) => {
    const line = cart.find((item) => item.key === key);
    if (!line) return;
    const item = toMenuSections(
      [{ id: "snapshot", nome: "", produtos: [line.product] }],
      getApiBaseUrl(),
    )[0].products[0];
    openProduct(item, line);
  };
  const count = cart.reduce((sum, line) => sum + line.quantidade, 0);
  const total = cartTotal(cart);
  const items = cart.map((line) => {
    const summary = getSelectionSummary(line.product, line.selection);
    return {
      key: line.key,
      name: line.product.nome,
      image: productImage({
        image: resolveProductImage(line.product.imagemUrl, getApiBaseUrl()),
      }),
      description: [
        summary.variacao?.nome,
        ...summary.adicionais.map((item) => `${item.nome} ×${item.quantidade}`),
      ]
        .filter(Boolean)
        .join(" · "),
      quantity: line.quantidade,
      unitPrice: line.precoNoMomento,
      total: (Math.round(line.precoNoMomento * 100) * line.quantidade) / 100,
    };
  });
  const brand = { name: businessName, tagline: "CARDÁPIO" };
  if (!cartReady) return <View style={s.root} />;
  return (
    <ExperienceContext.Provider
      value={{
        mode: "counter",
        brand,
        goHome: () => go("catalog"),
        openContext: () => setContextOpen(true),
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
        testID={`business-kiosk-${negocioId}`}
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
                <MenuScreen
                  sections={sections}
                  categories={rails}
                  allCategory={allCategory}
                  category={category}
                  onCategoryChange={setCategory}
                  count={count}
                  total={total}
                  onCart={() => go("cart")}
                  onProduct={openProduct}
                  initialScrollOffset={scrollOffset}
                  onScrollOffsetChange={setScrollOffset}
                  featuredProductId={sections[0]?.products[0]?.id}
                  footer={businessName}
                  renderArt={(item, featured) => (
                    <ProductArt
                      product={item}
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
                />
              </MotionScene>
            )}
            {(screen === "product" || transition?.source === "product") &&
              product && (
                <MotionScene
                  key="product"
                  style={StyleSheet.absoluteFill}
                  active={screen === "product"}
                  shared={!!transition}
                  ready={!!transition?.to}
                >
                  <BusinessProductScreen
                    product={product}
                    initialLine={editing}
                    onBack={back}
                    onSave={(selection, quantity) => {
                      const line = createCartLine(
                        product.raw,
                        selection,
                        quantity,
                      );
                      setCart((current) =>
                        saveCartLine(current, line, editing?.key),
                      );
                      setRemoved(null);
                      showNotice(
                        editing
                          ? "Alterações salvas no pedido."
                          : `${quantity > 1 ? `${quantity} × ` : ""}${product.name} no pedido.`,
                      );
                      go(editing ? "cart" : "catalog");
                      setEditing(undefined);
                    }}
                  />
                </MotionScene>
              )}
            {screen === "cart" && (
              <MotionScene key="cart" style={s.root}>
                <CartScreen
                  items={items}
                  onBack={() => go("catalog")}
                  onDialogVisibilityChange={setRemovalOpen}
                  onQuantity={(key, quantity) =>
                    setCart((current) =>
                      changeCartQuantity(current, key, quantity),
                    )
                  }
                  onEdit={editItem}
                  onRemove={(key) => {
                    const line = cart.find((item) => item.key === key);
                    if (!line) return;
                    setRemoved(line);
                    setCart((current) =>
                      current.filter((item) => item.key !== key),
                    );
                    showNotice(`${line.product.nome} removido.`);
                  }}
                  onCheckout={() => {
                    if (cart.length) go("identification");
                  }}
                />
              </MotionScene>
            )}
            {screen === "identification" && (
              <MotionScene key={screen} style={s.root}>
                <CheckoutScreen
                  simulation={false}
                  onEditItem={editItem}
                  identificationMode={identificationMode}
                  identificationActionLabel="Registrar pedido"
                  stage={screen}
                  total={total}
                  items={items}
                  identity={identity}
                  onIdentityChange={setIdentity}
                  onBack={back}
                  onComplete={() => {
                    void sendOrder();
                  }}
                  onRestart={() => go("catalog")}
                />
              </MotionScene>
            )}
            {screen === "order" && (
              <MotionScene key="order" style={s.root}>
                <OrderStatus
                  result={orderResult}
                  busy={orderBusy}
                  error={orderError}
                  onRetry={() => {
                    void sendOrder();
                  }}
                  onBack={
                    !submission.attempt && !restoreFailed
                      ? () => setCurrentScreen("cart")
                      : undefined
                  }
                />
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
                setCart((current) => saveCartLine(current, removed));
                setRemoved(null);
                showNotice("Item restaurado.");
              } else {
                setNotice((current) => ({ ...current, message: "" }));
                go("cart");
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
              mode="counter"
              brand={brand}
              welcome={welcome}
              hero={
                sections[0]?.products[0]
                  ? productImage(sections[0].products[0])
                  : undefined
              }
              onContinue={() => setStandby(false)}
            />
          </View>
        )}
        <ContextDialog
          visible={contextOpen}
          simulation={false}
          businessName={businessName}
          mode="counter"
          onChange={() => setContextOpen(false)}
          onClose={() => setContextOpen(false)}
          onStandby={() => {
            setContextOpen(false);
            setStandby(true);
          }}
        />
      </SafeAreaView>
    </ExperienceContext.Provider>
  );
}

import { useContext, useEffect, useState } from "react";
import {
  Image,
  type ImageSourcePropType,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import Animated, {
  Easing,
  FadeIn,
  LinearTransition,
  ReduceMotion,
  useReducedMotion,
  withTiming,
  type ExitAnimationsValues,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ArrowLeft,
  Check,
  Pencil,
  Plus,
  ShoppingBag,
  Store,
  Smartphone,
  Utensils,
  Trash2,
} from "lucide-react-native";

import { Action, BrandHeader, colors, Dock, KioskText, Quantity } from "./ui";

import { ExperienceContext, experienceModes } from "./experience-context";

export type CartItem = {
  key: string;
  name: string;
  image?: ImageSourcePropType;
  quantity: number;
  description: string;
  /** Price of one configured item, in reais. */
  unitPrice: number;
  originalUnitPrice?: number;
};

export type CartScreenProps = {
  items: CartItem[];
  onBack: () => void;
  onEdit: (key: string) => void;
  onQuantity: (key: string, n: number) => void;
  onRemove: (key: string) => void;
  onCheckout: () => void;
  onDialogVisibilityChange?: (visible: boolean) => void;
};

const reais = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const rowEase = Easing.bezier(0.22, 1, 0.36, 1);
const rowLayout = LinearTransition.duration(240)
  .easing(rowEase)
  .reduceMotion(ReduceMotion.System);
const rowEnter = FadeIn.duration(240)
  .easing(rowEase)
  .reduceMotion(ReduceMotion.System);
function rowExit(values: ExitAnimationsValues) {
  "worklet";
  const config = { duration: 240, easing: rowEase };
  return {
    initialValues: {
      opacity: 1,
      height: values.currentHeight,
      paddingVertical: 23,
    },
    animations: {
      opacity: withTiming(0, config),
      height: withTiming(0, config),
      paddingVertical: withTiming(0, config),
    },
  };
}

export function CartScreen({
  items,
  onBack,
  onEdit,
  onQuantity,
  onRemove,
  onCheckout,
  onDialogVisibilityChange,
}: CartScreenProps) {
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const [knownItems, setKnownItems] = useState(items);
  const [previousKeys, setPreviousKeys] = useState(
    () => new Set(items.map((item) => item.key)),
  );
  if (items !== knownItems) {
    setPreviousKeys(new Set(knownItems.map((item) => item.key)));
    setKnownItems(items);
  }
  const { mode } = useContext(ExperienceContext);
  const isCounter = mode === "counter";
  const FulfillmentIcon = isCounter
    ? Store
    : mode === "table"
      ? Utensils
      : Smartphone;
  const [removalKey, setRemovalKey] = useState<string | null>(null);
  const pendingRemoval = items.find((item) => item.key === removalKey);
  const removalOpen = !!pendingRemoval;
  useEffect(() => {
    onDialogVisibilityChange?.(removalOpen);
  }, [removalOpen, onDialogVisibilityChange]);
  useEffect(
    () => () => onDialogVisibilityChange?.(false),
    [onDialogVisibilityChange],
  );
  const count = items.reduce((sum, item) => sum + item.quantity, 0);
  const savings = items.reduce(
    (sum, item) =>
      sum +
      Math.max(0, (item.originalUnitPrice ?? item.unitPrice) - item.unitPrice) *
        item.quantity,
    0,
  );
  const total =
    items.reduce(
      (sum, item) => sum + Math.round(item.unitPrice * 100) * item.quantity,
      0,
    ) / 100;

  if (removalKey !== null && !pendingRemoval) setRemovalKey(null);

  function confirmRemoval() {
    if (!pendingRemoval) return;
    const { key } = pendingRemoval;
    setRemovalKey(null);
    onRemove(key);
  }

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: 124 + insets.bottom },
        ]}
      >
        <BrandHeader onHome={onBack} />
        <View style={styles.main}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Voltar ao cardápio"
            onPress={onBack}
          >
            <View style={styles.back}>
              <ArrowLeft size={18} color="#65695d" />
              <KioskText style={styles.backText}>Voltar ao cardápio</KioskText>
            </View>
          </Pressable>
          <View style={styles.intro}>
            <KioskText accessibilityRole="header" style={styles.title}>
              Revise seu pedido
            </KioskText>
            <KioskText style={styles.lead}>
              Confira os itens e as quantidades antes de continuar.
            </KioskText>
          </View>
          {items.length === 0 ? (
            <View style={styles.empty}>
              <ShoppingBag size={44} strokeWidth={1.3} color="#9aab89" />
              <KioskText accessibilityRole="header" style={styles.emptyTitle}>
                Seu pedido está vazio
              </KioskText>
              <KioskText style={styles.emptyCopy}>
                Adicione um item para continuar.
              </KioskText>
              <Action onPress={onBack}>Explorar cardápio</Action>
            </View>
          ) : (
            <View style={styles.layout}>
              <View style={styles.list} collapsable={false}>
                {items.map((item) => (
                  <Animated.View
                    key={item.key}
                    style={styles.row}
                    layout={rowLayout}
                    entering={previousKeys.has(item.key) ? undefined : rowEnter}
                    exiting={
                      !reducedMotion &&
                      items.length > 1 &&
                      removalKey === item.key
                        ? rowExit
                        : undefined
                    }
                  >
                    {item.image ? (
                      <Image
                        source={item.image}
                        resizeMode="contain"
                        style={styles.image}
                        accessibilityLabel={item.name}
                      />
                    ) : (
                      <View
                        style={[
                          styles.image,
                          { alignItems: "center", justifyContent: "center" },
                        ]}
                      >
                        <ShoppingBag size={32} color={colors.muted} />
                      </View>
                    )}
                    <View style={styles.itemInfo}>
                      <KioskText
                        accessibilityRole="header"
                        style={styles.itemTitle}
                      >
                        {item.name}
                      </KioskText>
                      <KioskText style={styles.description}>
                        {item.description}
                      </KioskText>
                      <View style={styles.priceLine}>
                        <KioskText style={styles.price}>
                          {reais.format(item.unitPrice)}
                        </KioskText>
                        {!!item.originalUnitPrice &&
                          item.originalUnitPrice > item.unitPrice && (
                            <KioskText
                              style={{
                                fontSize: 10,
                                color: colors.muted,
                                textDecorationLine: "line-through",
                              }}
                            >
                              {reais.format(item.originalUnitPrice)}
                            </KioskText>
                          )}
                        <KioskText style={styles.perUnit}>
                          por unidade
                        </KioskText>
                      </View>
                      <View style={styles.controls}>
                        <Quantity
                          compact
                          name={item.name}
                          value={item.quantity}
                          onChange={(n: number) => onQuantity(item.key, n)}
                        />
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`Editar ${item.name}`}
                          onPress={() => onEdit(item.key)}
                        >
                          <View style={styles.edit}>
                            <Pencil size={16} color="#5c6455" />
                            <KioskText style={styles.editText}>
                              Editar
                            </KioskText>
                          </View>
                        </Pressable>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`Remover ${item.name}`}
                          onPress={() => setRemovalKey(item.key)}
                        >
                          <View style={styles.remove}>
                            <Trash2 size={18} color="#767b70" />
                          </View>
                        </Pressable>
                      </View>
                    </View>
                  </Animated.View>
                ))}
                <Animated.View layout={rowLayout}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Adicionar mais itens"
                    onPress={onBack}
                  >
                    <View style={styles.addMore}>
                      <Plus size={18} color={colors.action} />
                      <KioskText style={styles.addMoreText}>
                        Adicionar mais itens
                      </KioskText>
                    </View>
                  </Pressable>
                </Animated.View>
              </View>
              <Animated.View style={styles.summary} layout={rowLayout}>
                <KioskText
                  accessibilityRole="header"
                  style={styles.summaryTitle}
                >
                  Resumo
                </KioskText>
                <View
                  style={[styles.receipt, savings === 0 && { marginBottom: 0 }]}
                >
                  <KioskText style={styles.receiptText}>
                    {count} {count === 1 ? "item" : "itens"}
                  </KioskText>
                  <KioskText style={styles.receiptText}>
                    {reais.format(total)}
                  </KioskText>
                </View>
                {savings > 0 && (
                  <View style={styles.savings}>
                    <Check size={15} color={colors.green} />
                    <KioskText style={styles.savingsText}>
                      {reais.format(savings)} de economia neste pedido
                    </KioskText>
                  </View>
                )}
                <View style={styles.total}>
                  <KioskText style={styles.totalLabel}>Total</KioskText>
                  <KioskText style={styles.totalValue}>
                    {reais.format(total)}
                  </KioskText>
                </View>
                <View style={styles.fulfillment}>
                  <FulfillmentIcon size={21} color="#6f785f" />
                  <View style={styles.fulfillmentCopy}>
                    <KioskText style={styles.fulfillmentTitle}>
                      {experienceModes[mode].label}
                    </KioskText>
                    <KioskText style={styles.fulfillmentDetail}>
                      {isCounter
                        ? "Vamos chamar você quando estiver pronto."
                        : "Seu pedido será levado à mesa. Pague depois."}
                    </KioskText>
                  </View>
                </View>
                {!isCounter && (
                  <KioskText style={styles.demoNotice}>
                    Demonstração: nenhum pedido será enviado à cozinha.
                  </KioskText>
                )}
              </Animated.View>
            </View>
          )}
        </View>
      </ScrollView>
      {items.length > 0 && (
        <Dock value={total}>
          <Action onPress={onCheckout}>
            {isCounter ? "Identificar pedido" : "Enviar pedido à mesa 12"}
          </Action>
        </Dock>
      )}
      <Modal
        transparent
        visible={!!pendingRemoval}
        animationType="fade"
        onRequestClose={() => setRemovalKey(null)}
      >
        <View
          style={[
            styles.backdrop,
            { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 },
          ]}
        >
          <ScrollView
            contentContainerStyle={styles.modalScroll}
            bounces={false}
          >
            <View
              style={styles.dialog}
              accessibilityViewIsModal
              onAccessibilityEscape={() => setRemovalKey(null)}
            >
              <View style={styles.removalIcon}>
                <Trash2 size={24} color={colors.action} />
              </View>
              <KioskText accessibilityRole="header" style={styles.dialogTitle}>
                Remover item do pedido?
              </KioskText>
              <KioskText style={styles.dialogCopy}>
                {pendingRemoval?.name} será removido. Você ainda poderá desfazer
                pelo aviso.
              </KioskText>
              <View style={styles.dialogActions}>
                <View style={styles.dialogButtonSlot}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Manter item"
                    onPress={() => setRemovalKey(null)}
                  >
                    <View style={styles.dialogButton}>
                      <KioskText style={styles.dialogButtonText}>
                        Manter item
                      </KioskText>
                    </View>
                  </Pressable>
                </View>
                <View style={styles.dialogButtonSlot}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Remover item"
                    onPress={confirmRemoval}
                  >
                    <View style={[styles.dialogButton, styles.confirmButton]}>
                      <KioskText
                        style={[styles.dialogButtonText, styles.confirmText]}
                      >
                        Remover item
                      </KioskText>
                    </View>
                  </Pressable>
                </View>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  scroll: { paddingBottom: 124 },
  main: { paddingHorizontal: 20 },
  back: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: 44,
    paddingVertical: 8,
    marginVertical: 12,
  },
  backText: { color: "#65695d", fontSize: 12, lineHeight: 18 },
  intro: { paddingTop: 4, paddingBottom: 24 },
  title: {
    fontSize: 32,
    lineHeight: 35.84,
    fontWeight: "600",
    letterSpacing: -1.44,
    marginBottom: 14,
  },
  lead: { fontSize: 13, lineHeight: 19.5, color: colors.muted },
  layout: { gap: 30 },
  list: { borderTopWidth: 1, borderColor: colors.line },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
    paddingVertical: 23,
    borderBottomWidth: 1,
    borderColor: colors.line,
  },
  image: { width: 72, height: 88 },
  itemInfo: { flex: 1, minWidth: 0 },
  itemTitle: {
    fontSize: 17,
    lineHeight: 25.5,
    fontWeight: "600",
    letterSpacing: -0.425,
    marginBottom: 7,
  },
  description: { fontSize: 11, lineHeight: 18.7, color: colors.muted },
  priceLine: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "baseline",
    gap: 7,
    marginTop: 10,
  },
  price: {
    fontSize: 14,
    lineHeight: 19.6,
    fontWeight: "600",
    letterSpacing: -0.28,
    color: colors.green,
  },
  perUnit: { fontSize: 10, lineHeight: 15, color: colors.muted },
  controls: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 14,
  },
  edit: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    padding: 6,
    minHeight: 44,
  },
  editText: { fontSize: 11, lineHeight: 16.5, color: "#5c6455" },
  remove: {
    width: 36,
    height: 44,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  addMore: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    minHeight: 56,
    paddingVertical: 8,
    marginTop: 9,
  },
  addMoreText: { fontSize: 13, lineHeight: 19.5, color: colors.action },
  summary: { padding: 22, backgroundColor: colors.wash, borderRadius: 6 },
  summaryTitle: {
    fontSize: 18,
    lineHeight: 27,
    fontWeight: "600",
    letterSpacing: -0.45,
    marginBottom: 20,
  },
  receipt: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 16,
    marginBottom: 18,
  },
  receiptText: { fontSize: 13, lineHeight: 19.5, color: colors.muted },
  savings: { flexDirection: "row", alignItems: "center", gap: 6 },
  savingsText: { fontSize: 11, lineHeight: 16.5, color: colors.green },
  total: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 16,
    borderTopWidth: 1,
    borderColor: colors.line,
    paddingTop: 20,
    marginTop: 20,
  },
  totalLabel: { fontSize: 13, lineHeight: 19.5 },
  totalValue: {
    fontSize: 25,
    lineHeight: 37.5,
    letterSpacing: -1,
    fontWeight: "600",
  },
  fulfillment: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    borderTopWidth: 1,
    borderColor: colors.line,
    marginTop: 18,
    paddingTop: 18,
  },
  fulfillmentCopy: { flex: 1 },
  fulfillmentTitle: { fontSize: 12, lineHeight: 18, fontWeight: "500" },
  fulfillmentDetail: {
    fontSize: 11,
    lineHeight: 17.6,
    marginTop: 5,
    color: colors.muted,
  },
  demoNotice: {
    fontSize: 11,
    lineHeight: 18.7,
    color: colors.muted,
    marginTop: 22,
  },
  empty: {
    alignItems: "center",
    paddingVertical: 60,
    paddingHorizontal: 20,
    gap: 20,
  },
  emptyTitle: {
    fontSize: 25,
    lineHeight: 37.5,
    fontWeight: "600",
    letterSpacing: -0.625,
    textAlign: "center",
  },
  emptyCopy: {
    fontSize: 15,
    lineHeight: 22.5,
    color: colors.muted,
    textAlign: "center",
  },
  backdrop: { flex: 1, backgroundColor: "#211c1880", paddingHorizontal: 18 },
  modalScroll: { flexGrow: 1, justifyContent: "center", alignItems: "center" },
  dialog: {
    width: "100%",
    maxWidth: 420,
    padding: 24,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 14,
    backgroundColor: colors.paper,
    elevation: 16,
    shadowColor: "#211c18",
    shadowOpacity: 0.24,
    shadowOffset: { width: 0, height: 24 },
    shadowRadius: 35,
  },
  removalIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.softAction,
    marginBottom: 22,
  },
  dialogTitle: {
    fontSize: 23,
    lineHeight: 27.6,
    letterSpacing: -0.575,
    fontWeight: "600",
    marginBottom: 10,
  },
  dialogCopy: { fontSize: 14, lineHeight: 21, color: colors.muted },
  dialogActions: { flexDirection: "row", gap: 10, marginTop: 28 },
  dialogButtonSlot: { flex: 1 },
  dialogButton: {
    flexGrow: 1,
    minHeight: 48,
    padding: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 7,
    backgroundColor: colors.paper,
  },
  dialogButtonText: {
    fontSize: 15,
    lineHeight: 22.5,
    fontWeight: "600",
    textAlign: "center",
  },
  confirmButton: { borderColor: colors.action, backgroundColor: colors.action },
  confirmText: { color: "#fff" },
});

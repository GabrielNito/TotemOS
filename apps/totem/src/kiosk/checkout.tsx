import {
  useContext,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { ExperienceContext } from "./experience-context";
import { MotionSelection, MotionSuccess } from "./motion";
import {
  Keyboard,
  Image,
  type ImageSourcePropType,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import {
  ArrowLeft,
  Check,
  CheckCheck,
  CircleCheck,
  ChevronRight,
  CreditCard,
  QrCode,
  Store,
} from "lucide-react-native";

import { Action, BrandHeader, Dock, KioskText, colors } from "./ui";

export type CheckoutIdentity = { name: string; cpf: string; wantsCpf: boolean };

export type CheckoutScreenProps = {
  identity: CheckoutIdentity;
  onIdentityChange: Dispatch<SetStateAction<CheckoutIdentity>>;
  stage: "identification" | "payment" | "confirmation";
  /** Amounts are in reais, including each item's line total. */
  total: number;
  items: {
    key: string;
    name: string;
    quantity: number;
    description: string;
    total: number;
    originalUnitPrice?: number;
    image?: ImageSourcePropType;
  }[];
  onBack: () => void;
  /** Advances the controlled stage. Payment completion is a simulation only. */
  onComplete: () => void;
  onRestart: () => void;
  onEditItem?: (key: string) => void;
  simulation?: boolean;
  onPayment?: (method: "card" | "pix") => void;
  identificationMode?: "NOME" | "CODIGO" | "OPCIONAL";
  identificationActionLabel?: string;
};

type Payment = "card" | "pix";
type FieldError = { field: "name" | "cpf"; message: string };
type Receipt = Pick<CheckoutScreenProps, "items" | "total">;

const money = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function Steps({
  stage,
  compact,
}: {
  stage: "identification" | "payment";
  compact: boolean;
}) {
  const current = stage === "identification" ? 1 : 2;
  return (
    <View
      style={[styles.steps, compact && styles.stepsCompact]}
      accessibilityLabel="Etapas do pedido"
    >
      {["Pedido", "Seu nome", "Pagamento"].map((label, index) => (
        <View
          key={label}
          style={styles.step}
          accessible
          accessibilityLabel={`${index + 1}. ${label}, ${index < current ? "concluído" : index === current ? "etapa atual" : "próxima etapa"}`}
        >
          {index < 2 && (
            <View
              style={[
                styles.connector,
                index < current && styles.connectorDone,
              ]}
            />
          )}
          <View
            style={[
              styles.stepCircle,
              index < current && styles.stepDone,
              index === current && styles.stepCurrent,
            ]}
          >
            {index < current ? (
              <Check size={16} color="#fff" />
            ) : (
              <KioskText
                style={[styles.stepNumber, index === current && styles.accent]}
              >
                {index + 1}
              </KioskText>
            )}
          </View>
          <KioskText
            style={[styles.stepLabel, index <= current && styles.accent]}
          >
            {label}
          </KioskText>
        </View>
      ))}
    </View>
  );
}

function OrderSummary({
  items,
  total,
  wide,
  onEditItem,
}: Receipt & {
  wide: boolean;
  onEditItem?: (key: string) => void;
}) {
  const count = items.reduce((sum, item) => sum + item.quantity, 0);
  const savings =
    items.reduce(
      (sum, item) =>
        sum +
        Math.max(
          0,
          Math.round((item.originalUnitPrice ?? 0) * 100) * item.quantity -
            Math.round(item.total * 100),
        ),
      0,
    ) / 100;
  return (
    <View
      style={[styles.summary, wide && styles.summaryWide]}
      accessibilityLabel="Resumo do pedido"
    >
      <View style={styles.summaryHeading}>
        <KioskText style={styles.summaryTitle}>Seu pedido</KioskText>
        <KioskText style={styles.help}>
          {count} {count === 1 ? "item" : "itens"}
        </KioskText>
      </View>
      <View style={styles.summaryList}>
        {items.map((item, index) => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Editar ${item.name}`}
            disabled={!onEditItem}
            onPress={() => onEditItem?.(item.key)}
            key={item.key}
          >
            <View
              style={[styles.summaryItem, { paddingTop: index === 0 ? 0 : 14 }]}
            >
              {item.image && (
                <Image
                  source={item.image}
                  resizeMode="contain"
                  style={{ width: 52, height: 58 }}
                />
              )}
              <View style={{ flex: 1, minWidth: 0 }}>
                <KioskText style={styles.itemName}>
                  {item.quantity} × {item.name}
                </KioskText>
                {!!item.description && (
                  <KioskText style={styles.itemDescription} numberOfLines={2}>
                    {item.description}
                  </KioskText>
                )}
                <KioskText style={styles.itemPrice}>
                  {money(item.total)}
                </KioskText>
              </View>
              {onEditItem && <ChevronRight size={16} color={colors.muted} />}
            </View>
          </Pressable>
        ))}
      </View>
      <View style={styles.summaryBottom}>
        {savings > 0 && (
          <View style={styles.savings}>
            <Check size={15} color={colors.green} />
            <KioskText style={styles.savingsText}>
              Você economiza {money(savings)}
            </KioskText>
          </View>
        )}
        <View style={styles.summaryTotal}>
          <KioskText style={styles.label}>Total do pedido</KioskText>
          <KioskText style={styles.total}>{money(total)}</KioskText>
        </View>
      </View>
      {wide && (
        <View style={styles.context}>
          <Store size={15} color={colors.muted} />
          <KioskText style={styles.help}>Retirada no balcão</KioskText>
        </View>
      )}
    </View>
  );
}

export function CheckoutScreen({
  identity,
  onIdentityChange,
  stage,
  total,
  items,
  onBack,
  onComplete,
  onRestart,
  onEditItem,
  simulation = true,
  onPayment,
  identificationMode = "NOME",
  identificationActionLabel = "Escolher pagamento",
}: CheckoutScreenProps) {
  const { mode } = useContext(ExperienceContext);
  const { width } = useWindowDimensions();
  const compact = width <= 700;
  const gutter = width <= 360 ? 16 : compact ? 20 : 44;
  const { name, cpf, wantsCpf } = identity;
  const useCode = !simulation && identificationMode === "CODIGO";
  const nameRequired = simulation || identificationMode === "NOME";
  const setName = (name: string) =>
    onIdentityChange((current) => ({ ...current, name }));
  const setCpf = (cpf: string) =>
    onIdentityChange((current) => ({ ...current, cpf }));
  const setWantsCpf = (wantsCpf: boolean) =>
    onIdentityChange((current) => ({ ...current, wantsCpf }));
  const [payment, setPayment] = useState<Payment | null>(null);
  const [error, setError] = useState<FieldError | null>(null);
  const [focused, setFocused] = useState<"name" | "cpf" | null>(null);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [dockHeight, setDockHeight] = useState(100);
  const nameInput = useRef<TextInput>(null);
  const cpfInput = useRef<TextInput>(null);
  const scroll = useRef<ScrollView>(null);
  const scrollOffset = useRef(0);
  const beforeKeyboard = useRef(0);
  const keyboardOpen = useRef(false);
  const submitted = useRef(false);

  function focusField(field: "name" | "cpf") {
    if (!keyboardOpen.current) beforeKeyboard.current = scrollOffset.current;
    setFocused(field);
  }

  useEffect(() => {
    let frame = 0;
    const show = Keyboard.addListener("keyboardDidShow", () => {
      keyboardOpen.current = true;
    });
    const hide = Keyboard.addListener("keyboardDidHide", () => {
      keyboardOpen.current = false;
      frame = requestAnimationFrame(() => {
        scrollOffset.current = beforeKeyboard.current;
        scroll.current?.scrollTo({
          y: beforeKeyboard.current,
          animated: false,
        });
      });
    });
    return () => {
      show.remove();
      hide.remove();
      cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    submitted.current = false;
    beforeKeyboard.current = 0;
    Keyboard.dismiss();
    scroll.current?.scrollTo({ y: 0, animated: false });
  }, [stage]);

  function identify() {
    if (!items.length || submitted.current) return;
    if (nameRequired && !name.trim()) {
      setError({
        field: "name",
        message: "Conte como podemos chamar você na retirada.",
      });
      nameInput.current?.focus();
      return;
    }
    if (simulation && wantsCpf && cpf.length !== 11) {
      setError({
        field: "cpf",
        message: "Informe os 11 dígitos do CPF ou desmarque essa opção.",
      });
      cpfInput.current?.focus();
      return;
    }
    submitted.current = true;
    setName(useCode ? "" : name.trim());
    setError(null);
    setPayment(null);
    Keyboard.dismiss();
    onComplete();
  }

  function submitPayment() {
    if (!items.length || !payment || submitted.current) return;
    if (!simulation) {
      onPayment?.(payment);
      return;
    }
    submitted.current = true;
    // Keep the displayed snapshot if the parent clears the cart on completion.
    setReceipt({ total, items: items.map((item) => ({ ...item })) });
    setCpf("");
    setWantsCpf(false);
    Keyboard.dismiss();
    onComplete();
  }

  function restart() {
    setName("");
    setCpf("");
    setWantsCpf(false);
    setPayment(null);
    setError(null);
    setReceipt(null);
    submitted.current = false;
    Keyboard.dismiss();
    onRestart();
  }

  const confirmation = stage === "confirmation";
  const displayedReceipt = receipt ?? { items, total };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        ref={scroll}
        onScroll={(event) => {
          scrollOffset.current = event.nativeEvent.contentOffset.y;
        }}
        scrollEventThrottle={16}
        style={[
          styles.scroll,
          !confirmation && !!items.length && { marginBottom: dockHeight },
        ]}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingHorizontal: gutter },
        ]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <View style={{ marginHorizontal: -gutter }}>
          <BrandHeader />
        </View>
        {!confirmation && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Voltar à etapa anterior"
            onPress={() => {
              Keyboard.dismiss();
              onBack();
            }}
          >
            {({ pressed }) => (
              <View style={[styles.back, pressed && styles.pressed]}>
                <ArrowLeft size={18} color="#65695d" />
                <KioskText style={styles.backText}>Voltar</KioskText>
              </View>
            )}
          </Pressable>
        )}

        {confirmation ? (
          <View
            style={[styles.confirmation, compact && styles.confirmationCompact]}
          >
            <MotionSuccess style={styles.successIcon}>
              <CheckCheck size={36} color={colors.green} />
            </MotionSuccess>
            <KioskText style={styles.eyebrow}>
              {simulation ? "SIMULAÇÃO CONCLUÍDA" : "PAGAMENTO CONFIRMADO"}
            </KioskText>
            <KioskText
              accessibilityRole="header"
              style={[
                styles.confirmationTitle,
                compact && styles.confirmationTitleCompact,
              ]}
            >
              {simulation
                ? "Pedido de demonstração concluído"
                : "Pedido confirmado"}
            </KioskText>
            <KioskText style={styles.confirmationCopy}>
              {!simulation
                ? `${name.trim() || "Seu nome"} aparecerá na chamada de retirada.`
                : mode === "counter"
                  ? `${name.trim() || "Seu nome"} aparecerá na chamada de retirada. No restaurante, esta tela confirmaria o pagamento e o envio do pedido.`
                  : "No restaurante, esta tela confirmaria o envio para a mesa 12. O pagamento ficaria para o fechamento da conta."}
            </KioskText>
            {!!displayedReceipt.items.length && (
              <View style={styles.receipt}>
                <View style={styles.receiptHeading}>
                  <KioskText style={styles.receiptLabel}>
                    {mode === "counter" ? "Retirada no balcão" : "Mesa 12"}
                  </KioskText>
                  <KioskText style={styles.receiptTotal}>
                    {money(displayedReceipt.total)}
                  </KioskText>
                </View>
                {displayedReceipt.items.map((item) => (
                  <View style={styles.receiptItem} key={item.key}>
                    <KioskText style={styles.receiptName}>
                      {item.quantity} × {item.name}
                    </KioskText>
                    {!!item.description && (
                      <KioskText style={styles.receiptDescription}>
                        {item.description}
                      </KioskText>
                    )}
                  </View>
                ))}
              </View>
            )}
            {simulation && (
              <KioskText
                style={[styles.confirmationCopy, { marginTop: 22 }]}
                accessibilityLiveRegion="polite"
              >
                Nenhum pedido real foi enviado e nenhum valor foi cobrado.
              </KioskText>
            )}
            <View style={styles.restart}>
              <Action onPress={restart}>
                {mode === "counter"
                  ? "Começar novo pedido"
                  : "Voltar ao cardápio"}
              </Action>
            </View>
          </View>
        ) : !items.length ? (
          <View style={styles.empty}>
            <KioskText accessibilityRole="header" style={styles.title}>
              Vamos escolher seu pedido primeiro?
            </KioskText>
            <KioskText style={styles.lead}>Seu carrinho está vazio.</KioskText>
            <Action onPress={restart}>Ir ao cardápio</Action>
          </View>
        ) : (
          <View style={[styles.layout, compact && styles.layoutCompact]}>
            <View style={styles.formColumn}>
              <Steps stage={stage} compact={compact} />
              <KioskText
                accessibilityRole="header"
                style={[styles.title, !compact && styles.titleWide]}
              >
                {stage === "identification"
                  ? useCode
                    ? "Identificação do pedido"
                    : "Qual é o seu nome?"
                  : "Forma de pagamento"}
              </KioskText>
              <KioskText style={styles.lead}>
                {stage === "identification"
                  ? useCode
                    ? "Seu pedido será identificado por um código na retirada."
                    : nameRequired
                      ? "Vamos chamar seu nome na retirada."
                      : "Podemos chamar seu nome ou um código na retirada."
                  : `Pedido de ${name.trim() || "retirada"} · ${money(total)}`}
              </KioskText>
              {stage === "identification" ? (
                <View style={[styles.form, !compact && styles.formWide]}>
                  {useCode ? (
                    <KioskText style={styles.help}>
                      Vamos gerar um código para chamar seu pedido na retirada.
                    </KioskText>
                  ) : (
                    <View style={styles.field}>
                      <KioskText style={styles.label}>
                        Seu nome ou apelido{!nameRequired ? " (opcional)" : ""}
                      </KioskText>
                      <View
                        style={[
                          styles.inputFrame,
                          focused === "name" && styles.inputFocused,
                        ]}
                      >
                        <TextInput
                          allowFontScaling={false}
                          ref={nameInput}
                          value={name}
                          onChangeText={(value) => {
                            setName(value);
                            setError(null);
                          }}
                          placeholder="Ex.: Gabriel"
                          placeholderTextColor="#94988e"
                          maxLength={40}
                          autoComplete="given-name"
                          autoCapitalize="words"
                          autoCorrect={false}
                          returnKeyType={wantsCpf ? "next" : "done"}
                          submitBehavior="submit"
                          onSubmitEditing={() =>
                            wantsCpf ? cpfInput.current?.focus() : identify()
                          }
                          onFocus={() => focusField("name")}
                          onBlur={() => setFocused(null)}
                          accessibilityLabel="Seu nome ou apelido"
                          accessibilityHint="Informe apenas o primeiro nome ou apelido"
                          aria-invalid={error?.field === "name"}
                          underlineColorAndroid="transparent"
                          selectionColor={colors.action}
                          style={[
                            styles.input,
                            !name && styles.placeholderInput,
                          ]}
                        />
                      </View>
                      <KioskText style={styles.help}>
                        {nameRequired
                          ? "Informe apenas o primeiro nome ou apelido."
                          : "Se preferir, continue sem informar seu nome."}
                      </KioskText>
                    </View>
                  )}
                  {simulation && (
                    <Pressable
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: wantsCpf }}
                      accessibilityLabel="Quero CPF na nota, opcional e demonstrativo"
                      onPress={() => {
                        setWantsCpf(!wantsCpf);
                        setError(null);
                      }}
                    >
                      {({ pressed }) => (
                        <View
                          style={[styles.cpfToggle, pressed && styles.pressed]}
                        >
                          <View
                            style={[
                              styles.checkbox,
                              wantsCpf && styles.checkboxChecked,
                            ]}
                          >
                            {wantsCpf && <Check size={16} color="#fff" />}
                          </View>
                          <View style={styles.cpfLabel}>
                            <KioskText style={styles.label}>
                              Quero CPF na nota
                            </KioskText>
                            <View style={styles.optional}>
                              <KioskText style={styles.optionalText}>
                                Opcional
                              </KioskText>
                            </View>
                          </View>
                        </View>
                      )}
                    </Pressable>
                  )}
                  {simulation && wantsCpf && (
                    <View style={styles.field}>
                      <KioskText style={styles.label}>CPF</KioskText>
                      <View
                        style={[
                          styles.inputFrame,
                          focused === "cpf" && styles.inputFocused,
                        ]}
                      >
                        <TextInput
                          allowFontScaling={false}
                          ref={cpfInput}
                          value={cpf}
                          onChangeText={(value) => {
                            setCpf(value.replace(/\D/g, "").slice(0, 11));
                            setError(null);
                          }}
                          placeholder="11 dígitos"
                          placeholderTextColor="#94988e"
                          inputMode="numeric"
                          keyboardType="number-pad"
                          maxLength={14}
                          autoComplete="off"
                          autoCorrect={false}
                          returnKeyType="done"
                          onSubmitEditing={identify}
                          onFocus={() => focusField("cpf")}
                          onBlur={() => setFocused(null)}
                          accessibilityLabel="CPF, 11 dígitos"
                          aria-invalid={error?.field === "cpf"}
                          underlineColorAndroid="transparent"
                          selectionColor={colors.action}
                          style={[
                            styles.input,
                            !cpf && styles.placeholderInput,
                          ]}
                        />
                      </View>
                      <KioskText style={styles.help}>
                        Campo demonstrativo. Nenhuma nota será emitida.
                      </KioskText>
                    </View>
                  )}
                  {error && (
                    <KioskText
                      accessibilityRole="alert"
                      accessibilityLiveRegion="polite"
                      style={styles.error}
                    >
                      {error.message}
                    </KioskText>
                  )}
                </View>
              ) : (
                <>
                  <View
                    accessibilityRole="radiogroup"
                    accessibilityLabel={
                      simulation
                        ? "Forma de pagamento para simulação"
                        : "Forma de pagamento"
                    }
                    style={styles.paymentOptions}
                  >
                    {(["card", "pix"] as const).map((method) => {
                      const selected = payment === method;
                      const Icon = method === "card" ? CreditCard : QrCode;
                      return (
                        <Pressable
                          key={method}
                          accessibilityRole="radio"
                          accessibilityState={{ checked: selected }}
                          accessibilityLabel={
                            !simulation
                              ? method === "card"
                                ? "Cartão, crédito ou débito na maquininha"
                                : "Pix"
                              : method === "card"
                                ? "Cartão, crédito ou débito na maquininha, simulação"
                                : "Pix, simulação"
                          }
                          onPress={() => setPayment(method)}
                        >
                          {({ pressed }) => (
                            <View
                              style={[
                                styles.paymentOption,
                                !compact && styles.paymentOptionWide,
                                selected && styles.paymentSelected,
                                pressed && styles.pressed,
                              ]}
                            >
                              <View style={styles.paymentIcon}>
                                <Icon
                                  size={28}
                                  strokeWidth={1.5}
                                  color="#737e65"
                                />
                              </View>
                              <View style={styles.paymentCopy}>
                                <KioskText style={styles.paymentTitle}>
                                  {method === "card" ? "Cartão" : "Pix"}
                                </KioskText>
                                <KioskText style={styles.paymentDetail}>
                                  {method === "card"
                                    ? "Crédito ou débito na maquininha"
                                    : "Use o aplicativo do seu banco"}
                                </KioskText>
                              </View>
                              <View
                                style={[
                                  styles.radio,
                                  selected && styles.radioSelected,
                                ]}
                              >
                                {selected && (
                                  <MotionSelection>
                                    <View style={styles.radioDot} />
                                  </MotionSelection>
                                )}
                              </View>
                            </View>
                          )}
                        </Pressable>
                      );
                    })}
                  </View>
                  <View
                    style={styles.explanation}
                    accessibilityLiveRegion="polite"
                  >
                    {payment ? (
                      <CircleCheck size={20} color="#778067" />
                    ) : (
                      <CreditCard size={20} color="#778067" />
                    )}
                    <View style={styles.paymentCopy}>
                      {payment && (
                        <KioskText style={styles.explanationTitle}>
                          {payment === "card"
                            ? "Cartão selecionado"
                            : "Pix selecionado"}
                        </KioskText>
                      )}
                      <KioskText style={styles.explanationCopy}>
                        {!simulation
                          ? !onPayment
                            ? "Pagamento indisponível neste totem. Peça ajuda no balcão. Seu pedido continua salvo."
                            : payment === "card"
                              ? "O valor será enviado para a maquininha."
                              : payment === "pix"
                                ? "Use o QR Code para pagar pelo aplicativo do seu banco."
                                : "Escolha uma forma de pagamento para continuar."
                          : payment === "card"
                            ? "No produto final, o valor será enviado para a maquininha."
                            : payment === "pix"
                              ? "No produto final, você verá o QR Code e a opção Pix Copia e Cola."
                              : "Escolha uma forma de pagamento para continuar."}
                      </KioskText>
                    </View>
                  </View>
                  {simulation && (
                    <KioskText style={styles.notice}>
                      Este é um protótipo. A próxima ação simula a aprovação,
                      sem cobrança e sem envio à cozinha.
                    </KioskText>
                  )}
                </>
              )}
            </View>
            <OrderSummary
              items={items}
              total={total}
              wide={!compact}
              onEditItem={onEditItem}
            />
          </View>
        )}
      </ScrollView>
      {!confirmation && !!items.length && (
        <Dock
          value={total}
          description="Total do pedido"
          onLayout={(event) => setDockHeight(event.nativeEvent.layout.height)}
        >
          <Action
            onPress={stage === "identification" ? identify : submitPayment}
            disabled={
              stage === "payment" && (!payment || (!simulation && !onPayment))
            }
          >
            {stage === "identification"
              ? identificationActionLabel
              : simulation
                ? "Simular pagamento"
                : "Pagar"}
          </Action>
        </Dock>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#fff" },
  scroll: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    width: "100%",
    maxWidth: 1512,
    alignSelf: "center",
    paddingBottom: 32,
  },
  back: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: 44,
    marginVertical: 12,
    alignSelf: "flex-start",
  },
  backText: { fontSize: 12, color: "#65695d" },
  pressed: { opacity: 0.7 },
  layout: {
    width: "100%",
    maxWidth: 1140,
    alignSelf: "center",
    flexDirection: "row",
    gap: 40,
    marginVertical: 20,
    alignItems: "flex-start",
  },
  layoutCompact: { flexDirection: "column", gap: 28, marginTop: 0 },
  formColumn: { flex: 1, width: "100%", minWidth: 0 },
  steps: { flexDirection: "row", marginBottom: 36 },
  stepsCompact: {
    marginHorizontal: -20,
    paddingHorizontal: 20,
    paddingVertical: 18,
    marginBottom: 28,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.line,
  },
  step: { flex: 1, alignItems: "center", gap: 8, minWidth: 0 },
  connector: {
    position: "absolute",
    top: 14,
    left: "50%",
    right: "-50%",
    marginLeft: 24,
    marginRight: 24,
    height: 3,
    backgroundColor: colors.line,
    borderRadius: 3,
  },
  connectorDone: { backgroundColor: colors.action },
  stepCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1.5,
    borderColor: "#b5b2ad",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  stepDone: { borderColor: colors.action, backgroundColor: colors.action },
  stepCurrent: { borderColor: colors.action, backgroundColor: "#faf3f0" },
  stepNumber: { fontSize: 12, fontWeight: "600" },
  stepLabel: {
    fontSize: 12,
    fontWeight: "500",
    color: colors.muted,
    textAlign: "center",
  },
  accent: { color: colors.action },
  title: {
    fontSize: 32,
    lineHeight: 36,
    letterSpacing: -1.4,
    fontWeight: "600",
    color: colors.ink,
  },
  titleWide: { fontSize: 42, lineHeight: 47 },
  lead: { fontSize: 13, lineHeight: 22, color: colors.muted, marginTop: 12 },
  form: { marginTop: 26 },
  formWide: { marginTop: 34 },
  field: { gap: 10 },
  label: { fontSize: 13, fontWeight: "500", color: colors.ink },
  inputFrame: {
    width: "100%",
    height: 58,
    borderWidth: 1,
    borderColor: "#cfd4c7",
    borderRadius: 10,
    paddingHorizontal: 16,
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  input: {
    width: "100%",
    height: 56,
    padding: 0,
    paddingStart: 0,
    paddingEnd: 0,
    fontSize: 16,
    lineHeight: 24,
    includeFontPadding: false,
    color: colors.ink,
    fontFamily: "Inter_400Regular",
  },
  inputFocused: {
    outlineColor: colors.action,
    outlineWidth: 3,
    outlineOffset: 4,
  },
  placeholderInput: { fontSize: 12 },
  help: { fontSize: 11, lineHeight: 17, color: colors.muted },
  cpfToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 56,
    marginTop: 28,
    marginBottom: 16,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderWidth: 1,
    borderColor: "#767676",
    borderRadius: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxChecked: {
    borderColor: colors.action,
    backgroundColor: colors.action,
  },
  cpfLabel: {
    flex: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
  },
  optional: {
    borderWidth: 1,
    borderColor: "#e9d5cb",
    borderRadius: 4,
    paddingVertical: 4,
    paddingHorizontal: 7,
    backgroundColor: "#faf3f0",
  },
  optionalText: {
    fontSize: 10,
    fontWeight: "600",
    color: colors.action,
    letterSpacing: 0.2,
  },
  error: { fontSize: 13, lineHeight: 20, color: "#a22c23", marginTop: 18 },
  paymentOptions: { gap: 12, marginTop: 25 },
  paymentOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 96,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 14,
    backgroundColor: "#fff",
  },
  paymentOptionWide: { minHeight: 100, padding: 20, gap: 18 },
  paymentSelected: { borderColor: "#a36e60", backgroundColor: "#faf3f0" },
  paymentIcon: { width: 32, alignItems: "center" },
  paymentCopy: { flex: 1, minWidth: 0 },
  paymentTitle: { fontSize: 17, fontWeight: "600", color: colors.ink },
  paymentDetail: {
    fontSize: 11,
    lineHeight: 17,
    color: colors.muted,
    marginTop: 5,
  },
  radio: {
    width: 21,
    height: 21,
    borderWidth: 1.5,
    borderColor: "#b8bdb1",
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  radioSelected: { borderColor: colors.action },
  radioDot: {
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: colors.action,
  },
  explanation: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginTop: 20,
    minHeight: 75,
  },
  explanationTitle: {
    fontSize: 12,
    lineHeight: 20,
    fontWeight: "500",
    color: "#525d47",
    marginBottom: 4,
  },
  explanationCopy: { fontSize: 12, lineHeight: 20, color: colors.muted },
  notice: { fontSize: 11, lineHeight: 19, color: colors.muted, marginTop: 22 },
  summary: {
    width: "100%",
    borderTopWidth: 2,
    borderTopColor: colors.ink,
    paddingVertical: 22,
  },
  summaryWide: {
    width: 310,
    borderLeftWidth: 1,
    borderLeftColor: colors.line,
    paddingLeft: 22,
    minHeight: 340,
  },
  summaryHeading: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    paddingBottom: 18,
  },
  summaryTitle: { fontSize: 21, fontWeight: "600", color: colors.ink },
  summaryItem: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    paddingBottom: 14,
  },
  summaryList: { minHeight: 80 },
  summaryBottom: { paddingTop: 18 },
  savings: {
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
    marginBottom: 12,
  },
  savingsText: { fontSize: 11, lineHeight: 16.5, color: colors.green },
  itemName: {
    fontSize: 13,
    lineHeight: 19.5,
    fontWeight: "600",
    color: colors.ink,
  },
  itemDescription: {
    fontSize: 11,
    lineHeight: 16.5,
    color: colors.muted,
    marginTop: 4,
    marginBottom: 6,
  },
  itemPrice: {
    fontSize: 13,
    fontWeight: "500",
    color: colors.ink,
    marginTop: 2,
  },
  summaryTotal: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    alignItems: "baseline",
    gap: 16,
  },
  total: {
    fontSize: 25,
    fontWeight: "600",
    letterSpacing: -1,
    color: colors.ink,
  },
  context: {
    flexDirection: "row",
    gap: 7,
    alignItems: "center",
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  confirmation: {
    width: "100%",
    maxWidth: 600,
    alignSelf: "center",
    alignItems: "center",
    marginTop: 60,
    marginBottom: 30,
  },
  confirmationCompact: { marginTop: 40 },
  successIcon: {
    width: 78,
    height: 78,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 39,
    backgroundColor: "#edf3e7",
    marginBottom: 30,
  },
  eyebrow: {
    color: colors.action,
    fontSize: 10,
    letterSpacing: 1.4,
    fontWeight: "600",
    marginBottom: 12,
    textAlign: "center",
  },
  confirmationTitle: {
    fontSize: 46,
    lineHeight: 52,
    letterSpacing: -1.6,
    fontWeight: "600",
    textAlign: "center",
    color: colors.ink,
  },
  confirmationTitleCompact: { fontSize: 34, lineHeight: 38 },
  confirmationCopy: {
    fontSize: 14,
    lineHeight: 25,
    color: colors.muted,
    textAlign: "center",
    marginTop: 20,
  },
  receipt: {
    width: "100%",
    marginTop: 30,
    borderTopWidth: 2,
    borderTopColor: colors.ink,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    paddingVertical: 22,
  },
  receiptHeading: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 12,
    paddingBottom: 16,
  },
  receiptItem: {
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: 14,
    paddingBottom: 2,
    marginTop: 10,
  },
  receiptName: { fontSize: 14, lineHeight: 21, color: colors.ink },
  receiptLabel: { fontSize: 14, lineHeight: 21, color: colors.ink },
  receiptTotal: {
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "700",
    color: colors.ink,
  },
  receiptDescription: {
    fontSize: 12,
    lineHeight: 18,
    color: colors.muted,
    marginTop: 6,
  },
  center: { textAlign: "center" },
  restart: { marginTop: 28, maxWidth: "100%" },
  empty: { alignItems: "center", gap: 20, paddingVertical: 60 },
});

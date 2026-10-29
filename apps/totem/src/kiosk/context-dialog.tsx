import { Modal, Pressable, StyleSheet, View } from "react-native";
import { Check, Smartphone, Store, Utensils, X } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  ReduceMotion,
} from "react-native-reanimated";
import { experienceModes } from "./experience-context";
import type { Mode } from "./reference-model";
import { colors, KioskText } from "./ui";

const icons = { counter: Store, table: Utensils, qr: Smartphone };
const dialogEntrance = FadeInDown.duration(220)
  .easing(Easing.bezier(0.22, 1, 0.36, 1))
  .withInitialValues({ opacity: 0, transform: [{ translateY: 10 }] })
  .reduceMotion(ReduceMotion.System);
const backdropEntrance = FadeIn.duration(180)
  .easing(Easing.bezier(0.25, 0.1, 0.25, 1))
  .reduceMotion(ReduceMotion.System);

export function ContextDialog({
  visible,
  mode,
  onChange,
  onClose,
  onStandby,
  simulation = true,
  businessName,
}: {
  visible: boolean;
  mode: Mode;
  onChange: (mode: Mode) => void;
  onClose: () => void;
  onStandby: () => void;
  simulation?: boolean;
  businessName?: string;
}) {
  const insets = useSafeAreaInsets();
  const modes: Mode[] = simulation ? ["counter", "table", "qr"] : ["counter"];
  const standbyLabel = simulation
    ? "Ver tela de espera"
    : "Voltar à tela inicial";
  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      onRequestClose={onClose}
    >
      <View
        style={[
          s.backdrop,
          { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 },
        ]}
      >
        <Animated.View
          pointerEvents="none"
          entering={backdropEntrance}
          style={[StyleSheet.absoluteFill, s.shade]}
        />
        <Animated.ScrollView
          entering={dialogEntrance}
          style={s.dialog}
          contentContainerStyle={s.content}
          bounces={false}
        >
          <View style={s.heading}>
            <KioskText accessibilityRole="header" style={s.title}>
              Como você está pedindo?
            </KioskText>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Fechar"
              onPress={onClose}
            >
              <View style={s.close}>
                <X size={21} color={colors.muted} />
              </View>
            </Pressable>
          </View>
          <KioskText style={s.copy}>
            {simulation
              ? "Explore os três contextos desta prévia. Seu carrinho será mantido."
              : "Seu pedido será retirado no balcão. Você pode voltar à tela inicial sem perder seus itens."}
          </KioskText>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={standbyLabel}
            onPress={onStandby}
          >
            <View style={s.standby}>
              <KioskText style={s.standbyLabel}>{standbyLabel}</KioskText>
            </View>
          </Pressable>
          <View
            accessibilityRole="radiogroup"
            accessibilityLabel="Como você está pedindo?"
            style={s.options}
          >
            {modes.map((next) => {
              const Icon = icons[next];
              return (
                <Pressable
                  key={next}
                  accessibilityRole="radio"
                  accessibilityLabel={experienceModes[next].label}
                  accessibilityState={{ checked: mode === next }}
                  onPress={() => onChange(next)}
                >
                  <View style={s.option}>
                    <Icon size={23} color={colors.ink} />
                    <View style={s.optionCopy}>
                      <KioskText style={s.label}>
                        {experienceModes[next].label}
                      </KioskText>
                      <KioskText style={s.detail}>
                        {experienceModes[next].detail}
                      </KioskText>
                    </View>
                    {mode === next && <Check size={19} color={colors.ink} />}
                  </View>
                </Pressable>
              );
            })}
          </View>
          <KioskText style={s.copy}>
            {simulation
              ? "Brioche é uma marca fictícia usada para explorar a identidade do restaurante no TotemOS."
              : businessName
                ? `Atendimento de ${businessName}.`
                : "Seu pedido permanece salvo neste totem."}
          </KioskText>
        </Animated.ScrollView>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingVertical: 20,
  },
  shade: { backgroundColor: "#22291f66" },
  dialog: {
    flexGrow: 0,
    width: "100%",
    maxWidth: 520,
    maxHeight: "100%",
    borderRadius: 22,
    backgroundColor: "#fff",
  },
  content: { padding: 20 },
  heading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  title: {
    flex: 1,
    fontSize: 22,
    lineHeight: 26.4,
    fontWeight: "600",
    letterSpacing: -0.66,
  },
  close: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  copy: {
    fontSize: 13,
    lineHeight: 20.8,
    color: colors.muted,
    marginVertical: 12,
  },
  standby: {
    minHeight: 44,
    paddingVertical: 8,
    marginTop: 4,
    marginBottom: 12,
    justifyContent: "center",
  },
  standbyLabel: {
    fontSize: 15,
    color: colors.action,
    textDecorationLine: "underline",
  },
  options: { gap: 10, marginTop: 24, marginBottom: 12 },
  option: {
    minHeight: 88,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 15,
  },
  optionCopy: { flex: 1 },
  label: { fontSize: 13, fontWeight: "600", lineHeight: 19.5 },
  detail: { fontSize: 11, lineHeight: 16.5, marginTop: 4, color: colors.muted },
});

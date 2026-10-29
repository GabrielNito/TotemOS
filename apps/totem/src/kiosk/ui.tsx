import {
  Children,
  useContext,
  cloneElement,
  isValidElement,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Store, Utensils, Smartphone } from "lucide-react-native";
import { ExperienceContext, experienceModes } from "./experience-context";
import { MotionPress, MotionValue } from "./motion";
import { SectionRevealContext } from "./section-reveal";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type PressableProps,
  type TextProps,
  type ViewProps,
} from "react-native";
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

export const colors = {
  ink: "#2d2622",
  muted: "#716861",
  line: "#e8e2dc",
  paper: "#ffffff",
  wash: "#f7f5f2",
  green: "#306b43",
  action: "#773b2e",
  accent: "#773b2e",
  softAction: "#faf3f0",
  disabled: "#e6e9ee",
  disabledText: "#737982",
  disabledControl: "#bdc0b8",
  chevron: "#808577",
} as const;

export type KioskTextProps = TextProps & { menu?: boolean };

/** Host loads Inter 400/500/600/700 and BarlowCondensed 600/700 with expo-font. */
export function KioskText({ menu = false, style, ...props }: KioskTextProps) {
  const flat = StyleSheet.flatten(style);
  const weight =
    flat?.fontWeight === "bold" ? 700 : Number(flat?.fontWeight ?? 400);
  const isMenu = menu || flat?.fontFamily?.startsWith("BarlowCondensed");
  const fontFamily = isMenu
    ? weight >= 700
      ? "BarlowCondensed_700Bold"
      : "BarlowCondensed_600SemiBold"
    : weight >= 700
      ? "Inter_700Bold"
      : weight >= 600
        ? "Inter_600SemiBold"
        : weight >= 500
          ? "Inter_500Medium"
          : "Inter_400Regular";
  const fontSize = flat?.fontSize ?? 15;
  return (
    <Text
      allowFontScaling={false}
      textBreakStrategy="simple"
      {...props}
      style={[
        styles.text,
        style,
        {
          fontFamily,
          fontSize,
          fontWeight: "normal",
          includeFontPadding: false,
          lineHeight: flat?.lineHeight ?? (isMenu ? fontSize : fontSize * 1.5),
        },
      ]}
    />
  );
}

export interface ActionProps {
  children: ReactNode;
  onPress?: PressableProps["onPress"];
  disabled?: boolean;
  /** Mobile dock geometry: 52dp minimum, 12sp label. */
  compact?: boolean;
  accessibilityLabel?: string;
  testID?: string;
}

export function Action({
  children,
  onPress,
  disabled = false,
  compact = false,
  accessibilityLabel,
  testID,
}: ActionProps) {
  const color = disabled ? colors.disabledText : colors.paper;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      disabled={disabled}
      testID={testID}
      onPress={(event) => {
        if (!disabled) onPress?.(event);
      }}
    >
      {({ pressed }) => (
        <MotionPress
          pressed={pressed && !disabled}
          style={[
            styles.action,
            compact && styles.actionCompact,
            disabled && styles.actionDisabled,
          ]}
        >
          {Children.map(children, (child) =>
            typeof child === "string" || typeof child === "number" ? (
              <KioskText
                style={[
                  styles.actionLabel,
                  compact && styles.actionLabelCompact,
                  { color },
                ]}
              >
                {child}
              </KioskText>
            ) : (
              child
            ),
          )}
          <View
            accessible={false}
            importantForAccessibility="no"
            style={styles.arrow}
          >
            <View style={[styles.arrowLine, { backgroundColor: color }]} />
            <View style={[styles.arrowTip, { borderColor: color }]} />
          </View>
        </MotionPress>
      )}
    </Pressable>
  );
}

export interface QuantityProps {
  value: number;
  onChange: (value: number) => void;
  name: string;
  min?: number;
  max?: number;
  disabled?: boolean;
  /** Cart geometry: 36dp buttons and a 22dp minimum counter. */
  compact?: boolean;
  /** Set automatically by Dock for its 52dp control row. */
  dock?: boolean;
}

export function Quantity({
  value,
  onChange,
  name,
  min = 1,
  max = 99,
  disabled = false,
  compact = false,
  dock = false,
}: QuantityProps) {
  return (
    <View
      accessibilityLabel={`Quantidade de ${name}`}
      style={[styles.quantity, dock && styles.quantityDock]}
    >
      {quantityButton(-1)}
      <MotionValue value={value}>
        <KioskText
          accessibilityLiveRegion="polite"
          style={[
            styles.quantityValue,
            compact && !dock && styles.quantityValueCompact,
          ]}
        >
          {value}
        </KioskText>
      </MotionValue>
      {quantityButton(1)}
    </View>
  );

  function quantityButton(delta: number) {
    const blocked = disabled || (delta < 0 ? value <= min : value >= max);
    const color = blocked ? colors.disabledControl : colors.action;
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: blocked }}
        disabled={blocked}
        accessibilityLabel={`${delta < 0 ? "Diminuir" : "Aumentar"} ${name}`}
        onPress={() => {
          if (!blocked) onChange(Math.max(min, Math.min(max, value + delta)));
        }}
      >
        {({ pressed }) => (
          <MotionPress
            pressed={pressed && !blocked}
            style={[
              styles.quantityButton,
              compact && !dock && styles.quantityButtonCompact,
              dock && styles.quantityButtonDock,
            ]}
          >
            <View
              accessible={false}
              importantForAccessibility="no"
              style={styles.quantityMark}
            >
              <View
                style={[styles.markHorizontal, { backgroundColor: color }]}
              />
              {delta > 0 && (
                <View
                  style={[styles.markVertical, { backgroundColor: color }]}
                />
              )}
            </View>
          </MotionPress>
        )}
      </Pressable>
    );
  }
}

export interface BrandHeaderProps {
  onContext?: () => void;
  onHome?: () => void;
  context?: string;
  brand?: string;
  tagline?: string;
}

export function BrandHeader({
  onContext,
  onHome,
  context,
  brand: suppliedBrand,
  tagline: suppliedTagline,
}: BrandHeaderProps) {
  const experience = useContext(ExperienceContext);
  const brand = suppliedBrand ?? experience.brand?.name ?? "brioche";
  const tagline =
    suppliedTagline ?? experience.brand?.tagline ?? "HAMBURGUERIA";
  const handleHome = onHome ?? experience.goHome;
  const label = context ?? experienceModes[experience.mode].label;
  const handleContext = onContext ?? experience.openContext;
  const ContextIcon =
    experience.mode === "counter"
      ? Store
      : experience.mode === "table"
        ? Utensils
        : Smartphone;
  const wordmark = (
    <View style={styles.brand}>
      <KioskText
        menu
        style={styles.brandName}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.5}
      >
        {brand}
      </KioskText>
      <KioskText style={styles.tagline}>{tagline}</KioskText>
    </View>
  );
  return (
    <View testID="brand-header" style={styles.header}>
      <View style={styles.brandSlot}>
        {handleHome ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${brand}, início do cardápio`}
            onPress={handleHome}
          >
            {wordmark}
          </Pressable>
        ) : (
          wordmark
        )}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        disabled={!handleContext}
        onPress={handleContext}
      >
        {({ pressed }) => (
          <View style={[styles.context, pressed && styles.pressed]}>
            <ContextIcon size={15} color={colors.ink} strokeWidth={1.7} />
            <KioskText numberOfLines={1} style={styles.contextLabel}>
              {label}
            </KioskText>
            <View accessible={false} style={styles.smallChevron}>
              <View style={styles.chevronMark} />
            </View>
          </View>
        )}
      </Pressable>
    </View>
  );
}

export interface DockProps {
  /** Currency value in reais, never cents. */
  value: number;
  description?: string;
  children: ReactNode;
  /** Safe-area inset supplied by the host, added to the 12dp bottom padding. */
  bottomInset?: number;
  onLayout?: ViewProps["onLayout"];
}

const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

/** Anchor to the screen root; reserve its onLayout height in scrolling content. */
export function Dock({
  value,
  description = "Total do pedido",
  children,
  bottomInset = 0,
  onLayout,
}: DockProps) {
  const items = Children.toArray(children);
  const product = items.some(
    (child) => isValidElement<QuantityProps>(child) && child.type === Quantity,
  );
  return (
    <View
      onLayout={onLayout}
      style={[styles.dock, { paddingBottom: 12 + bottomInset }]}
    >
      <View
        testID="dock-inner"
        style={[styles.dockInner, product && styles.dockProduct]}
      >
        <View style={[styles.dockTotal, product && styles.dockProductTotal]}>
          <KioskText style={styles.dockDescription}>{description}</KioskText>
          <MotionValue value={money.format(value)}>
            <KioskText style={styles.dockValue}>
              {money.format(value)}
            </KioskText>
          </MotionValue>
        </View>
        <View
          style={[styles.dockActions, product && styles.dockProductActions]}
        >
          {items.map((child, index) => {
            if (
              isValidElement<QuantityProps>(child) &&
              child.type === Quantity
            ) {
              return cloneElement(child, { dock: true });
            }
            return (
              <View
                key={isValidElement(child) ? (child.key ?? index) : index}
                style={[styles.dockAction, !product && { flex: 0 }]}
              >
                {isValidElement<ActionProps>(child) && child.type === Action
                  ? cloneElement(child, { compact: true })
                  : child}
              </View>
            );
          })}
        </View>
      </View>
    </View>
  );
}

export interface SectionProps {
  title: string;
  summary: string;
  open: boolean;
  onToggle: () => void;
  optional?: boolean;
  children: ReactNode;
  id?: string;
  onReveal?: (
    rect: { top: number; height: number },
    finished: boolean,
    reduced: boolean,
  ) => void;
}

const easing = Easing.bezier(0.22, 1, 0.36, 1);

export function Section({
  title,
  summary,
  open,
  onToggle,
  optional = false,
  children,
  id,
  onReveal: suppliedReveal,
}: SectionProps) {
  const inheritedReveal = useContext(SectionRevealContext);
  const onReveal = suppliedReveal ?? inheritedReveal;
  const generatedId = useId();
  const nativeID = `section-${id ?? generatedId}`;
  const [measuredHeight, setMeasuredHeight] = useState(0);
  const height = useSharedValue(0);
  const opacity = useSharedValue(open ? 1 : 0);
  const clip = useRef<View>(null);
  const requestedOpen = useRef(false);
  const hasMeasured = useRef(false);
  const rotation = useSharedValue(open ? -90 : 0);
  const reduced = useReducedMotion();

  useEffect(() => {
    const firstMeasurement = measuredHeight > 0 && !hasMeasured.current;
    if (firstMeasurement) hasMeasured.current = true;
    const duration = reduced || firstMeasurement ? 0 : 280;
    height.set(
      withTiming(open ? measuredHeight : 0, {
        duration,
        easing,
        reduceMotion: ReduceMotion.System,
      }),
    );
    opacity.set(
      withTiming(open ? 1 : 0, {
        duration,
        easing,
        reduceMotion: ReduceMotion.System,
      }),
    );
    rotation.set(
      withTiming(open ? -90 : 0, {
        duration: reduced ? 0 : 240,
        easing,
        reduceMotion: ReduceMotion.System,
      }),
    );
  }, [height, opacity, measuredHeight, open, reduced, rotation]);

  useEffect(() => {
    if (!open || !requestedOpen.current || !onReveal) return;
    const started = performance.now();
    let active = true;
    let frame = 0;
    const follow = (now: number) => {
      const finished = reduced || now - started >= 280;
      if (reduced || now - started >= 85) {
        clip.current?.measureInWindow((_x, top, _width, height) => {
          if (active) onReveal({ top, height }, finished, reduced);
        });
      }
      if (!finished) frame = requestAnimationFrame(follow);
      else requestedOpen.current = false;
    };
    if (reduced) follow(started);
    else frame = requestAnimationFrame(follow);
    return () => {
      active = false;
      cancelAnimationFrame(frame);
    };
  }, [open, onReveal, reduced]);

  const clipStyle = useAnimatedStyle(() => ({
    height: height.get(),
    opacity: opacity.get(),
  }));
  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.get()}deg` }],
  }));

  return (
    <View style={styles.section}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${title}${optional ? ", Opcional" : ""}, ${summary}`}
        onPress={() => {
          requestedOpen.current = !open;
          onToggle();
        }}
      >
        {({ pressed }) => (
          <View style={[styles.sectionHeader, pressed && styles.pressed]}>
            <View style={styles.sectionCopy}>
              <View style={styles.sectionTitleRow}>
                <KioskText style={styles.sectionTitle}>{title}</KioskText>
                {optional && (
                  <KioskText style={styles.sectionOptional}>Opcional</KioskText>
                )}
              </View>
              <MotionValue value={summary}>
                <KioskText style={styles.sectionSummary}>{summary}</KioskText>
              </MotionValue>
            </View>
            <Animated.View
              testID={`${nativeID}-chevron`}
              accessible={false}
              style={[styles.sectionChevron, chevronStyle]}
            >
              <View style={styles.chevronMark} />
            </Animated.View>
          </View>
        )}
      </Pressable>
      <Animated.View
        ref={clip}
        nativeID={nativeID}
        testID={`${nativeID}-clip`}
        pointerEvents={open ? "auto" : "none"}
        accessibilityElementsHidden={!open}
        importantForAccessibility={open ? "auto" : "no-hide-descendants"}
        style={[styles.sectionClip, clipStyle]}
      >
        {/* Absolute content measures at full width even while the clip has zero height. */}
        <View
          collapsable={false}
          style={styles.sectionBody}
          onLayout={(event) =>
            setMeasuredHeight(event.nativeEvent.layout.height)
          }
        >
          {children}
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  text: { color: colors.ink },
  pressed: { opacity: 0.76 },
  action: {
    minHeight: 54,
    paddingVertical: 15,
    paddingHorizontal: 22,
    borderRadius: 6,
    backgroundColor: colors.action,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
  },
  actionCompact: {
    minHeight: 52,
    paddingVertical: 14,
    paddingHorizontal: 17,
    gap: 10,
  },
  actionDisabled: { backgroundColor: colors.disabled },
  actionLabel: {
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "600",
    flexShrink: 1,
  },
  actionLabelCompact: { fontSize: 12, lineHeight: 18 },
  arrow: {
    width: 20,
    height: 20,
    marginLeft: "auto",
    justifyContent: "center",
    flexShrink: 0,
  },
  arrowLine: { height: 1.5, width: 16 },
  arrowTip: {
    position: "absolute",
    right: 3,
    width: 8,
    height: 8,
    borderTopWidth: 1.5,
    borderRightWidth: 1.5,
    transform: [{ rotate: "45deg" }],
  },
  quantity: {
    height: 46,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 11,
    backgroundColor: colors.paper,
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "center",
    flexShrink: 0,
  },
  quantityDock: { height: 52 },
  quantityButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  quantityButtonCompact: { width: 36 },
  quantityButtonDock: { height: 50 },
  quantityValue: {
    minWidth: 24,
    textAlign: "center",
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "500",
    fontVariant: ["tabular-nums"],
  },
  quantityValueCompact: { minWidth: 22 },
  quantityMark: {
    width: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  markHorizontal: { width: 13, height: 1.5 },
  markVertical: { position: "absolute", width: 1.5, height: 13 },
  header: {
    height: 85.6,
    paddingHorizontal: 20,
    backgroundColor: colors.paper,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  brandSlot: { flex: 1, minWidth: 0 },
  brand: { minHeight: 44, justifyContent: "center" },
  brandName: {
    fontSize: 37,
    lineHeight: 34,
    letterSpacing: -1.295,
    fontWeight: "700",
    color: colors.accent,
  },
  tagline: {
    fontSize: 7,
    lineHeight: 9,
    letterSpacing: 1.26,
    fontWeight: "500",
    marginTop: 7,
    color: colors.muted,
  },
  context: {
    minHeight: 44,
    paddingVertical: 8,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  contextLabel: { fontSize: 10, lineHeight: 15 },
  smallChevron: {
    width: 12,
    height: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  chevronMark: {
    width: 7,
    height: 7,
    borderBottomWidth: 1.5,
    borderRightWidth: 1.5,
    borderColor: colors.chevron,
    transform: [{ rotate: "45deg" }],
  },
  dock: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    backgroundColor: colors.paper,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  dockInner: { flexDirection: "row", alignItems: "center", gap: 15 },
  dockProduct: { flexDirection: "column", alignItems: "stretch", gap: 9 },
  dockTotal: { flexShrink: 1 },
  dockProductTotal: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 12,
  },
  dockDescription: {
    fontSize: 10,
    lineHeight: 15,
    color: colors.muted,
    flexShrink: 1,
  },
  dockValue: {
    fontSize: 21,
    lineHeight: 31.5,
    fontWeight: "600",
    letterSpacing: -0.735,
    fontVariant: ["tabular-nums"],
  },
  dockActions: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 10,
  },
  dockProductActions: { flex: 0, width: "100%" },
  dockAction: { flex: 1, minWidth: 0 },
  section: {
    backgroundColor: colors.paper,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  sectionHeader: {
    minHeight: 82,
    paddingVertical: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  sectionCopy: { flex: 1, minWidth: 0 },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 10,
  },
  sectionTitle: {
    fontSize: 15,
    lineHeight: 22.5,
    fontWeight: "600",
    flexShrink: 1,
  },
  sectionOptional: { fontSize: 10, lineHeight: 15, color: colors.muted },
  sectionSummary: {
    fontSize: 12,
    lineHeight: 18,
    marginTop: 6,
    color: colors.muted,
  },
  sectionChevron: {
    width: 20,
    height: 20,
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionClip: { overflow: "hidden" },
  sectionBody: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    paddingBottom: 23,
  },
});

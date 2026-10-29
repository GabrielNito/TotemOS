import {
  useCallback,
  useEffect,
  useEffectEvent,
  useMemo,
  useState,
} from "react";
import { PanResponder, Pressable, StyleSheet, View } from "react-native";
import { CircleCheck, X } from "lucide-react-native";
import Animated, {
  cancelAnimation,
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { colors, KioskText } from "./ui";

export interface OrderNoticeProps {
  message: string;
  version: number;
  onClose: () => void;
  onAction: () => void;
  actionLabel?: string;
}

const duration = 6000;
const easing = Easing.bezier(0.22, 1, 0.36, 1);

/** Render as a sibling of the screen content and fixed dock at the root. */
export function OrderNotice({
  message,
  version,
  onClose,
  onAction,
  actionLabel = "Ver pedido",
}: OrderNoticeProps) {
  if (!message) return null;
  return (
    <Notice
      key={JSON.stringify([message, version])}
      message={message}
      onClose={onClose}
      onAction={onAction}
      actionLabel={actionLabel}
    />
  );
}

function Notice({
  message,
  onClose,
  onAction,
  actionLabel,
}: Omit<OrderNoticeProps, "version">) {
  const reduced = useReducedMotion();
  const [visible, setVisible] = useState(true);
  const entrance = useSharedValue(reduced ? 1 : 0);
  const progress = useSharedValue(1);
  const dragX = useSharedValue(0);
  const dragY = useSharedValue(0);

  const dismiss = useCallback(() => {
    if (!visible) return false;
    setVisible(false);
    onClose();
    return true;
  }, [onClose, visible]);

  const expire = useEffectEvent(() => {
    dismiss();
  });

  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(expire, duration);
    return () => clearTimeout(timer);
  }, [visible]);

  useEffect(() => {
    entrance.set(
      withTiming(1, {
        duration: reduced ? 0 : 240,
        easing,
        reduceMotion: ReduceMotion.System,
      }),
    );
    // As in V2, reduced motion keeps the progress bar still; expiry is unchanged.
    if (!reduced) {
      progress.set(
        withTiming(0, {
          duration,
          easing: Easing.linear,
          reduceMotion: ReduceMotion.System,
        }),
      );
    }
    return () => {
      cancelAnimation(entrance);
      cancelAnimation(progress);
    };
  }, [entrance, progress, reduced]);

  const pan = useMemo(() => {
    const reset = () => {
      const config = {
        duration: reduced ? 0 : 240,
        easing,
        reduceMotion: ReduceMotion.System,
      };
      dragX.set(withTiming(0, config));
      dragY.set(withTiming(0, config));
    };
    return PanResponder.create({
      onMoveShouldSetPanResponder: (_, { dx, dy }) =>
        Math.abs(dx) > 8 || Math.abs(dy) > 8,
      onPanResponderMove: (_, { dx, dy }) => {
        if (!reduced) {
          dragX.set(dx * 0.65);
          dragY.set(dy * 0.65);
        }
      },
      onPanResponderRelease: (_, { dx, dy }) => {
        if (Math.abs(dx) > 85 || dy < -65) dismiss();
        else reset();
      },
      onPanResponderTerminate: reset,
    });
  }, [dismiss, dragX, dragY, reduced]);

  useEffect(
    () => () => {
      cancelAnimation(dragX);
      cancelAnimation(dragY);
    },
    [dragX, dragY],
  );

  const toastStyle = useAnimatedStyle(() => ({
    opacity: entrance.get(),
    transform: [
      { translateX: dragX.get() },
      { translateY: (1 - entrance.get()) * 12 + dragY.get() },
    ],
  }));
  const progressStyle = useAnimatedStyle(() => ({
    width: `${progress.get() * 100}%`,
  }));

  if (!visible) return null;
  return (
    <View pointerEvents="box-none" style={styles.region}>
      <Animated.View
        testID="order-notice"
        {...pan.panHandlers}
        style={[styles.toast, toastStyle]}
      >
        <View style={styles.icon} accessible={false}>
          <CircleCheck size={25} color="#c4d8ad" />
        </View>
        <View style={styles.body}>
          <View accessibilityLiveRegion="polite" accessible>
            <KioskText style={styles.title}>Pedido atualizado</KioskText>
            <KioskText style={styles.message}>{message}</KioskText>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={actionLabel}
            onPress={() => {
              if (dismiss()) onAction();
            }}
          >
            {({ pressed }) => (
              <View style={[styles.action, pressed && styles.pressed]}>
                <KioskText style={styles.actionLabel}>{actionLabel}</KioskText>
              </View>
            )}
          </Pressable>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Fechar aviso"
          onPress={dismiss}
        >
          {({ pressed }) => (
            <View style={[styles.close, pressed && styles.pressed]}>
              <X size={17} color={colors.paper} />
            </View>
          )}
        </Pressable>
        <Animated.View
          testID="order-notice-progress"
          accessible={false}
          importantForAccessibility="no"
          pointerEvents="none"
          style={[styles.progress, progressStyle]}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  region: {
    position: "absolute",
    top: 12,
    left: 12,
    right: 12,
    alignItems: "center",
    zIndex: 40,
    elevation: 40,
  },
  toast: {
    width: "100%",
    maxWidth: 440,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 12,
    overflow: "hidden",
    backgroundColor: "#303c2a",
    borderColor: "#607354",
    borderWidth: 1,
    borderRadius: 12,
    boxShadow: "0 12px 36px #202c2240",
  },
  icon: { width: 28, minHeight: 44, justifyContent: "center" },
  body: { flex: 1, minWidth: 0, gap: 6 },
  title: {
    color: colors.paper,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: "600",
  },
  message: { color: "#e0e8dc", fontSize: 14, lineHeight: 19.6, marginTop: 3 },
  action: {
    alignSelf: "flex-start",
    minHeight: 44,
    justifyContent: "center",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: "#8c9e80",
    borderRadius: 6,
    backgroundColor: "#ffffff12",
  },
  actionLabel: { color: colors.paper, fontSize: 14, fontWeight: "600" },
  close: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: { opacity: 0.76 },
  progress: {
    position: "absolute",
    bottom: 0,
    left: 0,
    height: 3,
    backgroundColor: "#d7e6cf",
  },
});

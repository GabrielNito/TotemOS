import { useEffect, type ReactNode } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import Animated, {
  Easing,
  FadeIn,
  ReduceMotion,
  cancelAnimation,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { ProductArt } from "./product-art";
import type { ProductTransition } from "./product-motion";

const ease = Easing.bezier(0.22, 1, 0.36, 1);

export function MotionScene({
  style,
  children,
  active = true,
  shared = false,
  ready = false,
}: {
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
  active?: boolean;
  shared?: boolean;
  ready?: boolean;
}) {
  const opacity = useSharedValue(active && !shared ? 1 : active ? 0 : 1);
  useEffect(() => {
    if (!shared) {
      opacity.set(1);
      return;
    }
    if (ready)
      opacity.set(
        withTiming(active ? 1 : 0, {
          duration: 180,
          easing: ease,
          reduceMotion: ReduceMotion.System,
        }),
      );
  }, [active, shared, ready, opacity]);
  const animated = useAnimatedStyle(() => ({ opacity: opacity.get() }));
  return (
    <Animated.View
      style={[style, shared && animated]}
      pointerEvents={active ? "auto" : "none"}
      accessibilityElementsHidden={!active}
      importantForAccessibility={active ? "auto" : "no-hide-descendants"}
      entering={
        shared
          ? undefined
          : FadeIn.duration(220).easing(ease).reduceMotion(ReduceMotion.System)
      }
    >
      {children}
    </Animated.View>
  );
}

/** The moving layer renders actual product assets, including combo compositions. */
export function ProductMotionOverlay({
  transition,
  onComplete,
}: {
  transition: ProductTransition;
  onComplete: (id: number) => void;
}) {
  const progress = useSharedValue(0);
  const { id, from, to } = transition;
  useEffect(() => {
    if (to)
      progress.set(
        withTiming(
          1,
          { duration: 360, easing: ease, reduceMotion: ReduceMotion.System },
          (finished) => {
            if (finished) runOnJS(onComplete)(id);
          },
        ),
      );
    return () => cancelAnimation(progress);
  }, [id, to, onComplete, progress]);
  const box = useAnimatedStyle(() => {
    const p = progress.get();
    const end = to?.rect ?? from.rect;
    return {
      left: from.rect.x + (end.x - from.rect.x) * p,
      top: from.rect.y + (end.y - from.rect.y) * p,
      width: from.rect.width + (end.width - from.rect.width) * p,
      height: from.rect.height + (end.height - from.rect.height) * p,
    };
  });
  const oldArt = useAnimatedStyle(() => ({ opacity: 1 - progress.get() }));
  const newArt = useAnimatedStyle(() => ({ opacity: progress.get() }));
  return (
    <Animated.View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[{ position: "absolute", zIndex: 30 }, box]}
    >
      <Animated.View
        style={[
          { position: "absolute", width: "100%", height: "100%" },
          oldArt,
        ]}
      >
        <ProductArt
          product={transition.product}
          detail={from.detail}
          featured={from.featured}
          overlay
          style={{ width: "100%", height: "100%", flex: 0 }}
        />
      </Animated.View>
      {to && (
        <Animated.View
          style={[
            { position: "absolute", width: "100%", height: "100%" },
            newArt,
          ]}
        >
          <ProductArt
            product={transition.product}
            detail={to.detail}
            featured={to.featured}
            overlay
            style={{ width: "100%", height: "100%", flex: 0 }}
          />
        </Animated.View>
      )}
    </Animated.View>
  );
}

export function MotionPress({
  pressed,
  style,
  children,
}: {
  pressed: boolean;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  const reduced = useReducedMotion();
  const scale = useSharedValue(1);
  useEffect(() => {
    scale.set(
      withTiming(pressed ? 0.96 : 1, {
        duration: reduced ? 0 : 140,
        easing: Easing.bezier(0.25, 0.1, 0.25, 1),
        reduceMotion: ReduceMotion.System,
      }),
    );
  }, [pressed, reduced, scale]);
  const motion = useAnimatedStyle(() => ({
    transform: [{ scale: scale.get() }],
  }));
  return <Animated.View style={[style, motion]}>{children}</Animated.View>;
}

export function MotionValue({
  value,
  children,
}: {
  value: string | number;
  children: ReactNode;
}) {
  return <ValueAnimation key={value}>{children}</ValueAnimation>;
}

function ValueAnimation({ children }: { children: ReactNode }) {
  const reduced = useReducedMotion();
  const progress = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    progress.set(
      withTiming(1, {
        duration: reduced ? 0 : 200,
        easing: ease,
        reduceMotion: ReduceMotion.System,
      }),
    );
  }, [reduced, progress]);
  const motion = useAnimatedStyle(() => ({
    opacity: 0.55 + progress.get() * 0.45,
    transform: [{ translateY: 4 * (1 - progress.get()) }],
  }));
  return <Animated.View style={motion}>{children}</Animated.View>;
}

export function MotionSelection({ children }: { children: ReactNode }) {
  const reduced = useReducedMotion();
  const progress = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    progress.set(
      withTiming(1, {
        duration: reduced ? 0 : 200,
        easing: ease,
        reduceMotion: ReduceMotion.System,
      }),
    );
  }, [reduced, progress]);
  const motion = useAnimatedStyle(() => ({
    opacity: progress.get(),
    transform: [{ scale: 0.5 + progress.get() * 0.5 }],
  }));
  return <Animated.View style={motion}>{children}</Animated.View>;
}

export function MotionSuccess({
  style,
  children,
}: {
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  const reduced = useReducedMotion();
  const progress = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    progress.set(
      withSpring(1, {
        stiffness: 330,
        damping: 24,
        reduceMotion: ReduceMotion.System,
      }),
    );
  }, [progress]);
  const motion = useAnimatedStyle(() => ({
    opacity: progress.get(),
    transform: [{ scale: 0.8 + progress.get() * 0.2 }],
  }));
  return <Animated.View style={[style, motion]}>{children}</Animated.View>;
}

import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import {
  CookingPot,
  CupSoda,
  LayoutGrid,
  Layers3,
  Sandwich,
} from "lucide-react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import type { Category } from "./reference-model";
import { colors, KioskText } from "./ui";

export const menuCategories: { name: Category; icon: typeof Sandwich }[] = [
  { name: "Todos", icon: LayoutGrid },
  { name: "Lanches", icon: Sandwich },
  { name: "Combos", icon: Layers3 },
  { name: "Porções", icon: CookingPot },
  { name: "Bebidas", icon: CupSoda },
];
export type RailCategory = { id: string; name: string; icon?: typeof Sandwich };
const defaultCategories: RailCategory[] = menuCategories.map((item) => ({
  ...item,
  id: item.name,
}));

export function CategoryRail({
  value,
  onChange,
  items = defaultCategories,
}: {
  value: string;
  onChange: (category: string) => void;
  items?: RailCategory[];
}) {
  const contentWidth =
    items.length * 88 + Math.max(0, items.length - 1) * 8 + 22;
  const rail = useRef<ScrollView>(null);
  const offset = useRef(0);
  const [viewport, setViewport] = useState(0);
  const [more, setMore] = useState(true);
  const index = Math.max(
    0,
    items.findIndex((item) => item.id === value),
  );
  const reduced = useReducedMotion();
  const selectedX = useSharedValue(6 + index * 96);
  useEffect(() => {
    selectedX.set(
      withTiming(6 + index * 96, {
        duration: reduced ? 0 : 260,
        easing: Easing.bezier(0.22, 1, 0.36, 1),
        reduceMotion: ReduceMotion.System,
      }),
    );
    if (!viewport) return;
    const left = 2 + index * 96;
    const right = left + 88;
    const next = Math.max(
      0,
      Math.min(
        contentWidth - viewport,
        left < offset.current
          ? left - 8
          : right > offset.current + viewport
            ? right + 8 - viewport
            : offset.current,
      ),
    );
    rail.current?.scrollTo({ x: next, animated: !reduced });
    setMore(contentWidth - viewport - next > 4);
  }, [index, viewport, reduced, selectedX, contentWidth]);
  const highlight = useAnimatedStyle(() => ({
    transform: [{ translateX: selectedX.get() }],
  }));
  return (
    <View style={s.rail}>
      <ScrollView
        ref={rail}
        horizontal
        accessibilityRole="tablist"
        accessibilityLabel="Categorias do cardápio"
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.content}
        onLayout={(event) => setViewport(event.nativeEvent.layout.width)}
        onScroll={(event) => {
          offset.current = event.nativeEvent.contentOffset.x;
          setMore(contentWidth - viewport - offset.current > 4);
        }}
        scrollEventThrottle={16}
      >
        <Animated.View
          pointerEvents="none"
          accessible={false}
          style={[s.highlight, highlight]}
        />
        {items.map((item) => {
          const Icon = item.icon ?? LayoutGrid;
          const selected = value === item.id;
          return (
            <Pressable
              key={item.id}
              accessibilityRole="tab"
              accessibilityLabel={item.name}
              accessibilityState={{ selected }}
              onPress={() => onChange(item.id)}
            >
              <View style={[s.category, selected && s.selected]}>
                <Icon
                  size={21}
                  strokeWidth={1.7}
                  color={selected ? colors.action : colors.muted}
                />
                <KioskText style={[s.label, selected && s.selectedLabel]}>
                  {item.name}
                </KioskText>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
      {more && (
        <View pointerEvents="none" accessible={false} style={s.fade}>
          <Svg width="22" height="100%">
            <Defs>
              <LinearGradient id="category-edge" x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor="#fff" stopOpacity="0" />
                <Stop offset="1" stopColor="#fff" />
              </LinearGradient>
            </Defs>
            <Rect width="100%" height="100%" fill="url(#category-edge)" />
          </Svg>
        </View>
      )}
    </View>
  );
}
const s = StyleSheet.create({
  rail: { backgroundColor: "#fff", paddingLeft: 20, paddingVertical: 10 },
  content: { gap: 8, padding: 2, paddingRight: 20 },
  highlight: {
    position: "absolute",
    top: 6,
    left: 0,
    width: 80,
    height: 60,
    borderRadius: 5,
    backgroundColor: "#faf3f0",
  },
  category: {
    width: 88,
    minHeight: 68,
    borderWidth: 1,
    borderColor: "#e8e2dc",
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 9,
    paddingHorizontal: 12,
  },
  selected: { borderColor: "#b38a7e" },
  label: { fontSize: 13, fontWeight: "500", color: colors.muted },
  selectedLabel: { color: colors.action, fontWeight: "600" },
  fade: { position: "absolute", right: 0, top: 0, bottom: 0, width: 22 },
});

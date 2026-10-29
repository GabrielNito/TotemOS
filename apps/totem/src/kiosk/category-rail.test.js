import React from "react";
import { expect, jest, test } from "@jest/globals";
import { act, create } from "react-test-renderer";
import { CategoryRail } from "./category-rail";

jest.mock("lucide-react-native", () => ({
  CookingPot: () => null,
  CupSoda: () => null,
  LayoutGrid: () => null,
  Layers3: () => null,
  Sandwich: () => null,
}));
jest.mock("./ui", () => ({
  KioskText: require("react-native").Text,
  colors: { action: "#773b2e", muted: "#716861" },
}));
jest.mock("react-native-reanimated", () => ({
  __esModule: true,
  default: { View: require("react-native").View },
  Easing: { bezier: () => (value) => value },
  ReduceMotion: { System: "system" },
  useReducedMotion: () => false,
  useSharedValue: (initial) => {
    const ref = require("react").useRef(initial);
    return require("react").useMemo(
      () => ({
        get: () => ref.current,
        set: (value) => {
          ref.current = value;
        },
      }),
      [],
    );
  },
  useAnimatedStyle: (callback) => callback(),
  withTiming: (value) => value,
}));

test("business categories use their IDs even when display names are equal", async () => {
  const onChange = jest.fn();
  let tree;
  await act(async () => {
    tree = create(
      <CategoryRail
        value="category-2"
        onChange={onChange}
        items={[
          { id: "category-1", name: "Especial" },
          { id: "category-2", name: "Especial" },
        ]}
      />,
    );
  });
  try {
    const tabs = tree.root.findAll(
      (node) =>
        node.props.accessibilityRole === "tab" &&
        typeof node.props.onPress === "function",
    );
    expect(tabs).toHaveLength(2);
    expect(tabs[1].props.accessibilityState.selected).toBe(true);
    await act(async () => tabs[0].props.onPress());
    expect(onChange).toHaveBeenCalledWith("category-1");
  } finally {
    await act(async () => tree.unmount());
  }
});

test("the five category tabs expose selection and report the requested category", async () => {
  const onChange = jest.fn();
  let tree;
  await act(async () => {
    tree = create(<CategoryRail value="Todos" onChange={onChange} />);
  });
  const tabs = () =>
    tree.root.findAll(
      (node) =>
        node.props.accessibilityRole === "tab" &&
        typeof node.props.onPress === "function",
    );
  expect(tabs().map((node) => node.props.accessibilityLabel)).toEqual([
    "Todos",
    "Lanches",
    "Combos",
    "Porções",
    "Bebidas",
  ]);
  await act(async () => tabs()[4].props.onPress());
  expect(onChange).toHaveBeenCalledWith("Bebidas");
  await act(async () =>
    tree.update(<CategoryRail value="Bebidas" onChange={onChange} />),
  );
  expect(tabs().map((node) => node.props.accessibilityState.selected)).toEqual([
    false,
    false,
    false,
    false,
    true,
  ]);
  await act(async () => tree.unmount());
});

import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { Modal } from "react-native";
import { ContextDialog } from "./context-dialog";

jest.mock("lucide-react-native", () => ({
  Check: () => null,
  Smartphone: () => null,
  Store: () => null,
  Utensils: () => null,
  X: () => null,
}));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 34, bottom: 15, left: 0, right: 0 }),
}));
jest.mock("react-native-reanimated", () => {
  const chain: Record<string, unknown> = {};
  for (const method of [
    "duration",
    "easing",
    "withInitialValues",
    "reduceMotion",
  ])
    chain[method] = () => chain;
  return {
    __esModule: true,
    default: {
      View: jest.requireActual("react-native").View,
      ScrollView: jest.requireActual("react-native").ScrollView,
    },
    FadeIn: chain,
    FadeInDown: chain,
    Easing: { bezier: () => (value: number) => value },
    ReduceMotion: { System: "system" },
  };
});
jest.mock("./ui", () => ({
  KioskText: jest.requireActual("react-native").Text,
  colors: {
    ink: "#2d2622",
    muted: "#716861",
    line: "#e8e2dc",
    action: "#773b2e",
  },
}));

test("live counter context does not offer fictitious tables or demo copy", async () => {
  const onStandby = jest.fn();
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(
      <ContextDialog
        visible
        simulation={false}
        businessName="Cafeteria da Praça"
        mode="counter"
        onChange={jest.fn()}
        onClose={jest.fn()}
        onStandby={onStandby}
      />,
    );
  });
  try {
    const radios = tree.root.findAll(
      (node) =>
        node.props.accessibilityRole === "radio" &&
        typeof node.props.onPress === "function",
    );
    expect(radios).toHaveLength(1);
    expect(radios[0].props.accessibilityLabel).toBe("Retirar no balcão");
    const content = JSON.stringify(tree.toJSON());
    expect(content).not.toContain("mesa 12");
    expect(content).not.toContain("marca fictícia");
    const action = tree.root.findAll(
      (node) =>
        node.props.accessibilityLabel === "Voltar à tela inicial" &&
        typeof node.props.onPress === "function",
    )[0];
    await act(async () => action.props.onPress());
    expect(onStandby).toHaveBeenCalledTimes(1);
  } finally {
    await act(async () => tree.unmount());
  }
});

test("all three contexts can be selected without submitting or resetting the order", async () => {
  const onChange = jest.fn();
  const onClose = jest.fn();
  const onStandby = jest.fn();
  let tree: ReactTestRenderer;
  await act(async () => {
    tree = create(
      <ContextDialog
        visible
        mode="counter"
        onChange={onChange}
        onClose={onClose}
        onStandby={onStandby}
      />,
    );
  });
  const options = tree!.root.findAll(
    (node) =>
      node.props.accessibilityRole === "radio" &&
      typeof node.props.onPress === "function",
  );
  expect(options).toHaveLength(3);
  expect(options.map((node) => node.props.accessibilityState.checked)).toEqual([
    true,
    false,
    false,
  ]);
  await act(async () => options[1].props.onPress());
  await act(async () => options[2].props.onPress());
  expect(onChange.mock.calls).toEqual([["table"], ["qr"]]);
  expect(onStandby).not.toHaveBeenCalled();
  expect(onClose).not.toHaveBeenCalled();
  await act(async () => tree!.root.findByType(Modal).props.onRequestClose());
  expect(onClose).toHaveBeenCalledTimes(1);
  const standby = tree!.root.findAll(
    (node) =>
      node.props.accessibilityLabel === "Ver tela de espera" &&
      typeof node.props.onPress === "function",
  )[0];
  await act(async () => standby.props.onPress());
  expect(onStandby).toHaveBeenCalledTimes(1);
  await act(async () => tree!.unmount());
});

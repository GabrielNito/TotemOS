import React from "react";
import { afterEach, beforeEach, expect, jest, test } from "@jest/globals";
import { act, create } from "react-test-renderer";
import { OrderNotice } from "./notice";

jest.mock("lucide-react-native", () => ({
  CircleCheck: () => null,
  X: () => null,
}));
jest.mock("react-native-reanimated", () => ({
  __esModule: true,
  default: { View: require("react-native").View },
  cancelAnimation: jest.fn(),
  Easing: { bezier: () => (value) => value, linear: (value) => value },
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

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

test("undo is an accessible button and restores the item exactly once", async () => {
  const onAction = jest.fn();
  const onClose = jest.fn();
  let tree;
  await act(async () => {
    tree = create(
      <OrderNotice
        message="Bacon Melt removido."
        version={1}
        actionLabel="Desfazer"
        onAction={onAction}
        onClose={onClose}
      />,
    );
  });
  const undo = tree.root.findAll(
    (node) =>
      node.props.accessibilityRole === "button" &&
      node.props.accessibilityLabel === "Desfazer" &&
      typeof node.props.onPress === "function",
  )[0];
  expect(undo).toBeDefined();
  await act(async () => undo.props.onPress());
  expect(onAction).toHaveBeenCalledTimes(1);
  expect(onClose).toHaveBeenCalledTimes(1);
  await act(async () => jest.advanceTimersByTime(6000));
  expect(onClose).toHaveBeenCalledTimes(1);
  await act(async () => tree.unmount());
});

test("a new notice gets a fresh six second window", async () => {
  const onClose = jest.fn();
  const props = { message: "Pedido atualizado", onClose, onAction: jest.fn() };
  let tree;
  await act(async () => {
    tree = create(<OrderNotice {...props} version={1} />);
  });
  await act(async () => jest.advanceTimersByTime(5000));
  await act(async () => tree.update(<OrderNotice {...props} version={2} />));
  await act(async () => jest.advanceTimersByTime(1001));
  expect(onClose).not.toHaveBeenCalled();
  await act(async () => jest.advanceTimersByTime(5000));
  expect(onClose).toHaveBeenCalledTimes(1);
  await act(async () => tree.unmount());
});

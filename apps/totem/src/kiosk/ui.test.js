import React from "react";
import { act, create } from "react-test-renderer";
import { StyleSheet, Text } from "react-native";
import { expect, jest, test } from "@jest/globals";
import { useReducedMotion, withTiming } from "react-native-reanimated";
import { Action, BrandHeader, Dock, KioskText, Quantity, Section } from "./ui";
jest.mock("lucide-react-native", () => ({
  Store: () => null,
  Utensils: () => null,
  Smartphone: () => null,
}));

jest.mock("react-native-reanimated", () => ({
  __esModule: true,
  default: { View: require("react-native").View },
  Easing: { bezier: () => (value) => value },
  ReduceMotion: { System: "system" },
  useReducedMotion: jest.fn(() => false),
  useSharedValue: (initial) => {
    const ref = require("react").useRef(initial);
    const [, render] = require("react").useReducer((value) => value + 1, 0);
    return require("react").useMemo(
      () => ({
        get: () => ref.current,
        set: (value) => {
          if (Object.is(ref.current, value)) return;
          ref.current = value;
          render();
        },
      }),
      [],
    );
  },
  useAnimatedStyle: (callback) => callback(),
  withTiming: jest.fn((value) => value),
}));

async function render(node) {
  let tree;
  await act(async () => {
    tree = create(node);
  });
  return tree;
}

function buttons(tree) {
  return tree.root.findAll(
    (node) =>
      node.props?.accessibilityRole === "button" &&
      typeof node.props.onPress === "function",
  );
}

test("quantity bounds and disabled actions prevent callbacks", async () => {
  const onChange = jest.fn();
  const tree = await render(
    <Quantity value={0} min={0} max={1} name="Bacon" onChange={onChange} />,
  );
  expect(buttons(tree)[0].props.disabled).toBe(true);
  await act(async () => {
    buttons(tree)[0].props.onPress();
    buttons(tree)[1].props.onPress();
  });
  expect(onChange.mock.calls).toEqual([[1]]);
  await act(async () => {
    tree.update(
      <Quantity value={1} min={0} max={1} name="Bacon" onChange={onChange} />,
    );
  });
  expect(buttons(tree)[1].props.disabled).toBe(true);
  buttons(tree)[1].props.onPress();
  expect(onChange.mock.calls).toEqual([[1]]);
  const onPress = jest.fn();
  await act(async () => {
    tree.update(
      <Action disabled onPress={onPress}>
        Adicionar
      </Action>,
    );
  });
  buttons(tree)[0].props.onPress();
  expect(onPress).not.toHaveBeenCalled();
  await act(async () => tree.unmount());
});

test("closed section preserves content, hides accessibility and keeps chevron in header", async () => {
  const onToggle = jest.fn();
  const props = {
    id: "extras",
    title: "Adicionais",
    summary: "Bacon",
    open: false,
    onToggle,
  };
  const tree = await render(
    <Section {...props}>
      <Text>Selected bacon</Text>
    </Section>,
  );
  const clip = () => tree.root.findByProps({ testID: "section-extras-clip" });
  expect(clip().props.pointerEvents).toBe("none");
  expect(clip().props.accessibilityElementsHidden).toBe(true);
  expect(clip().props.importantForAccessibility).toBe("no-hide-descendants");
  expect(StyleSheet.flatten(clip().props.style).opacity).toBe(0);
  expect(JSON.stringify(tree.toJSON())).toContain("Selected bacon");
  expect(
    buttons(tree)[0].findByProps({ testID: "section-extras-chevron" }),
  ).toBeTruthy();
  const header = buttons(tree)[0].findAll(
    (node) => StyleSheet.flatten(node.props?.style)?.minHeight === 82,
  )[0];
  expect(StyleSheet.flatten(header.props.style).paddingVertical).toBe(20);
  const body = tree.root.findAll(
    (node) => typeof node.props?.onLayout === "function",
  )[0];
  await act(async () =>
    body.props.onLayout({ nativeEvent: { layout: { height: 173 } } }),
  );
  await act(async () => buttons(tree)[0].props.onPress());
  expect(onToggle).toHaveBeenCalledTimes(1);
  await act(async () => {
    tree.update(
      <Section {...props} open>
        <Text>Selected bacon</Text>
      </Section>,
    );
  });
  expect(clip().props.pointerEvents).toBe("auto");
  expect(buttons(tree)[0].props.accessibilityState.expanded).toBe(true);
  expect(withTiming).toHaveBeenCalledWith(
    173,
    expect.objectContaining({ duration: 280, reduceMotion: "system" }),
  );
  await act(async () => {
    tree.update(
      <Section {...props}>
        <Text>Selected bacon</Text>
      </Section>,
    );
  });
  expect(clip().props.pointerEvents).toBe("none");
  expect(StyleSheet.flatten(clip().props.style).opacity).toBe(0);
  expect(JSON.stringify(tree.toJSON())).toContain("Selected bacon");
  await act(async () => tree.unmount());
});

test("native geometry lives inside pressables and product dock uses two rows", async () => {
  const tree = await render(
    <>
      <BrandHeader onContext={() => {}} />
      <Dock value={25.5}>
        <Quantity name="Lanche" value={1} onChange={() => {}} />
        <Action>Adicionar</Action>
      </Dock>
      <KioskText menu style={{ fontSize: 30, fontWeight: "700" }}>
        Brioche
      </KioskText>
    </>,
  );
  for (const button of buttons(tree))
    expect(button.props.style).toBeUndefined();
  const header = tree.root.findByProps({ testID: "brand-header" });
  expect(StyleSheet.flatten(header.props.style)).toMatchObject({
    height: 85.6,
    paddingHorizontal: 20,
  });
  expect(
    StyleSheet.flatten(
      tree.root.findByProps({ testID: "dock-inner" }).props.style,
    ).flexDirection,
  ).toBe("column");
  const menu = tree.root
    .findAllByType(Text)
    .find((node) => node.props.children === "Brioche");
  expect(StyleSheet.flatten(menu.props.style)).toMatchObject({
    fontFamily: "BarlowCondensed_700Bold",
    lineHeight: 30,
    includeFontPadding: false,
  });
  await act(async () => tree.unmount());
});

test("reduced motion snaps measured section height without a duration", async () => {
  useReducedMotion.mockReturnValue(true);
  withTiming.mockClear();
  const tree = await render(
    <Section title="Adicionais" summary="Bacon" open onToggle={() => {}}>
      <Text>Bacon</Text>
    </Section>,
  );
  const body = tree.root.findAll(
    (node) => typeof node.props?.onLayout === "function",
  )[0];
  await act(async () =>
    body.props.onLayout({ nativeEvent: { layout: { height: 120 } } }),
  );
  expect(withTiming).toHaveBeenCalledWith(
    120,
    expect.objectContaining({ duration: 0, reduceMotion: "system" }),
  );
  await act(async () => tree.unmount());
  useReducedMotion.mockReturnValue(false);
});

test("compact quantity sizes internal cart buttons and dock restores regular width", async () => {
  const props = { name: "Lanche", value: 1, onChange: () => {} };
  const tree = await render(<Quantity {...props} compact />);
  const widths = () =>
    buttons(tree).map((button) => {
      const target = button.findAll(
        (node) => StyleSheet.flatten(node.props?.style)?.height === 44,
      )[0];
      return StyleSheet.flatten(target.props.style).width;
    });
  expect(widths()).toEqual([36, 36]);
  await act(async () => {
    tree.update(<Quantity {...props} />);
  });
  expect(widths()).toEqual([44, 44]);
  await act(async () => {
    tree.update(<Quantity {...props} compact dock />);
  });
  for (const button of buttons(tree)) {
    const target = button.findAll(
      (node) => StyleSheet.flatten(node.props?.style)?.height === 50,
    )[0];
    expect(StyleSheet.flatten(target.props.style).width).toBe(44);
  }
  await act(async () => tree.unmount());
});

test("opening follows the revealed controls and stops following when the section closes", async () => {
  jest.useFakeTimers();
  const originalFrame = global.requestAnimationFrame;
  const originalCancel = global.cancelAnimationFrame;
  global.requestAnimationFrame = (callback) =>
    setTimeout(() => callback(performance.now()), 16);
  global.cancelAnimationFrame = (id) => clearTimeout(id);
  let tree;
  try {
    const onReveal = jest.fn();
    const props = {
      id: "reveal",
      title: "Bebida e acompanhamento",
      summary: "Opcional",
      onToggle: jest.fn(),
      onReveal,
    };
    await act(async () => {
      tree = create(
        <Section {...props} open={false}>
          <Text>Coca-Cola</Text>
        </Section>,
        {
          createNodeMock: () => ({
            measureInWindow: (callback) => callback(0, 700, 344, 150),
          }),
        },
      );
    });
    const clip = tree.root.findByProps({
      testID: "section-reveal-clip",
    }).instance;
    jest
      .spyOn(clip, "measureInWindow")
      .mockImplementation((callback) => callback(0, 700, 344, 150));
    await act(async () => buttons(tree)[0].props.onPress());
    await act(async () =>
      tree.update(
        <Section {...props} open>
          <Text>Coca-Cola</Text>
        </Section>,
      ),
    );
    await act(async () => jest.advanceTimersByTime(112));
    expect(onReveal).toHaveBeenCalledWith(
      { top: 700, height: 150 },
      false,
      false,
    );
    const calls = onReveal.mock.calls.length;
    await act(async () =>
      tree.update(
        <Section {...props} open={false}>
          <Text>Coca-Cola</Text>
        </Section>,
      ),
    );
    await act(async () => jest.advanceTimersByTime(500));
    expect(onReveal).toHaveBeenCalledTimes(calls);
  } finally {
    if (tree) await act(async () => tree.unmount());
    global.requestAnimationFrame = originalFrame;
    global.cancelAnimationFrame = originalCancel;
    jest.useRealTimers();
  }
});

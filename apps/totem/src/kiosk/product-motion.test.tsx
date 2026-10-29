import React, { useLayoutEffect } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { useProductMotion, type Measurable } from "./product-motion";
import { findProduct } from "./reference-model";

const node = (
  x: number,
  y: number,
  width: number,
  height: number,
): Measurable => ({
  measureInWindow: (callback) => callback(x, y, width, height),
});
let motion!: ReturnType<typeof useProductMotion>;
const root = { current: node(0, 34, 384, 783) };
function Harness({ reduced = false }: { reduced?: boolean }) {
  const current = useProductMotion("catalog", root, reduced);
  useLayoutEffect(() => {
    motion = current;
  }, [current]);
  return null;
}
let tree: ReactTestRenderer;
beforeEach(async () => {
  jest.useFakeTimers();
  await act(async () => {
    tree = create(<Harness />);
  });
});
afterEach(async () => {
  await act(async () => tree.unmount());
  jest.useRealTimers();
});

test("measures both product positions relative to the safe viewport and finishes only the current transition", async () => {
  motion.register("catalog:bacon", {
    node: node(220, 400, 130, 166),
    featured: true,
    detail: false,
  });
  const commit = jest.fn();
  await act(async () =>
    motion.navigate("product", findProduct("bacon"), commit),
  );
  expect(commit).toHaveBeenCalledTimes(1);
  expect(motion.transition?.from.rect).toEqual({
    x: 220,
    y: 366,
    width: 130,
    height: 166,
  });
  const target = node(20, 172, 112, 150);
  motion.register("product:bacon", {
    node: target,
    featured: false,
    detail: true,
  });
  await act(async () =>
    motion.reportTarget("product:bacon", target, motion.transition!.id),
  );
  expect(motion.transition?.to?.rect).toEqual({
    x: 20,
    y: 138,
    width: 112,
    height: 150,
  });
  await act(async () => motion.complete(-1));
  expect(motion.transition).not.toBeNull();
  await act(async () => motion.complete(motion.transition!.id));
  expect(motion.transition).toBeNull();
});

test("missing or unmeasurable art never blocks navigation", async () => {
  const commit = jest.fn();
  await act(async () =>
    motion.navigate("product", findProduct("bacon"), commit),
  );
  expect(commit).toHaveBeenCalledTimes(1);
  motion.register("catalog:bacon", {
    node: { measureInWindow: () => {} },
    featured: true,
    detail: false,
  });
  await act(async () =>
    motion.navigate("product", findProduct("bacon"), commit),
  );
  expect(commit).toHaveBeenCalledTimes(1);
  await act(async () => jest.advanceTimersByTime(120));
  expect(commit).toHaveBeenCalledTimes(2);
  expect(motion.transition).toBeNull();
});

test("an unavailable destination releases the retained source scene", async () => {
  motion.register("catalog:bacon", {
    node: node(220, 400, 130, 166),
    featured: true,
    detail: false,
  });
  await act(async () =>
    motion.navigate("product", findProduct("bacon"), jest.fn()),
  );
  expect(motion.transition).not.toBeNull();
  await act(async () => jest.advanceTimersByTime(900));
  expect(motion.transition).toBeNull();
});

test("a superseded measurement cannot navigate to an obsolete screen", async () => {
  let measured!: Parameters<Measurable["measureInWindow"]>[0];
  motion.register("catalog:bacon", {
    node: {
      measureInWindow: (callback) => {
        measured = callback;
      },
    },
    featured: true,
    detail: false,
  });
  const obsolete = jest.fn();
  const current = jest.fn();
  await act(async () =>
    motion.navigate("product", findProduct("bacon"), obsolete),
  );
  await act(async () => motion.navigate("cart", findProduct("bacon"), current));
  await act(async () => measured(20, 172, 112, 150));
  expect(obsolete).not.toHaveBeenCalled();
  expect(current).toHaveBeenCalledTimes(1);
  expect(motion.transition).toBeNull();
});

test("reduced motion navigates immediately without measuring or retaining a scene", async () => {
  await act(async () => tree.update(<Harness reduced />));
  const measure = jest.fn();
  motion.register("catalog:bacon", {
    node: { measureInWindow: measure },
    featured: true,
    detail: false,
  });
  const commit = jest.fn();
  await act(async () =>
    motion.navigate("product", findProduct("bacon"), commit),
  );
  expect(measure).not.toHaveBeenCalled();
  expect(commit).toHaveBeenCalledTimes(1);
  expect(motion.transition).toBeNull();
});

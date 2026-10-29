import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { Redirect } from "expo-router";
import Index from "../app/index";

jest.mock("expo-router", () => ({ Redirect: () => null }));

test.each([
  ["1", "/catalogo"],
  ["0", "/parear"],
] as const)(
  "preview flag %s selects entry %s without changing the paired entry",
  async (flag, route) => {
    const previous = process.env.EXPO_PUBLIC_KIOSK_PREVIEW;
    process.env.EXPO_PUBLIC_KIOSK_PREVIEW = flag;
    let tree: ReactTestRenderer | undefined;
    try {
      await act(async () => {
        tree = create(<Index />);
      });
      expect(tree!.root.findByType(Redirect).props.href).toBe(route);
    } finally {
      if (tree) await act(async () => tree!.unmount());
      if (previous === undefined) delete process.env.EXPO_PUBLIC_KIOSK_PREVIEW;
      else process.env.EXPO_PUBLIC_KIOSK_PREVIEW = previous;
    }
  },
);

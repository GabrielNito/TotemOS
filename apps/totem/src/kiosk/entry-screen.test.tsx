import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { Redirect } from "expo-router";
import Index from "../app/index";
import ParearScreen from "../app/parear";
import { PairingScreen } from "../components/pairing-screen";

jest.mock("expo-router", () => ({ Redirect: () => null }));
jest.mock("../components/pairing-screen", () => ({
  PairingScreen: () => null,
}));
jest.mock("../android-kiosk/guard", () => ({ AndroidKioskMode: () => null }));

test("inicia no catálogo, que valida a sessão antes de abrir o fluxo real", async () => {
  let tree!: ReactTestRenderer;
  try {
    await act(async () => {
      tree = create(<Index />);
    });
    expect(tree.root.findByType(Redirect).props.href).toBe("/catalogo");
  } finally {
    if (tree) await act(async () => tree.unmount());
  }
});

test.each(["1", "0"])(
  "rota de ativação respeita o ambiente %s",
  async (flag) => {
    const previous = process.env.EXPO_PUBLIC_KIOSK_PREVIEW;
    process.env.EXPO_PUBLIC_KIOSK_PREVIEW = flag;
    let tree!: ReactTestRenderer;
    try {
      await act(async () => {
        tree = create(<ParearScreen />);
      });
      if (flag === "1") {
        expect(tree.root.findByType(Redirect).props.href).toBe("/catalogo");
        expect(tree.root.findAllByType(PairingScreen)).toHaveLength(0);
      } else {
        expect(
          tree.root.findByType(PairingScreen).props.expectedDeviceType,
        ).toBe("TOTEM");
      }
    } finally {
      if (tree) await act(async () => tree.unmount());
      if (previous === undefined) delete process.env.EXPO_PUBLIC_KIOSK_PREVIEW;
      else process.env.EXPO_PUBLIC_KIOSK_PREVIEW = previous;
    }
  },
);

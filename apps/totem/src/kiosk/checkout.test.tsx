import React, { useState } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import {
  Keyboard,
  ScrollView,
  TextInput,
  type KeyboardEvent,
} from "react-native";
import { CheckoutScreen, type CheckoutIdentity } from "./checkout";

jest.mock("lucide-react-native", () => ({
  ArrowLeft: () => null,
  Check: () => null,
  CheckCheck: () => null,
  CircleCheck: () => null,
  ChevronRight: () => null,
  CreditCard: () => null,
  QrCode: () => null,
  Store: () => null,
}));
jest.mock("./motion", () => {
  const React = jest.requireActual("react");
  const View = jest.requireActual("react-native").View;
  const Passthrough = ({ children }: { children: React.ReactNode }) => (
    <View>{children}</View>
  );
  return { MotionSelection: Passthrough, MotionSuccess: Passthrough };
});
jest.mock("./ui", () => {
  const React = jest.requireActual("react");
  const { Pressable, Text, View } = jest.requireActual("react-native");
  return {
    KioskText: Text,
    BrandHeader: () => null,
    Dock: ({ children }: { children: React.ReactNode }) => (
      <View>{children}</View>
    ),
    Action: ({
      children,
      onPress,
      disabled,
    }: {
      children: React.ReactNode;
      onPress: () => void;
      disabled: boolean;
    }) => (
      <Pressable
        accessibilityLabel={children}
        onPress={onPress}
        disabled={disabled}
      >
        <Text>{children}</Text>
      </Pressable>
    ),
    colors: {},
  };
});

const items = [
  {
    key: "bacon",
    name: "Bacon Melt",
    quantity: 1,
    description: "2 carnes de 120 g",
    total: 39.8,
  },
];
const emptyIdentity: CheckoutIdentity = { name: "", cpf: "", wantsCpf: false };

test.each(["identification", "payment"] as const)(
  "the %s summary opens the selected item for editing without submitting payment",
  async (stage) => {
    const edit = jest.fn();
    const complete = jest.fn();
    let tree!: ReactTestRenderer;
    await act(async () => {
      tree = create(
        <CheckoutScreen
          stage={stage}
          items={items}
          total={39.8}
          identity={emptyIdentity}
          onIdentityChange={jest.fn()}
          onEditItem={edit}
          onComplete={complete}
          onBack={jest.fn()}
          onRestart={jest.fn()}
        />,
      );
    });
    try {
      await act(async () => button(tree, "Editar Bacon Melt").props.onPress());
      expect(edit).toHaveBeenCalledWith("bacon");
      expect(complete).not.toHaveBeenCalled();
    } finally {
      await act(async () => tree.unmount());
    }
  },
);

test("checkout preserves the configured item's savings and quantity in the summary", async () => {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(
      <CheckoutScreen
        stage="identification"
        items={[
          { ...items[0], quantity: 2, total: 79.6, originalUnitPrice: 43.8 },
        ]}
        total={79.6}
        identity={emptyIdentity}
        onIdentityChange={jest.fn()}
        onComplete={jest.fn()}
        onBack={jest.fn()}
        onRestart={jest.fn()}
      />,
    );
  });
  try {
    const output = JSON.stringify(tree.toJSON());
    expect(output).toContain("Você economiza");
    expect(output).toContain("8,00");
    expect(output).toContain("79,60");
  } finally {
    await act(async () => tree.unmount());
  }
});

test.each(["CODIGO", "OPCIONAL"] as const)(
  "real identification honors %s without requiring a customer name",
  async (mode) => {
    const complete = jest.fn();
    let tree!: ReactTestRenderer;
    await act(async () => {
      tree = create(
        <CheckoutScreen
          simulation={false}
          identificationMode={mode}
          stage="identification"
          total={39.8}
          items={items}
          identity={emptyIdentity}
          onIdentityChange={jest.fn()}
          onComplete={complete}
          onBack={jest.fn()}
          onRestart={jest.fn()}
        />,
      );
    });
    try {
      if (mode === "CODIGO")
        expect(tree.root.findAllByType(TextInput)).toHaveLength(0);
      await act(async () => button(tree, "Escolher pagamento").props.onPress());
      expect(complete).toHaveBeenCalledTimes(1);
    } finally {
      await act(async () => tree.unmount());
    }
  },
);

test("real checkout sends the selected method to its payment integration and never simulates approval", async () => {
  const onPayment = jest.fn();
  const complete = jest.fn();
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(
      <CheckoutScreen
        simulation={false}
        onPayment={onPayment}
        stage="payment"
        total={39.8}
        items={items}
        identity={{ ...emptyIdentity, name: "Nito" }}
        onIdentityChange={jest.fn()}
        onComplete={complete}
        onBack={jest.fn()}
        onRestart={jest.fn()}
      />,
    );
  });
  try {
    const radio = tree.root.findAll(
      (node) =>
        node.props.accessibilityRole === "radio" &&
        typeof node.props.onPress === "function",
    )[1];
    await act(async () => radio.props.onPress());
    await act(async () => button(tree, "Pagar").props.onPress());
    expect(onPayment).toHaveBeenCalledWith("pix");
    expect(complete).not.toHaveBeenCalled();
    expect(JSON.stringify(tree.toJSON())).not.toContain("SOMENTE SIMULAÇÃO");
  } finally {
    await act(async () => tree.unmount());
  }
});

test("real checkout without payment integration keeps the order and disables payment", async () => {
  const complete = jest.fn();
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(
      <CheckoutScreen
        simulation={false}
        stage="payment"
        total={39.8}
        items={items}
        identity={emptyIdentity}
        onIdentityChange={jest.fn()}
        onComplete={complete}
        onBack={jest.fn()}
        onRestart={jest.fn()}
      />,
    );
  });
  try {
    const radio = tree.root.findAll(
      (node) =>
        node.props.accessibilityRole === "radio" &&
        typeof node.props.onPress === "function",
    )[0];
    await act(async () => radio.props.onPress());
    expect(button(tree, "Pagar").props.disabled).toBe(true);
    await act(async () => button(tree, "Pagar").props.onPress());
    expect(complete).not.toHaveBeenCalled();
    expect(JSON.stringify(tree.toJSON())).toContain("Pagamento indisponível");
  } finally {
    await act(async () => tree.unmount());
  }
});

function button(tree: ReactTestRenderer, label: string) {
  return tree.root.findAll(
    (node) =>
      node.props.accessibilityLabel === label &&
      typeof node.props.onPress === "function",
  )[0];
}

test("identification requires a name and an optional complete CPF before advancing once", async () => {
  const complete = jest.fn();
  function Host() {
    const [identity, setIdentity] = useState(emptyIdentity);
    return (
      <CheckoutScreen
        stage="identification"
        total={39.8}
        items={items}
        identity={identity}
        onIdentityChange={setIdentity}
        onComplete={complete}
        onBack={() => {}}
        onRestart={() => {}}
      />
    );
  }
  let tree: ReactTestRenderer;
  await act(async () => {
    tree = create(<Host />);
  });
  await act(async () => button(tree!, "Escolher pagamento").props.onPress());
  expect(complete).not.toHaveBeenCalled();
  expect(JSON.stringify(tree!.toJSON())).toContain("Conte como podemos chamar");
  const field = (label: string) =>
    tree!.root
      .findAllByType(TextInput)
      .find((node) => node.props.accessibilityLabel === label)!;
  await act(async () =>
    field("Seu nome ou apelido").props.onChangeText(" Nito "),
  );
  await act(async () =>
    button(
      tree!,
      "Quero CPF na nota, opcional e demonstrativo",
    ).props.onPress(),
  );
  await act(async () => button(tree!, "Escolher pagamento").props.onPress());
  expect(complete).not.toHaveBeenCalled();
  expect(JSON.stringify(tree!.toJSON())).toContain("Informe os 11 dígitos");
  const cpf = tree!.root
    .findAllByType(TextInput)
    .find((node) => node.props.keyboardType === "number-pad")!;
  await act(async () => cpf.props.onChangeText("12345678901"));
  await act(async () => button(tree!, "Escolher pagamento").props.onPress());
  await act(async () => button(tree!, "Escolher pagamento").props.onPress());
  expect(complete).toHaveBeenCalledTimes(1);
  expect(field("Seu nome ou apelido").props.value).toBe("Nito");
  await act(async () => tree!.unmount());
});

test("returning from the cart restores identity instead of discarding the entered name and CPF", async () => {
  const identity = { name: "Nito", cpf: "12345678901", wantsCpf: true };
  let tree: ReactTestRenderer;
  await act(async () => {
    tree = create(
      <CheckoutScreen
        stage="identification"
        total={39.8}
        items={items}
        identity={identity}
        onIdentityChange={jest.fn()}
        onComplete={jest.fn()}
        onBack={jest.fn()}
        onRestart={jest.fn()}
      />,
    );
  });
  const fields = tree!.root.findAllByType(TextInput);
  expect(fields[0].props.value).toBe("Nito");
  expect(fields[1].props.value).toBe("12345678901");
  await act(async () => tree!.unmount());
});

test("hiding the optional CPF preserves the draft if it is enabled again", async () => {
  function Host() {
    const [identity, setIdentity] = useState({
      name: "Nito",
      cpf: "12345678901",
      wantsCpf: true,
    });
    return (
      <CheckoutScreen
        stage="identification"
        total={39.8}
        items={items}
        identity={identity}
        onIdentityChange={setIdentity}
        onComplete={jest.fn()}
        onBack={jest.fn()}
        onRestart={jest.fn()}
      />
    );
  }
  let tree: ReactTestRenderer;
  await act(async () => {
    tree = create(<Host />);
  });
  await act(async () =>
    button(
      tree!,
      "Quero CPF na nota, opcional e demonstrativo",
    ).props.onPress(),
  );
  expect(tree!.root.findAllByType(TextInput)).toHaveLength(1);
  await act(async () =>
    button(
      tree!,
      "Quero CPF na nota, opcional e demonstrativo",
    ).props.onPress(),
  );
  expect(tree!.root.findAllByType(TextInput)[1].props.value).toBe(
    "12345678901",
  );
  await act(async () => tree!.unmount());
});

test("closing the keyboard restores the scroll position from before field focus", async () => {
  jest.useFakeTimers();
  const listeners = jest.spyOn(Keyboard, "addListener");
  let tree: ReactTestRenderer | undefined;
  try {
    await act(async () => {
      tree = create(
        <CheckoutScreen
          stage="identification"
          total={39.8}
          items={items}
          identity={emptyIdentity}
          onIdentityChange={jest.fn()}
          onComplete={jest.fn()}
          onBack={jest.fn()}
          onRestart={jest.fn()}
        />,
      );
    });
    const show = listeners.mock.calls.find(
      ([event]) => event === "keyboardDidShow",
    )?.[1];
    const hide = listeners.mock.calls.find(
      ([event]) => event === "keyboardDidHide",
    )?.[1];
    expect(show).toBeDefined();
    expect(hide).toBeDefined();
    const scroll = tree!.root.findByType(ScrollView);
    const scrollTo = jest.spyOn(scroll.instance, "scrollTo");
    await act(async () =>
      scroll.props.onScroll({ nativeEvent: { contentOffset: { y: 72 } } }),
    );
    await act(async () =>
      tree!.root.findAllByType(TextInput)[0].props.onFocus(),
    );
    await act(async () => show!({} as KeyboardEvent));
    await act(async () =>
      scroll.props.onScroll({ nativeEvent: { contentOffset: { y: 210 } } }),
    );
    await act(async () => hide!({} as KeyboardEvent));
    await act(async () => jest.advanceTimersByTime(50));
    expect(scrollTo).toHaveBeenLastCalledWith({ y: 72, animated: false });
  } finally {
    if (tree) await act(async () => tree!.unmount());
    listeners.mockRestore();
    jest.useRealTimers();
  }
});

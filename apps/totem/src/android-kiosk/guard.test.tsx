import { fireEvent, render, screen } from "@testing-library/react-native";
import { useEffect } from "react";
import { requireOptionalNativeModule } from "expo";
import { AppState, BackHandler, Text } from "react-native";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { AndroidKioskGuard, AndroidKioskMode } from "./guard";

jest.mock("expo", () => ({ requireOptionalNativeModule: jest.fn() }));

const listenToAppState = jest.spyOn(AppState, "addEventListener");
beforeEach(() => {
  listenToAppState.mockClear().mockReturnValue({ remove: jest.fn() });
});

test("o Android é verificado antes de montar o fluxo real e Voltar é consumido na raiz", async () => {
  const listen = jest.spyOn(BackHandler, "addEventListener");
  let resolve!: (status: object) => void;
  const getStatus = jest.fn(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  const startManaged = jest.fn();
  jest
    .mocked(requireOptionalNativeModule)
    .mockReturnValue({ getStatus, startManaged });
  let tree!: ReactTestRenderer;
  try {
    await act(async () => {
      tree = create(
        <AndroidKioskGuard>
          <Text>Atendimento</Text>
        </AndroidKioskGuard>,
      );
    });
    expect(JSON.stringify(tree.toJSON())).not.toContain("Atendimento");
    expect(
      listen.mock.calls[0][1]({ type: "hardwareBackPress", timeStamp: 0 }),
    ).toBe(true);
    await act(async () =>
      resolve({ mode: "ordinary", managedPermitted: false }),
    );
    expect(JSON.stringify(tree.toJSON())).toContain("Atendimento");
    expect(startManaged).not.toHaveBeenCalled();
  } finally {
    if (tree) await act(async () => tree.unmount());
    listen.mockRestore();
  }
});

test("ao voltar do background, detecta a perda de Lock Task e preserva a tela montada", async () => {
  const getStatus = jest
    .fn()
    .mockResolvedValueOnce({ mode: "managed", managedPermitted: true })
    .mockResolvedValueOnce({ mode: "ordinary", managedPermitted: false });
  const startManaged = jest.fn();
  jest
    .mocked(requireOptionalNativeModule)
    .mockReturnValue({ getStatus, startManaged });
  const unmount = jest.fn();
  function OrderScreen() {
    useEffect(() => unmount, []);
    return <AndroidKioskMode />;
  }
  let tree!: ReactTestRenderer;
  try {
    await act(async () => {
      tree = create(
        <AndroidKioskGuard>
          <OrderScreen />
        </AndroidKioskGuard>,
      );
    });
    expect(JSON.stringify(tree.toJSON())).toContain(
      "Modo dedicado gerenciado ativo",
    );
    const change = listenToAppState.mock.calls.find(
      ([event]) => event === "change",
    )![1];
    await act(async () => change("background"));
    expect(JSON.stringify(tree.toJSON())).toContain("Verificando o terminal");
    await act(async () => change("active"));
    expect(JSON.stringify(tree.toJSON())).toContain("assistência");
    expect(JSON.stringify(tree.toJSON())).not.toContain(
      "Modo dedicado gerenciado ativo",
    );
    expect(unmount).not.toHaveBeenCalled();
    expect(startManaged).not.toHaveBeenCalled();
  } finally {
    if (tree) await act(async () => tree.unmount());
  }
});

test("só pede modo dedicado no botão de configuração após autorização do Android", async () => {
  const getStatus = jest
    .fn()
    .mockResolvedValue({ mode: "ordinary", managedPermitted: true });
  const startManaged = jest
    .fn()
    .mockResolvedValue({ mode: "managed", managedPermitted: true });
  jest
    .mocked(requireOptionalNativeModule)
    .mockReturnValue({ getStatus, startManaged });
  await render(
    <AndroidKioskGuard>
      <AndroidKioskMode setup />
    </AndroidKioskGuard>,
  );
  expect(startManaged).not.toHaveBeenCalled();
  await fireEvent.press(await screen.findByText("Iniciar modo dedicado"));
  expect(startManaged).toHaveBeenCalledTimes(1);
  expect(
    await screen.findByText("Modo dedicado gerenciado ativo"),
  ).toBeTruthy();
});

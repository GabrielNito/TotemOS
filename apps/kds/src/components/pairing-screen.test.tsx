import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import { PairingScreen } from "./pairing-screen";
import { pairDevice, restoreDeviceSession } from "../device-pairing/session";

const mockReplace = jest.fn();
const mockRouter = { replace: mockReplace };

jest.mock("expo-router", () => ({
  useRouter: () => mockRouter,
}));
jest.mock("../device-pairing/session", () => ({
  pairDevice: jest.fn(),
  restoreDeviceSession: jest.fn(),
}));

const mockedRestore = jest.mocked(restoreDeviceSession);
const mockedPair = jest.mocked(pairDevice);

beforeEach(() => {
  jest.clearAllMocks();
  mockedRestore.mockResolvedValue({ kind: "pairing", reason: "missing-token" });
  mockedPair.mockResolvedValue({
    kind: "error",
    message: "Falha de teste",
  });
});

it("uses the light operational KDS language and a glove-friendly action", async () => {
  render(
    <PairingScreen
      destination="/pedidos"
      expectedDeviceType="PAINEL"
      title="Parear KDS"
    />,
  );
  await act(async () => {
    await mockedRestore.mock.results[0]?.value;
  });

  expect(await screen.findByText("Conectar este painel")).toBeTruthy();
  expect(screen.getByText("TOTEMOS / PAREAR KDS")).toBeTruthy();
  expect(screen.getByText("Configuração inicial")).toBeTruthy();
  expect(screen.getByLabelText("Código de pareamento")).toBeTruthy();

  const action = screen.getByRole("button", { name: "Ativar painel" });
  expect(action.props.accessibilityState.disabled).toBe(true);
  expect(action.props.style).toEqual(
    expect.arrayContaining([expect.objectContaining({ minHeight: 56 })]),
  );
});

it("only submits a complete six-digit code", async () => {
  render(
    <PairingScreen
      destination="/pedidos"
      expectedDeviceType="PAINEL"
      title="Parear KDS"
    />,
  );
  await act(async () => {
    await mockedRestore.mock.results[0]?.value;
  });
  const input = await screen.findByLabelText("Código de pareamento");
  const action = screen.getByRole("button", { name: "Ativar painel" });

  fireEvent.changeText(input, "12a34567");
  expect(input.props.value).toBe("123456");
  fireEvent.press(action);

  await waitFor(() =>
    expect(mockedPair).toHaveBeenCalledWith("123456", {
      expectedDeviceType: "PAINEL",
    }),
  );
});

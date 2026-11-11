import { render, screen } from "@testing-library/react-native";

import PairingWebScreen from "../app/parear.web";
import OrdersWebScreen from "../app/pedidos.web";
import SpikeWebScreen from "../app/spike.web";

test.each([
  ["pareamento", PairingWebScreen],
  ["fila", OrdersWebScreen],
  ["diagnóstico LAN", SpikeWebScreen],
])("apresenta o requisito Android na rota web de %s", (_, Screen) => {
  render(<Screen />);
  expect(
    screen.getByText("Abra o TotemOS KDS em um dispositivo Android."),
  ).toBeTruthy();
  expect(screen.queryByLabelText("Código de pareamento")).toBeNull();
  expect(
    screen.queryByRole("button", { name: "Ativar dispositivo" }),
  ).toBeNull();
});

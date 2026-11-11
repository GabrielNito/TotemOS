import { checkKioskPolicy, startManagedKiosk } from "./policy";

const ordinary = { mode: "ordinary", managedPermitted: false } as const;
const permitted = { mode: "ordinary", managedPermitted: true } as const;

function bridge(status: unknown, started: unknown = status) {
  return {
    getStatus: jest.fn(async () => status),
    startManaged: jest.fn(async () => started),
  };
}

test("ausência da integração oferece fallback explícito", async () => {
  await expect(checkKioskPolicy(null)).resolves.toEqual({
    mode: "unsupported",
  });
});

test.each([ordinary, { mode: "pinned", managedPermitted: false } as const])(
  "reconhece $mode sem iniciar Lock Task",
  async (status) => {
    const native = bridge(status);
    await expect(checkKioskPolicy(native)).resolves.toEqual(status);
    await expect(startManagedKiosk(native)).resolves.toEqual({
      mode: "policy-error",
    });
    expect(native.startManaged).not.toHaveBeenCalled();
  },
);

test("autorização permite iniciar só com ação explícita e exige confirmação nativa", async () => {
  const native = bridge(permitted, { mode: "managed", managedPermitted: true });
  await expect(checkKioskPolicy(native)).resolves.toEqual(permitted);
  expect(native.startManaged).not.toHaveBeenCalled();
  await expect(startManagedKiosk(native)).resolves.toEqual({
    mode: "managed",
    managedPermitted: true,
  });
});

test.each([
  ordinary,
  { mode: "pinned", managedPermitted: false },
  { mode: "managed", managedPermitted: false },
])(
  "detecta divergência entre solicitação e estado retornado (%j)",
  async (status) => {
    await expect(startManagedKiosk(bridge(permitted, status))).resolves.toEqual(
      { mode: "policy-error" },
    );
  },
);

test("falhas e respostas inesperadas são tratadas sem alegar proteção", async () => {
  const native = bridge({ mode: "unknown" });
  await expect(checkKioskPolicy(native)).resolves.toEqual({
    mode: "native-error",
  });
  native.getStatus.mockRejectedValueOnce(new Error("private native message"));
  await expect(checkKioskPolicy(native)).resolves.toEqual({
    mode: "native-error",
  });
});

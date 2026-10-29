// Local, read-only fault injection for the physical device audit. Never deployed.
const http = require("node:http");
const fs = require("node:fs");

const origin = process.env.CATALOG_AUDIT_UPSTREAM || "http://127.0.0.1:3001";
const port = Number(process.env.CATALOG_AUDIT_PORT || 3036);
const controlFile = process.env.CATALOG_AUDIT_CONTROL;
const eventsFile = process.env.CATALOG_AUDIT_EVENTS;
if (!controlFile || !eventsFile)
  throw new Error("Audit control and events files are required");
let lastControl = { mode: "passthrough" };
let tenant;
const events = [];
function control() {
  try {
    lastControl = JSON.parse(
      fs.readFileSync(controlFile, "utf8").replace(/^\uFEFF/, ""),
    );
  } catch {
    /* Keep the last complete control value while a file is being replaced. */
  }
  return lastControl;
}
function record(event) {
  events.push({ at: new Date().toISOString(), ...event });
  fs.writeFileSync(eventsFile, JSON.stringify(events.slice(-200), null, 2));
}
function availability(catalog) {
  const first = catalog.find((category) => category.produtos?.length);
  if (!first) throw new Error("The availability audit needs a real product");
  const product = first.produtos[0];
  const hidden = {
    ...product,
    id: "audit-hidden",
    nome: "Produto indisponível auditoria",
  };
  first.produtos.push(
    { ...hidden, ativo: false },
    { ...hidden, id: "audit-sold", esgotado: true },
  );
  product.variacoes = [
    ...(product.variacoes || []),
    {
      id: "audit-variation",
      nome: "Opção esgotada auditoria",
      preco: 99,
      esgotado: true,
    },
  ];
  product.adicionais = [
    ...(product.adicionais || []),
    {
      id: "audit-extra",
      nome: "Adicional esgotado auditoria",
      preco: 9,
      maximo: 1,
      esgotado: true,
    },
  ];
  catalog.push({
    id: "audit-category",
    nome: "Categoria inativa auditoria",
    ativo: false,
    produtos: [product],
  });
  return catalog;
}

http
  .createServer(async (request, response) => {
    const url = new URL(request.url, origin);
    const isSession = url.pathname === "/dispositivos/me";
    const isCatalog = url.pathname.startsWith("/catalogo/publico/");
    const send = (status, body) => {
      response.writeHead(status, { "content-type": "application/json" });
      response.end(JSON.stringify(body));
    };
    if (
      request.method !== "GET" ||
      url.origin !== origin ||
      (!isSession && !isCatalog)
    )
      return send(405, { message: "Read-only audit gateway" });
    if (
      isCatalog &&
      (!tenant ||
        decodeURIComponent(url.pathname.slice("/catalogo/publico/".length)) !==
          tenant)
    )
      return send(403, { message: "Audit tenant mismatch" });
    let mode = isCatalog ? control().mode : "passthrough";
    record({ path: url.pathname, mode, phase: "request" });
    if (mode === "loading") {
      const deadline = Date.now() + 60000;
      while (
        control().mode === "loading" &&
        Date.now() < deadline &&
        !response.destroyed
      )
        await new Promise((resolve) => setTimeout(resolve, 100));
      if (response.destroyed) return;
      mode = control().mode;
    }
    if (mode === "network-error") return response.destroy();
    if (mode === "http-error")
      return send(503, { message: "Injected catalog failure" });
    if (mode === "empty") return send(200, []);
    if (mode === "invalid") return send(200, { invalid: true });
    try {
      const upstream = await fetch(url, {
        headers: {
          accept: "application/json",
          authorization: request.headers.authorization || "",
        },
        signal: AbortSignal.timeout(10000),
      });
      let body = await upstream.json();
      if (isSession) {
        if (!upstream.ok || body.dispositivo?.tipo !== "TOTEM")
          return send(503, { message: "Audit session unavailable" });
        tenant = body.dispositivo.negocioId;
      }
      if (mode === "availability" && upstream.ok) body = availability(body);
      record({ path: url.pathname, mode, status: upstream.status });
      send(upstream.status, body);
    } catch {
      send(503, { message: "Audit upstream unavailable" });
    }
  })
  .listen(port, "127.0.0.1", () =>
    process.stdout.write(`Catalog audit gateway listening on ${port}\n`),
  );

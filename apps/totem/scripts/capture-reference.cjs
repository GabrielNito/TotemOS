// Capture the real preview at the A54 content viewport, after transitions settle.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const path = require("node:path");
const fs = require("node:fs");

async function main() {
  const output = path.resolve(process.argv[2] || "visual-audit/reference");
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    const page = await browser.newPage({
      viewport: { width: 384, height: 783 },
      deviceScaleFactor: 2.8125,
      isMobile: true,
      hasTouch: true,
      recordVideo: process.argv.includes("--video")
        ? { dir: output, size: { width: 384, height: 783 } }
        : undefined,
    });
    await page.goto("https://totemos-kiosk-preview.vercel.app/v2");
    const capture = async (name, dismissNotice = true) => {
      await page.waitForTimeout(650);
      const noticeClose = page.getByRole("button", {
        name: "Fechar aviso",
        exact: true,
      });
      if (dismissNotice && (await noticeClose.last().isVisible())) {
        await noticeClose.last().click();
        await page.waitForTimeout(250);
      }
      await page.screenshot({ path: path.join(output, `${name}.png`) });
    };
    await capture("01-standby");
    await page
      .getByRole("button", { name: "Toque para começar o pedido", exact: true })
      .click();
    await capture("02-catalog");
    await page
      .getByRole("button")
      .filter({ hasText: "BACON MELT" })
      .first()
      .click();
    await capture("03-product");
    await page.getByRole("radio").filter({ hasText: "Duplo" }).click();
    await capture("04-product-selected");
    await page
      .getByRole("button", { name: "Adicionar ao pedido", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Ver pedido", exact: true })
      .first()
      .click();
    await capture("05-cart");
    await page
      .getByRole("button", { name: "Identificar pedido", exact: true })
      .click();
    await capture("06-identification");
    await page.getByLabel("Seu nome ou apelido", { exact: false }).fill("Nito");
    await page
      .getByRole("button", { name: "Escolher pagamento", exact: true })
      .click();
    await capture("07-payment");
    await page.getByRole("radio").filter({ hasText: "Cartão" }).click();
    await page
      .getByRole("button", { name: "Simular pagamento", exact: true })
      .click();
    await capture("08-confirmation");
    if (process.argv.includes("--extended")) {
      const click = (name) =>
        page.getByRole("button", { name, exact: true }).click();
      await click("Começar novo pedido");
      await click("Retirar no balcão");
      await capture("09-context");
      await click("Fechar");
      await click("Combos");
      await capture("10-combos");
      const combo = () =>
        page
          .getByRole("button")
          .filter({ hasText: "Combo Bacon Melt" })
          .first();
      await combo().click();
      await capture("11-combo-product");
      await click("Voltar ao cardápio");
      await combo().click();
      await click("Aumentar Combo Bacon Melt");
      await click("Adicionar ao pedido");
      await page
        .getByRole("button", { name: "Ver pedido", exact: true })
        .first()
        .click();
      await capture("12-combo-cart");
      await click("Remover Combo Bacon Melt");
      await capture("13-removal-dialog");
      await click("Manter item");
      await click("Remover Combo Bacon Melt");
      await click("Remover item");
      await capture("14-empty-cart", false);
      await click("Desfazer");
      await capture("15-restored-cart");
      await click("Identificar pedido");
      await page
        .getByLabel("Seu nome ou apelido", { exact: false })
        .fill("Nito");
      await page.getByRole("checkbox").check();
      await click("Escolher pagamento");
      await capture("16-invalid-cpf");
      await page.getByRole("checkbox").uncheck();
      await click("Voltar");
      await click("Identificar pedido");
      if (
        (await page
          .getByLabel("Seu nome ou apelido", { exact: false })
          .inputValue()) !== "Nito"
      )
        throw new Error("Identity was lost after returning to cart");
      await click("Escolher pagamento");
      await page.getByRole("radio").filter({ hasText: "Pix" }).click();
      await capture("17-pix-selected");
      await click("Retirar no balcão");
      await page
        .getByRole("button")
        .filter({ hasText: "Tablet · mesa 12" })
        .click();
      await capture("18-table-cart");
      await click("Enviar pedido à mesa 12");
      await capture("19-table-confirmation");
      await click("Voltar ao cardápio");
      await click("Tablet · mesa 12");
      await page
        .getByRole("button")
        .filter({ hasText: "QR Code · mesa 12" })
        .click();
      await click("Todos");
      await click("Bebidas");
      await capture("20-beverages");
      await page
        .getByRole("button")
        .filter({ hasText: "Coca-Cola" })
        .first()
        .click();
      await capture("21-simple-product");
      await click("Aumentar Coca-Cola");
      await click("Aumentar Coca-Cola");
      await click("Adicionar ao pedido");
      await page
        .getByRole("button", { name: "Ver pedido", exact: true })
        .first()
        .click();
      await capture("22-qr-cart");
      await click("Enviar pedido à mesa 12");
      await capture("23-qr-confirmation");
      await click("Voltar ao cardápio");
      await click("QR Code · mesa 12");
      await click("Ver tela de espera");
      await capture("24-qr-standby");
      await click("Toque para começar o pedido");
      await click("QR Code · mesa 12");
      await page
        .getByRole("button")
        .filter({ hasText: "Retirar no balcão" })
        .click();
      await click("Todos");
      await page
        .getByRole("button")
        .filter({ hasText: "BACON MELT" })
        .first()
        .click();
      await page.getByRole("radio").filter({ hasText: "Duplo" }).click();
      const section = (title) =>
        page.getByRole("button").filter({ hasText: title }).first();
      await section("Retirar ingredientes").click();
      await capture("25-remove-open");
      await page.getByRole("checkbox", { name: "Bacon", exact: true }).check();
      await capture("26-remove-selected");
      await section("Retirar ingredientes").click();
      await section("Adicionais").click();
      await capture("27-extras-open");
      await click("Aumentar Bacon extra");
      await click("Aumentar Bacon extra");
      await capture("28-extras-selected");
      await section("Adicionais").click();
      await section("Bebida e acompanhamento").click();
      await capture("29-pairing-open");
      await page.getByRole("checkbox", { name: /Coca-Cola/ }).check();
      await page.getByRole("checkbox", { name: /Batata/ }).check();
      await capture("30-pairing-selected");
      await click("Adicionar ao pedido");
      await page
        .getByRole("button", { name: "Ver pedido", exact: true })
        .first()
        .click();
      await capture("31-custom-cart");
      await page.getByRole("button").filter({ hasText: "Editar" }).click();
      await capture("32-edit-product");
      await page.getByRole("radio").filter({ hasText: "Triplo" }).click();
      await click("Salvar alterações");
      await capture("33-edited-cart");
      await click("Aumentar Bacon Melt");
      await capture("34-quantity-cart");
      if (process.argv.includes("--idle")) {
        await click("Remover Bacon Melt");
        await page.waitForTimeout(31000);
        await page.waitForTimeout(31000);
        await capture("35-removal-after-idle");
        await click("Manter item");
        await capture("36-cart-after-dialog");
        await page.waitForTimeout(31000);
        await page.waitForTimeout(31000);
        await capture("37-idle-standby");
        await click("Toque para continuar o pedido");
        await capture("38-resumed-cart");
      }
    }
    const video = page.video();
    if (video) {
      await page.close();
      await video.saveAs(path.join(output, "reference-motion.webm"));
    }
    console.log(`Reference captures saved to ${output}`);
  } finally {
    await browser.close();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

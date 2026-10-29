const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const fs = require("node:fs");
const path = require("node:path");

async function main() {
  const output = path.resolve(process.argv[2]);
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    const page = await browser.newPage({
      viewport: { width: 384, height: 783 },
      deviceScaleFactor: 2.8125,
      isMobile: true,
      hasTouch: true,
      recordVideo: { dir: output, size: { width: 384, height: 783 } },
    });
    const button = (name) => page.getByRole("button", { name, exact: true });
    const closeNotice = async () => {
      const close = button("Fechar aviso");
      if (await close.count()) await close.last().click();
      await page.waitForTimeout(250);
    };
    const capture = async (name) => {
      await page.waitForTimeout(650);
      await page.screenshot({ path: path.join(output, `${name}.png`) });
    };
    await page.goto("https://totemos-kiosk-preview.vercel.app/v2");
    await button("Toque para começar o pedido").click();
    await page
      .getByRole("button")
      .filter({ hasText: "BACON MELT" })
      .first()
      .click();
    await page.getByRole("radio").filter({ hasText: "Duplo" }).click();
    await button("Adicionar ao pedido").click();
    await closeNotice();
    await page
      .getByRole("button")
      .filter({ hasText: "Smash Clássico" })
      .first()
      .click();
    await page.getByRole("radio").filter({ hasText: "Simples" }).click();
    await button("Adicionar ao pedido").click();
    await closeNotice();
    await button("Ver pedido").first().click();
    await button("Retirar no balcão").click();
    await page
      .getByRole("dialog")
      .getByRole("button")
      .filter({ hasText: "QR Code" })
      .click();
    await capture("49-mixed-cart-before-restart");
    await page.reload();
    await button("Toque para continuar o pedido").click();
    await capture("50-mixed-cart-after-restart");
    await button("Remover Smash Clássico").click();
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: "Remover item", exact: true })
      .click();
    await button("Desfazer").click();
    await closeNotice();
    await capture("51-mixed-cart-after-undo");
    await button("Remover Smash Clássico").click();
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: "Remover item", exact: true })
      .click();
    await closeNotice();
    await capture("52-mixed-cart-after-removal");
    const video = page.video();
    await page.close();
    await video.saveAs(path.join(output, "reference-cart-motion.webm"));
    console.log("Reference mixed-cart persistence and removal captured.");
  } finally {
    await browser.close();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

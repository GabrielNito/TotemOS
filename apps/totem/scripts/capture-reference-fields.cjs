const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const path = require("node:path");
const fs = require("node:fs");

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
    });
    // Same configured demo order produced by the physical customization audit.
    await page.addInitScript(() =>
      sessionStorage.setItem(
        "totemos-v2",
        JSON.stringify({
          mode: "counter",
          cart: [
            {
              key: "field-audit",
              productId: "bacon",
              quantity: 2,
              configuration: {
                patties: 3,
                removed: ["Bacon"],
                extras: { bacon: 2 },
                drink: true,
                side: true,
              },
            },
          ],
        }),
      ),
    );
    await page.goto(
      "https://totemos-kiosk-preview.vercel.app/v2?screen=identification",
    );
    await page.evaluate(() => document.fonts.ready);
    await page
      .getByRole("button", { name: "Toque para continuar o pedido" })
      .click();
    const capture = async (name) => {
      await page.waitForTimeout(650);
      await page.screenshot({ path: path.join(output, `${name}.png`) });
    };
    await capture("53-identification-empty");
    await page.getByPlaceholder("Ex.: Gabriel", { exact: true }).fill("Nito");
    await capture("54-name-focused");
    await page.getByRole("checkbox", { name: /Quero CPF/ }).check();
    await page.locator("#v2-cpf").focus();
    await capture("55-cpf-focused");
    console.log(
      "Reference input states captured with the configured demo order.",
    );
  } finally {
    await browser.close();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

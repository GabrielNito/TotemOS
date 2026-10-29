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
    });
    await page.goto("https://totemos-kiosk-preview.vercel.app/v2");
    await page
      .getByRole("button", { name: "Toque para começar o pedido" })
      .click();
    const cases = [
      ["Smash Clássico", "Lanches", "39-smash-product"],
      ["Chicken Crispy", "Lanches", "40-chicken-product"],
      ["Double Cheddar", "Lanches", "41-double-product"],
      ["Combo Smash", "Combos", "42-combo-smash-product"],
      ["Combo Chicken", "Combos", "43-combo-chicken-product"],
      ["Batata Rústica", "Porções", "45-potato-product"],
      ["Onion Rings", "Porções", "46-onion-product"],
    ];
    const capture = async (name) => {
      await page.waitForTimeout(700);
      await page.screenshot({ path: path.join(output, `${name}.png`) });
    };
    let category = "Todos";
    for (const [name, nextCategory, file] of cases) {
      if (category !== nextCategory) {
        await page
          .getByRole("button", { name: nextCategory, exact: true })
          .click();
        category = nextCategory;
      }
      await page.evaluate(() =>
        window.scrollTo({ top: 0, behavior: "instant" }),
      );
      if (file === "45-potato-product") await capture("44-portions");
      await page.getByRole("button").filter({ hasText: name }).first().click();
      await capture(file);
      await page
        .getByRole("button", { name: "Voltar ao cardápio", exact: true })
        .click();
    }
    console.log(`Remaining reference products captured: ${output}`);
  } finally {
    await browser.close();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

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
      recordVideo: { dir: output, size: { width: 384, height: 783 } },
    });
    await page.goto("https://totemos-kiosk-preview.vercel.app/v2");
    await page
      .getByRole("button", { name: "Toque para começar o pedido" })
      .click();
    await page.waitForTimeout(700);
    for (let attempt = 0; attempt < 2; attempt++) {
      await page
        .getByRole("button")
        .filter({ hasText: "BACON MELT" })
        .first()
        .click();
      await page.waitForTimeout(700);
      await page
        .getByRole("button", { name: "Voltar ao cardápio", exact: true })
        .click();
      await page.waitForTimeout(700);
    }
    const video = page.video();
    await page.close();
    await video.saveAs(path.join(output, "reference-transition.webm"));
    console.log("Reference product transitions recorded.");
  } finally {
    await browser.close();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

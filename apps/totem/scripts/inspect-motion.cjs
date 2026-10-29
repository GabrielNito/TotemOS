// Decode recorded evidence with Chrome; no capture is rendered by the app.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const sharp = require(process.env.SHARP_MODULE || "sharp");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

async function main() {
  const [videoFile, outputDirectory, ...requestedTimes] = process.argv.slice(2);
  if (!videoFile || !outputDirectory)
    throw new Error("Usage: inspect-motion.cjs <video> <output> [seconds...]");
  const output = path.resolve(outputDirectory);
  fs.mkdirSync(output, { recursive: true });
  const player = path.join(output, "player.html");
  fs.writeFileSync(
    player,
    `<html><style>body{margin:0}video{display:block}</style><video muted preload="auto" src="${pathToFileURL(path.resolve(videoFile)).href}"></video></html>`,
  );
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(pathToFileURL(player).href);
    await page.waitForFunction(
      () => document.querySelector("video").readyState >= 2,
    );
    const video = page.locator("video");
    const metadata = await video.evaluate((element) => ({
      duration: element.duration,
      width: element.videoWidth,
      height: element.videoHeight,
    }));
    await page.setViewportSize({
      width: metadata.width,
      height: metadata.height,
    });
    await video.evaluate((element) => {
      element.style.width = `${element.videoWidth}px`;
      element.style.height = `${element.videoHeight}px`;
    });
    const times = requestedTimes.length
      ? requestedTimes.map(Number)
      : Array.from(
          { length: Math.ceil(metadata.duration / 2) },
          (_, index) => index * 2,
        );
    const tiles = [];
    for (let index = 0; index < times.length; index++) {
      const time = Math.min(times[index], metadata.duration - 0.05);
      await video.evaluate(
        (element, target) =>
          new Promise((resolve) => {
            if (
              Math.abs(element.currentTime - target) < 0.01 &&
              element.readyState >= 2
            )
              return resolve();
            element.addEventListener("seeked", resolve, { once: true });
            element.currentTime = target;
          }),
        time,
      );
      await page.waitForTimeout(80);
      const frame = await video.screenshot();
      const input = sharp(frame);
      const normalized = await (
        metadata.width === 1080 && metadata.height === 2340
          ? input.extract({ left: 0, top: 95, width: 1080, height: 2203 })
          : input
      )
        .resize(384, 783)
        .png()
        .toBuffer();
      const filename = `frame-${time.toFixed(3)}.png`;
      fs.writeFileSync(path.join(output, filename), normalized);
      const label = Buffer.from(
        `<svg width="192" height="24"><rect width="192" height="24" fill="#fff"/><text x="8" y="17" font-family="Arial" font-size="13">${time.toFixed(3)} s</text></svg>`,
      );
      const thumbnail = await sharp(normalized)
        .resize(192, 391)
        .png()
        .toBuffer();
      const tile = await sharp({
        create: { width: 192, height: 415, channels: 3, background: "#fff" },
      })
        .composite([
          { input: label, left: 0, top: 0 },
          { input: thumbnail, left: 0, top: 24 },
        ])
        .png()
        .toBuffer();
      tiles.push({
        input: tile,
        left: (index % 8) * 192,
        top: Math.floor(index / 8) * 415,
      });
    }
    await sharp({
      create: {
        width: 1536,
        height: Math.ceil(times.length / 8) * 415,
        channels: 3,
        background: "#ddd",
      },
    })
      .composite(tiles)
      .png()
      .toFile(path.join(output, "contact-sheet.png"));
    fs.writeFileSync(
      path.join(output, "video.json"),
      JSON.stringify({ ...metadata, times }, null, 2),
    );
    console.log(JSON.stringify(metadata));
  } finally {
    await browser.close();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

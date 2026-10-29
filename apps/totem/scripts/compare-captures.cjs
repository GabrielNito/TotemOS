// Evidence only: never imported by the application.
const sharp = require(process.env.SHARP_MODULE || "sharp");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

async function main() {
  const [reference, native, output] = process.argv
    .slice(2)
    .map((value) => path.resolve(value));
  if (!reference || !native || !output)
    throw new Error(
      "Usage: compare-captures.cjs <reference> <native> <output>",
    );
  fs.mkdirSync(output, { recursive: true });
  const report = {
    generatedAt: new Date().toISOString(),
    columns: ["Reference V2", "Native A54"],
    nativeCrop: { left: 0, top: 95, width: 1080, height: 2203 },
    viewport: { width: 384, height: 783 },
    comparisons: [],
    missingNative: [],
  };
  const names = fs
    .readdirSync(reference)
    .filter((name) => name.endsWith(".png"))
    .sort();
  for (const name of names) {
    const nativePath = path.join(native, name);
    if (!fs.existsSync(nativePath)) {
      report.missingNative.push(name);
      continue;
    }
    const referencePath = path.join(reference, name);
    const meta = await sharp(nativePath).metadata();
    if (meta.width !== 1080 || meta.height !== 2340)
      throw new Error(`Unexpected device resolution: ${name}`);
    const left = await sharp(referencePath).resize(384, 783).png().toBuffer();
    const right = await sharp(nativePath)
      .extract(report.nativeCrop)
      .resize(384, 783)
      .png()
      .toBuffer();
    const caption = Buffer.from(
      '<svg width="768" height="32"><rect width="768" height="32" fill="#fff"/><g font-family="Arial" font-size="14" fill="#222"><text x="12" y="22">Reference V2</text><text x="396" y="22">Native A54</text></g></svg>',
    );
    await sharp({
      create: { width: 768, height: 815, channels: 3, background: "#fff" },
    })
      .composite([
        { input: caption, left: 0, top: 0 },
        { input: left, left: 0, top: 32 },
        { input: right, left: 384, top: 32 },
      ])
      .png()
      .toFile(path.join(output, name));
    const hash = (file) =>
      crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
    report.comparisons.push({
      file: name,
      referenceSha256: hash(referencePath),
      nativeSha256: hash(nativePath),
    });
  }
  fs.writeFileSync(
    path.join(output, "captures.json"),
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(
    `${report.comparisons.length} comparisons written; ${report.missingNative.length} native captures missing`,
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

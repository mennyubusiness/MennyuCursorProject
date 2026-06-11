import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const src =
  process.argv[2] ?? "C:/Users/Sam/Downloads/Open Order Co. (1).svg";
const brandDir = path.join(process.cwd(), "public/brand/open-order");
const svgDest = path.join(brandDir, "open-order-mark.svg");
const pngDest = path.join(brandDir, "open-order-mark.png");
const iconDest = path.join(process.cwd(), "src/app/icon.png");
const appleIconDest = path.join(process.cwd(), "src/app/apple-icon.png");

let svgRaw = fs.readFileSync(src, "utf8");

// Drop full-canvas export backgrounds only (keep the inner cream circle fill).
svgRaw = svgRaw
  .replace(/<rect[^>]*fill="#ffffff"[^>]*\/>/gi, "")
  .replace(/<rect x="-1092" width="5184" fill="#e7e0d6"[^>]*\/>/g, "");

const viewBoxMatch = svgRaw.match(/viewBox="([^"]+)"/);
if (!viewBoxMatch) throw new Error("viewBox not found");

const [, , vbW, vbH] = viewBoxMatch[1].split(/\s+/).map(Number);
const renderWidth = Math.round(vbW);
const renderHeight = Math.round(vbH);

const png = await sharp(Buffer.from(svgRaw), { density: 144 })
  .resize(renderWidth, renderHeight, { fit: "fill" })
  .png()
  .toBuffer();

const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

let minX = info.width;
let minY = info.height;
let maxX = 0;
let maxY = 0;

for (let y = 0; y < info.height; y++) {
  for (let x = 0; x < info.width; x++) {
    const alpha = data[(y * info.width + x) * 4 + 3];
    if (alpha > 12) {
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
}

const pad = 24;
const cropX = Math.max(0, minX - pad);
const cropY = Math.max(0, minY - pad);
const cropW = Math.min(info.width - cropX, maxX - minX + 1 + pad * 2);
const cropH = Math.min(info.height - cropY, maxY - minY + 1 + pad * 2);

const scaleX = vbW / info.width;
const scaleY = vbH / info.height;
const newViewBox = [
  Math.round(cropX * scaleX),
  Math.round(cropY * scaleY),
  Math.round(cropW * scaleX),
  Math.round(cropH * scaleY),
].join(" ");

let outSvg = svgRaw
  .replace(/viewBox="[^"]+"/, `viewBox="${newViewBox}"`)
  .replace(/\swidth="[^"]+"/, "")
  .replace(/\sheight="[^"]+"/, "")
  .replace(/\szoomAndPan="[^"]+"/, "")
  .replace(/\spreserveAspectRatio="[^"]+"/, ' preserveAspectRatio="xMidYMid meet"');

fs.mkdirSync(brandDir, { recursive: true });
fs.writeFileSync(svgDest, outSvg);

const croppedPng = await sharp(Buffer.from(outSvg), { density: 192 })
  .resize(1024, 1024, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toBuffer();

fs.writeFileSync(pngDest, croppedPng);
fs.writeFileSync(iconDest, croppedPng);
fs.writeFileSync(appleIconDest, croppedPng);

const verify = await sharp(pngDest).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
let transparent = 0;
for (let i = 3; i < verify.data.length; i += 4) {
  if (verify.data[i] < 20) transparent++;
}
const transparentPct = (100 * transparent) / (verify.info.width * verify.info.height);

console.log(
  JSON.stringify(
    {
      svgDest,
      pngDest,
      iconDest,
      croppedViewBox: newViewBox,
      intrinsic: {
        width: Math.round(cropW * scaleX),
        height: Math.round(cropH * scaleY),
      },
      transparentBackgroundPct: Number(transparentPct.toFixed(1)),
    },
    null,
    2
  )
);

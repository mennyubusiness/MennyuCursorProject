import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const src = process.argv[2] ?? "C:/Users/Sam/Downloads/Open Order Co. (8).svg";
const dest =
  process.argv[3] ??
  path.join(process.cwd(), "public/brand/open-order/open-order-horizontal.svg");

const svgRaw = fs.readFileSync(src, "utf8");
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

const padX = 6;
const padY = 4;
const cropX = Math.max(0, minX - padX);
const cropY = Math.max(0, minY - padY);
const cropW = Math.min(info.width - cropX, maxX - minX + 1 + padX * 2);
const cropH = Math.min(info.height - cropY, maxY - minY + 1 + padY * 2);

const scaleX = vbW / info.width;
const scaleY = vbH / info.height;
const newViewBox = [
  Math.round(cropX * scaleX),
  Math.round(cropY * scaleY),
  Math.round(cropW * scaleX),
  Math.round(cropH * scaleY),
].join(" ");

let out = svgRaw
  .replace(/viewBox="[^"]+"/, `viewBox="${newViewBox}"`)
  .replace(/\swidth="[^"]+"/, "")
  .replace(/\sheight="[^"]+"/, "")
  .replace(/\szoomAndPan="[^"]+"/, "")
  .replace(/\spreserveAspectRatio="[^"]+"/, ' preserveAspectRatio="xMidYMid meet"');

fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.writeFileSync(dest, out);

console.log(
  JSON.stringify(
    {
      dest,
      originalViewBox: viewBoxMatch[1],
      croppedViewBox: newViewBox,
      cropWidth: Math.round(cropW * scaleX),
      cropHeight: Math.round(cropH * scaleY),
    },
    null,
    2
  )
);

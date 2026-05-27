/**
 * One-off styling pass: map zinc/stone dashboard neutrals to Open Order warm tokens.
 * Run: node scripts/migrate-dashboard-palette.mjs
 */
import fs from "fs";
import path from "path";

import { fileURLToPath } from "url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const TARGET_DIRS = [
  "src/app/admin",
  "src/app/vendor",
  "src/components/admin",
];

const POD_SEGMENTS = ["/dashboard/", "/settings/", "/analytics/"];

function shouldIncludePodFile(filePath) {
  const norm = filePath.replace(/\\/g, "/");
  if (!norm.includes("/pod/")) return false;
  return POD_SEGMENTS.some((seg) => norm.includes(seg));
}

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) {
      if (full.includes(`${path.sep}pod${path.sep}`) && name === "vendor") continue;
      walk(full, acc);
    } else if (/\.(tsx|ts)$/.test(name)) {
      acc.push(full);
    }
  }
  return acc;
}

const podRoot = path.join(root, "src/app/pod");
const podFiles = walk(podRoot).filter(shouldIncludePodFile);

const files = [...new Set([...TARGET_DIRS.flatMap((d) => walk(path.join(root, d))), ...podFiles])];

const replacements = [
  [/hover:bg-stone-900/g, "hover:bg-brand-hover"],
  [/hover:bg-stone-800/g, "hover:bg-brand-hover"],
  [/bg-stone-900 text-white/g, "bg-brand text-white"],
  [/bg-stone-800 text-white/g, "bg-brand text-white"],
  [/bg-stone-900 px/g, "bg-brand px"],
  [/bg-stone-800 px/g, "bg-brand px"],
  [/bg-zinc-100/g, "bg-oo-cream"],
  [/bg-stone-50/g, "bg-oo-cream"],
  [/hover:bg-stone-50\/80/g, "hover:bg-oo-cream/80"],
  [/hover:bg-stone-50/g, "hover:bg-oo-cream"],
  [/hover:bg-stone-100/g, "hover:bg-oo-cream"],
  [/bg-stone-100/g, "bg-oo-cream"],
  [/text-stone-900/g, "text-oo-charcoal"],
  [/text-stone-800/g, "text-oo-charcoal"],
  [/text-stone-700/g, "text-oo-charcoal"],
  [/text-stone-600/g, "text-oo-stone-gray"],
  [/text-stone-500/g, "text-oo-stone-gray"],
  [/text-stone-400/g, "text-oo-stone-gray"],
  [/border-stone-300/g, "border-oo-light-stone"],
  [/border-stone-200/g, "border-oo-light-stone"],
  [/border-stone-100/g, "border-oo-light-stone"],
  [/divide-stone-200/g, "divide-oo-light-stone"],
  [/divide-stone-100/g, "divide-oo-light-stone"],
  [/hover:border-stone-300/g, "hover:border-oo-stone-gray/40"],
  [/ring-stone-400/g, "ring-brand/30"],
  [/focus:ring-stone-400/g, "focus:ring-brand/30"],
  [/focus:border-stone-500/g, "focus:border-brand"],
  [/focus:border-stone-400/g, "focus:border-brand"],
  [/bg-white(?![\/\w-])/g, "bg-oo-warm-white"],
];

let changed = 0;
for (const file of files) {
  let src = fs.readFileSync(file, "utf8");
  const before = src;
  for (const [re, rep] of replacements) {
    src = src.replace(re, rep);
  }
  if (src !== before) {
    fs.writeFileSync(file, src);
    changed++;
  }
}

console.log(`Updated ${changed} of ${files.length} dashboard files.`);

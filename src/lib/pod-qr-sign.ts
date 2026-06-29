import QRCode from "qrcode";

/** Square printable sign canvas (px). */
export const POD_QR_SIGN_CANVAS_SIZE = 1200;

const SIGN_COLORS = {
  cream: "#faf4ea",
  charcoal: "#1f1f1c",
  brand: "#f97316",
  lightStone: "#e7e5e4",
  stoneGray: "#78716c",
  warmWhite: "#fffdf8",
} as const;

const QR_RENDER_SIZE = 520;
const QR_MARGIN = 2;

export type PodQrSignInput = {
  podName: string;
  podSlug: string;
  /** Absolute public pod ordering URL (same target as dashboard QR). */
  publicPodUrl: string;
};

export function buildPodQrSignDownloadFileName(podSlug: string): string {
  const safeSlug = podSlug.trim().replace(/[^a-zA-Z0-9-_]+/g, "-").slice(0, 48) || "pod";
  return `open-order-${safeSlug}-qr-sign.svg`;
}

export function escapeXmlText(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Keeps circular text readable without aggressive truncation. */
export function normalizePodNameForSign(podName: string): string {
  const trimmed = podName.trim().replace(/\s+/g, " ");
  if (!trimmed) return "Open Order Pod";
  if (trimmed.length > 72) return `${trimmed.slice(0, 69)}...`;
  return trimmed;
}

export type CircularSignTextLayout = {
  text: string;
  fontSize: number;
  letterSpacing: number;
  radius: number;
};

/**
 * Repeats the pod name with separators until the circular path is filled.
 * Adjusts font size for long names.
 */
export function buildCircularSignTextLayout(podName: string): CircularSignTextLayout {
  const displayName = normalizePodNameForSign(podName).toUpperCase();
  const segment = `${displayName} • `;
  const length = displayName.length;

  let fontSize = 30;
  let letterSpacing = 0.14;
  let radius = 400;

  if (length > 24) {
    fontSize = 24;
    letterSpacing = 0.12;
    radius = 405;
  }
  if (length > 36) {
    fontSize = 20;
    letterSpacing = 0.1;
    radius = 408;
  }
  if (length > 50) {
    fontSize = 17;
    letterSpacing = 0.08;
    radius = 410;
  }

  const circumference = 2 * Math.PI * radius;
  const approxCharWidth = fontSize * (0.52 + letterSpacing);
  const targetChars = Math.ceil(circumference / approxCharWidth);

  let text = "";
  while (text.length < targetChars) {
    text += segment;
  }

  return {
    text: text.trimEnd(),
    fontSize,
    letterSpacing,
    radius,
  };
}

function extractEmbeddedQrSvg(qrSvg: string): { viewBox: string; inner: string } | null {
  const viewBoxMatch = qrSvg.match(/viewBox="([^"]+)"/i);
  const innerMatch = qrSvg.match(/<svg[^>]*>([\s\S]*?)<\/svg>/i);
  if (!viewBoxMatch || !innerMatch) return null;
  return { viewBox: viewBoxMatch[1]!, inner: innerMatch[1]!.trim() };
}

async function buildQrEmbed(publicPodUrl: string, centerX: number, centerY: number): Promise<string> {
  const qrSvg = await QRCode.toString(publicPodUrl, {
    type: "svg",
    width: QR_RENDER_SIZE,
    margin: QR_MARGIN,
    errorCorrectionLevel: "M",
    color: { dark: SIGN_COLORS.charcoal, light: SIGN_COLORS.warmWhite },
  });

  const extracted = extractEmbeddedQrSvg(qrSvg);
  if (!extracted) return "";

  const x = centerX - QR_RENDER_SIZE / 2;
  const y = centerY - QR_RENDER_SIZE / 2;

  return `
    <g transform="translate(${x}, ${y})">
      <rect width="${QR_RENDER_SIZE}" height="${QR_RENDER_SIZE}" rx="24" fill="${SIGN_COLORS.warmWhite}" />
      <svg
        width="${QR_RENDER_SIZE}"
        height="${QR_RENDER_SIZE}"
        viewBox="${extracted.viewBox}"
        xmlns="http://www.w3.org/2000/svg"
        shape-rendering="crispEdges"
      >
        ${extracted.inner}
      </svg>
    </g>
  `;
}

/**
 * Deterministic Open Order printable QR sign (SVG).
 * No AI — pod name + public URL QR + circular branding.
 */
export async function generatePodQrSignSvg(input: PodQrSignInput): Promise<string> {
  const podName = normalizePodNameForSign(input.podName);
  const circular = buildCircularSignTextLayout(podName);
  const centerX = POD_QR_SIGN_CANVAS_SIZE / 2;
  const centerY = 590;
  const circlePathId = "pod-qr-sign-name-circle";

  const circularPath = `M ${centerX - circular.radius},${centerY} a ${circular.radius},${circular.radius} 0 1,1 ${circular.radius * 2},0 a ${circular.radius},${circular.radius} 0 1,1 -${circular.radius * 2},0`;

  const qrEmbed = await buildQrEmbed(input.publicPodUrl, centerX, centerY);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${POD_QR_SIGN_CANVAS_SIZE}" height="${POD_QR_SIGN_CANVAS_SIZE}" viewBox="0 0 ${POD_QR_SIGN_CANVAS_SIZE} ${POD_QR_SIGN_CANVAS_SIZE}" role="img" aria-label="${escapeXmlText(`QR sign for ${podName}`)}">
  <rect width="100%" height="100%" fill="${SIGN_COLORS.cream}" />
  <circle cx="${centerX}" cy="${centerY}" r="${circular.radius - 18}" fill="none" stroke="${SIGN_COLORS.lightStone}" stroke-width="2" />
  <circle cx="${centerX}" cy="${centerY}" r="${QR_RENDER_SIZE / 2 + 28}" fill="none" stroke="${SIGN_COLORS.brand}" stroke-width="3" opacity="0.35" />

  <defs>
    <path id="${circlePathId}" d="${circularPath}" />
  </defs>

  <text
    font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif"
    font-size="${circular.fontSize}"
    font-weight="700"
    fill="${SIGN_COLORS.charcoal}"
    letter-spacing="${circular.letterSpacing}em"
  >
    <textPath href="#${circlePathId}" startOffset="50%" text-anchor="middle">
      ${escapeXmlText(circular.text)}
    </textPath>
  </text>

  <text
    x="${centerX}"
    y="${centerY - QR_RENDER_SIZE / 2 - 36}"
    text-anchor="middle"
    font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif"
    font-size="34"
    font-weight="700"
    fill="${SIGN_COLORS.brand}"
    letter-spacing="0.08em"
  >SCAN TO ORDER</text>

  ${qrEmbed}

  <text
    x="${centerX}"
    y="${POD_QR_SIGN_CANVAS_SIZE - 52}"
    text-anchor="middle"
    font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif"
    font-size="26"
    font-weight="600"
    fill="${SIGN_COLORS.stoneGray}"
    letter-spacing="0.06em"
  >Powered by Open Order</text>
</svg>`;
}

export function podQrSignSvgToDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

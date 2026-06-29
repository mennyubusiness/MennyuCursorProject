import { describe, expect, it } from "vitest";
import {
  buildCircularSignTextLayout,
  buildPodQrSignDownloadFileName,
  escapeXmlText,
  generatePodQrSignSvg,
  normalizePodNameForSign,
  podQrSignSvgToDataUrl,
} from "@/lib/pod-qr-sign";

describe("normalizePodNameForSign", () => {
  it("trims and collapses whitespace", () => {
    expect(normalizePodNameForSign("  Pik-Nikity   Pod Park  ")).toBe("Pik-Nikity Pod Park");
  });

  it("truncates extremely long names", () => {
    const long = "A".repeat(90);
    expect(normalizePodNameForSign(long)).toHaveLength(72);
    expect(normalizePodNameForSign(long)).toMatch(/\.\.\.$/);
  });
});

describe("buildCircularSignTextLayout", () => {
  it("repeats the pod name for circular text", () => {
    const layout = buildCircularSignTextLayout("Pik-Nikity Pod Park");
    expect(layout.text).toMatch(/PIK-NIKITY POD PARK/);
    expect(layout.text.split("•").length).toBeGreaterThan(2);
    expect(layout.fontSize).toBeGreaterThan(0);
  });

  it("reduces font size for long pod names", () => {
    const short = buildCircularSignTextLayout("Short Pod");
    const long = buildCircularSignTextLayout("A Very Long Pod Name That Should Still Fit On The Sign");
    expect(long.fontSize).toBeLessThan(short.fontSize);
  });
});

describe("escapeXmlText", () => {
  it("escapes XML entities", () => {
    expect(escapeXmlText(`Tom & Jerry's "Pod"`)).toBe("Tom &amp; Jerry&apos;s &quot;Pod&quot;");
  });
});

describe("buildPodQrSignDownloadFileName", () => {
  it("uses pod slug in file name", () => {
    expect(buildPodQrSignDownloadFileName("pik-nikity")).toBe("open-order-pik-nikity-qr-sign.svg");
  });
});

describe("generatePodQrSignSvg", () => {
  it("renders branded SVG with circular pod name and powered-by footer", async () => {
    const svg = await generatePodQrSignSvg({
      podName: "Pik-Nikity Pod Park",
      podSlug: "pik-nikity",
      publicPodUrl: "https://openorder.co/pik-nikity?entry=qr",
    });

    expect(svg).toMatch(/<svg[^>]*width="1200"/);
    expect(svg).toMatch(/fill="#faf4ea"/);
    expect(svg).toMatch(/<textPath[^>]*>/);
    expect(svg).toMatch(/PIK-NIKITY POD PARK/);
    expect(svg).toMatch(/SCAN TO ORDER/);
    expect(svg).toMatch(/Powered by Open Order/);
    expect(svg).toMatch(/shape-rendering="crispEdges"/);
    expect(svg).not.toMatch(/awaiting_review|succeeded|draft state/i);
  });

  it("embeds a QR code as vector paths", async () => {
    const svg = await generatePodQrSignSvg({
      podName: "Demo Pod",
      podSlug: "demo-pod",
      publicPodUrl: "https://example.com/demo-pod?entry=qr",
    });

    expect(svg).toMatch(/<path[^>]*stroke="#1f1f1c"/);
    expect(svg.match(/<path/g)?.length ?? 0).toBeGreaterThan(1);
  });
});

describe("podQrSignSvgToDataUrl", () => {
  it("encodes SVG for download links", () => {
    const dataUrl = podQrSignSvgToDataUrl('<svg xmlns="http://www.w3.org/2000/svg"></svg>');
    expect(dataUrl.startsWith("data:image/svg+xml;charset=utf-8,")).toBe(true);
    expect(decodeURIComponent(dataUrl.split(",")[1]!)).toContain("<svg");
  });
});

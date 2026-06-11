/** Platform-owned Open Order brand assets (local public paths). */
export const BRAND = {
  /** Food-cart mark — transparent SVG for navbar, hero mobile, compact UI */
  mark: "/brand/open-order/open-order-mark.svg",
  /** Raster mark — favicon / apple-touch-icon source */
  markRaster: "/brand/open-order/open-order-mark.png",
  /** Crisp SVG horizontal logo for dark hero/footer backgrounds */
  horizontalLogo: "/brand/open-order/open-order-horizontal.svg",
  /** Legacy raster horizontal (archival / fallback) */
  horizontalLogoRaster: "/brand/open-order/open-order-horizontal-transparent.png",
  /** Opaque horizontal with baked-in black background — OG/social previews only */
  horizontalLogoOpaque: "/brand/open-order/open-order-horizontal-dark.png",
  /** Silver stencil horizontal for dark backgrounds (alternate raster) */
  horizontalLogoSilver: "/brand/open-order/open-order-horizontal-dark-silver.png",
  /** Full horizontal logo for light backgrounds — auth panels, marketing on cream */
  horizontalLogoLight: "/brand/open-order/open-order-horizontal-light.png",
  /** Legacy circular mark with baked cream background (archival) */
  markCircleLegacy: "/brand/open-order/open-order-mark-circle.png",
  /** Square food-cart mark without circle border (archival raster) */
  markSquare: "/brand/open-order/open-order-mark-square.png",
  /** Circular brand seal — auth watermark, decorative brand areas */
  seal: "/brand/open-order/open-order-seal.png",
} as const;

/** Cropped viewBox dimensions for `open-order-horizontal.svg` (2296×310). */
export const HORIZONTAL_LOGO_INTRINSIC = { width: 2296, height: 310 } as const;

/** Square viewBox for `open-order-mark.svg` (1110×1110 cropped badge). */
export const MARK_INTRINSIC = { width: 1110, height: 1110 } as const;

export const BRAND_ALT = {
  mark: "Open Order",
  horizontalLogo: "Open Order Co. — Order more. Serve more.",
  horizontalLogoRaster: "Open Order Co. — Order more. Serve more.",
  horizontalLogoOpaque: "Open Order Co. — Order more. Serve more.",
  horizontalLogoSilver: "Open Order Co. — Order more. Serve more.",
  horizontalLogoLight: "Open Order Co. — Order more. Serve more.",
  markRaster: "Open Order",
  markCircleLegacy: "Open Order",
  markSquare: "Open Order",
  seal: "Open Order Co. — Order everywhere. Pay once.",
} as const;

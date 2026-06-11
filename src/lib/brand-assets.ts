/** Platform-owned Open Order brand assets (local public paths). */
export const BRAND = {
  /** Circular food-cart mark — navbar, favicon, compact UI */
  mark: "/brand/open-order/open-order-mark-circle.png",
  /** Transparent horizontal logo for dark hero/footer backgrounds */
  horizontalLogo: "/brand/open-order/open-order-horizontal-transparent.png",
  /** Opaque horizontal with baked-in black background — OG/social previews only */
  horizontalLogoOpaque: "/brand/open-order/open-order-horizontal-dark.png",
  /** Silver stencil horizontal for dark backgrounds (alternate) */
  horizontalLogoSilver: "/brand/open-order/open-order-horizontal-dark-silver.png",
  /** Full horizontal logo for light backgrounds — auth panels, marketing on cream */
  horizontalLogoLight: "/brand/open-order/open-order-horizontal-light.png",
  /** Square food-cart mark without circle border */
  markSquare: "/brand/open-order/open-order-mark-square.png",
  /** Circular brand seal — auth watermark, decorative brand areas */
  seal: "/brand/open-order/open-order-seal.png",
} as const;

export const BRAND_ALT = {
  mark: "Open Order",
  horizontalLogo: "Open Order Co. — Order more. Serve more.",
  horizontalLogoOpaque: "Open Order Co. — Order more. Serve more.",
  horizontalLogoSilver: "Open Order Co. — Order more. Serve more.",
  horizontalLogoLight: "Open Order Co. — Order more. Serve more.",
  markSquare: "Open Order",
  seal: "Open Order Co. — Order everywhere. Pay once.",
} as const;

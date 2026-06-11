/** Platform-owned Open Order brand assets (local public paths). */
export const BRAND = {
  /** Primary mark for header, favicon, compact UI */
  headerLogo: "/brand/open-order/open-order-header-logo.png",
  mark: "/brand/open-order/open-order-mark.png",
  wordmark: "/brand/open-order/open-order-wordmark.png",
  seal: "/brand/open-order/open-order-seal.png",
  /** Full horizontal logo — homepage hero, footer, login/register brand panel */
  horizontalLogo: "/brand/open-order/open-order-auth-main.png",
  /** @deprecated Use `horizontalLogo` — kept for auth panel imports */
  authMain: "/brand/open-order/open-order-auth-main.png",
  /** Circular emblem for login/register brand panel */
  authEmblem: "/brand/open-order/open-order-auth-emblem.png",
  ogImage: "/brand/open-order/og-image.png",
} as const;

export const BRAND_ALT = {
  mark: "Open Order",
  wordmark: "Open Order Co.",
  seal: "Open Order Co. — Order everywhere. Pay once.",
  horizontalLogo: "Open Order Co. — Order more. Serve more.",
  authMain: "Open Order Co. — Order more. Serve more.",
  authEmblem: "Open Order Co. — Order everywhere. Pay once.",
} as const;

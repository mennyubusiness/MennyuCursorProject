# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: guest-customer-flow.spec.ts >> guest customer flow (beta-critical) >> pod menu → cart → checkout with optional SMS consent
- Location: e2e\guest-customer-flow.spec.ts:6:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByText('Chips & Guac', { exact: true })
Expected: visible
Timeout: 15000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 15000ms
  - waiting for getByText('Chips & Guac', { exact: true })

```

```yaml
- banner:
  - link "Open Order":
    - /url: /
  - navigation "Site":
    - link "Bring Open Order to your pod":
      - /url: mailto:openorder.business@gmail.com?subject=Bring%20Open%20Order%20to%20my%20pod
    - link "Sign in":
      - /url: /login?next=%2Fpod%2Fcmmmhzuxb0000jgtscomwtrmu%2Fvendor%2Fcmmmhzvg30001jgtsc7y27d61
- main:
  - link "Back to Downtown Food Pod":
    - /url: /pod/cmmmhzuxb0000jgtscomwtrmu
  - heading "Taco Fiesta" [level=1]
  - paragraph:
    - text: at
    - link "Downtown Food Pod":
      - /url: /pod/cmmmhzuxb0000jgtscomwtrmu
  - button "Save vendor"
  - list:
    - listitem: Open
  - paragraph: Authentic tacos and burritos
  - paragraph: This vendor has no menu items available right now.
  - paragraph: Check back later or browse other kitchens at Downtown Food Pod.
- contentinfo:
  - link "Open Order":
    - /url: /
    - img "Open Order Co. — Order more. Serve more."
  - paragraph: Multi-vendor food cart ordering — one cart, one payment, one pickup.
  - navigation "Footer":
    - link "Explore pods":
      - /url: /explore
    - link "List your pod":
      - /url: /register
    - link "Sign in":
      - /url: /login?next=%2Fpod%2Fcmmmhzuxb0000jgtscomwtrmu%2Fvendor%2Fcmmmhzvg30001jgtsc7y27d61
    - link "Privacy":
      - /url: /privacy
    - link "Terms":
      - /url: /terms
    - link "SMS consent":
      - /url: /sms-consent
  - paragraph: © 2026 Open Order Co.
- alert
```

# Test source

```ts
  1  | import { expect, test } from "@playwright/test";
  2  | 
  3  | import { readE2ESeedIds } from "./seed-ids";
  4  | 
  5  | test.describe("guest customer flow (beta-critical)", () => {
  6  |   test("pod menu → cart → checkout with optional SMS consent", async ({ page, request }, testInfo) => {
  7  |     const { podId, vendorId, menuItemName } = readE2ESeedIds();
  8  |     const isMobile = testInfo.project.name === "mobile";
  9  |     const vendorMenuUrl = `/pod/${podId}/vendor/${vendorId}`;
  10 | 
  11 |     await test.step("legacy POST /api/cart mutations are disabled", async () => {
  12 |       const res = await request.post("/api/cart", {
  13 |         data: { cartId: "cart_e2e_probe", menuItemId: "item_e2e_probe", quantity: 1 },
  14 |       });
  15 |       expect(res.status()).toBe(410);
  16 |       const body = await res.json();
  17 |       expect(body.code).toBe("CART_API_MUTATIONS_DISABLED");
  18 |     });
  19 | 
  20 |     await test.step("open seeded vendor menu", async () => {
  21 |       await page.goto(vendorMenuUrl);
  22 |       await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
> 23 |       await expect(page.getByText(menuItemName, { exact: true })).toBeVisible();
     |                                                                   ^ Error: expect(locator).toBeVisible() failed
  24 |     });
  25 | 
  26 |     await test.step("add menu item to cart", async () => {
  27 |       await page.getByRole("button", { name: `Add ${menuItemName} to cart` }).click();
  28 |       await expect(page.getByRole("button", { name: /Cart, 1 item/ })).toBeVisible();
  29 |     });
  30 | 
  31 |     await test.step("open quick cart and adjust quantity", async () => {
  32 |       if (isMobile) {
  33 |         const mobileCart = page.getByRole("button", { name: /View cart, 1 item/i });
  34 |         await expect(mobileCart).toBeVisible();
  35 |         await mobileCart.click();
  36 |       } else {
  37 |         await page.getByRole("button", { name: "Cart, 1 item" }).click();
  38 |       }
  39 | 
  40 |       const drawer = page.locator("#quick-cart-title");
  41 |       await expect(drawer).toBeVisible();
  42 |       await expect(drawer).toHaveText("Your cart");
  43 | 
  44 |       await page.getByLabel("Increase quantity").click();
  45 |       await expect(page.getByText("2 items")).toBeVisible();
  46 | 
  47 |       await page.getByRole("link", { name: "Review cart & checkout" }).click();
  48 |       await page.waitForURL(/\/cart$/);
  49 |     });
  50 | 
  51 |     await test.step("proceed to checkout from cart page", async () => {
  52 |       await expect(page.getByRole("heading", { name: /Your cart|Group order/ })).toBeVisible();
  53 |       await expect(page.getByText(menuItemName)).toBeVisible();
  54 |       const checkoutLink = page.getByRole("link", { name: "Proceed to checkout" });
  55 |       await expect(checkoutLink).toBeVisible();
  56 |       await checkoutLink.click();
  57 |       await page.waitForURL(/\/checkout\?cartId=/);
  58 |     });
  59 | 
  60 |     await test.step("SMS consent is optional and does not block checkout", async () => {
  61 |       const smsConsent = page.locator("#checkout-sms-consent");
  62 |       await expect(smsConsent).toBeVisible();
  63 |       await expect(smsConsent).not.toBeChecked();
  64 | 
  65 |       const continueButton = page.getByTestId("checkout-continue-to-payment");
  66 |       await expect(continueButton).toBeEnabled();
  67 |       await expect(continueButton).toHaveText("Continue to payment");
  68 |       await expect(page.getByText("Verify phone or turn off SMS updates")).toHaveCount(0);
  69 | 
  70 |       await continueButton.click();
  71 |     });
  72 | 
  73 |     await test.step("checkout advances without SMS consent (dev payment or payment step)", async () => {
  74 |       const devPaymentPath = await page
  75 |         .getByText("Without Stripe keys, checkout uses the dev payment path.")
  76 |         .isVisible()
  77 |         .catch(() => false);
  78 | 
  79 |       if (devPaymentPath) {
  80 |         await page.waitForURL(/\/orders\/[^/]+/, { timeout: 30_000 });
  81 |         await expect(page.getByText(/order|confirmed|received/i).first()).toBeVisible();
  82 |         return;
  83 |       }
  84 | 
  85 |       await expect(page.getByRole("navigation", { name: "Checkout progress" })).toContainText(
  86 |         "Payment"
  87 |       );
  88 |       await expect(page.getByRole("heading", { name: "Payment" })).toBeVisible();
  89 |     });
  90 |   });
  91 | });
  92 | 
```
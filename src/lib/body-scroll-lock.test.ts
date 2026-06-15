import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type MockElement = { style: { overflow: string } };

function createMockDocument() {
  const body: MockElement = { style: { overflow: "" } };
  const documentElement: MockElement = { style: { overflow: "" } };
  return {
    body,
    documentElement,
  };
}

describe("body-scroll-lock", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  async function loadScrollLockModule() {
    const mockDoc = createMockDocument();
    vi.stubGlobal("document", mockDoc);
    return import("@/lib/body-scroll-lock");
  }

  it("locks body/html overflow while active", async () => {
    const { lockBodyScroll, readBodyScrollLockStyles } = await loadScrollLockModule();
    const unlock = lockBodyScroll();
    expect(readBodyScrollLockStyles()).toEqual({
      bodyOverflow: "hidden",
      htmlOverflow: "hidden",
      lockCount: 1,
    });
    unlock();
  });

  it("restores previous overflow values after unlock", async () => {
    const mockDoc = createMockDocument();
    mockDoc.body.style.overflow = "auto";
    mockDoc.documentElement.style.overflow = "scroll";
    vi.stubGlobal("document", mockDoc);

    const { lockBodyScroll, readBodyScrollLockStyles } = await import("@/lib/body-scroll-lock");
    const unlock = lockBodyScroll();
    expect(document.body.style.overflow).toBe("hidden");

    unlock();

    expect(readBodyScrollLockStyles()).toEqual({
      bodyOverflow: "auto",
      htmlOverflow: "scroll",
      lockCount: 0,
    });
  });

  it("supports nested locks and only restores on final release", async () => {
    const { lockBodyScroll, getBodyScrollLockCount } = await loadScrollLockModule();
    const unlockA = lockBodyScroll();
    const unlockB = lockBodyScroll();
    expect(getBodyScrollLockCount()).toBe(2);

    unlockA();
    expect(getBodyScrollLockCount()).toBe(1);
    expect(document.body.style.overflow).toBe("hidden");

    unlockB();
    expect(getBodyScrollLockCount()).toBe(0);
    expect(document.body.style.overflow).toBe("");
  });

  it("does not leave scroll locked when unlock is called twice", async () => {
    const { lockBodyScroll, getBodyScrollLockCount } = await loadScrollLockModule();
    const unlock = lockBodyScroll();
    unlock();
    unlock();
    expect(getBodyScrollLockCount()).toBe(0);
    expect(document.body.style.overflow).toBe("");
  });
});

describe("overlay scroll-lock wiring", () => {
  const mobileSheetSrc = readFileSync(
    join(process.cwd(), "src/components/mobile/MobileBottomSheet.tsx"),
    "utf8"
  );
  const modifierContextSrc = readFileSync(
    join(process.cwd(), "src/components/vendor-menu/VendorMenuModifierContext.tsx"),
    "utf8"
  );
  const joinModalSrc = readFileSync(
    join(process.cwd(), "src/components/group-order/JoinGroupOrderByCodeModal.tsx"),
    "utf8"
  );
  const quickCartSrc = readFileSync(
    join(process.cwd(), "src/components/cart/QuickCartContext.tsx"),
    "utf8"
  );

  it("MobileBottomSheet uses shared scroll lock hook", () => {
    expect(mobileSheetSrc).toMatch(/useBodyScrollLock\(open\)/);
    expect(mobileSheetSrc).not.toMatch(/document\.body\.style\.overflow/);
  });

  it("VendorMenuModifierContext does not duplicate body scroll lock", () => {
    expect(modifierContextSrc).not.toMatch(/document\.body\.style\.overflow/);
  });

  it("JoinGroupOrderByCodeModal delegates scroll lock to MobileBottomSheet", () => {
    expect(joinModalSrc).toMatch(/MobileBottomSheet/);
    expect(joinModalSrc).not.toMatch(/document\.body\.style\.overflow/);
  });

  it("QuickCartContext uses shared scroll lock hook", () => {
    expect(quickCartSrc).toMatch(/useBodyScrollLock\(isOpen\)/);
    expect(quickCartSrc).not.toMatch(/document\.body\.style\.overflow/);
  });
});

"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import {
  createOpenOrderMenuCategory,
  createOpenOrderMenuItem,
  deleteOpenOrderMenuCategory,
  deleteOpenOrderMenuItem,
  publishOpenOrderMenuAction,
  updateOpenOrderMenuCategory,
  updateOpenOrderMenuItem,
} from "@/actions/vendor-menu-builder.actions";
import { openOrderCategoryDeliverectId, openOrderProductDeliverectId } from "@/lib/open-order-menu-ids";
import { parseMenuPriceToCents } from "@/lib/menu-price";
import {
  validateOpenOrderMenuBuilderState,
  type OpenOrderMenuValidationResult,
} from "@/lib/open-order-menu-validation";
import type { VendorMenuBuilderPageData } from "@/lib/vendor-menu-builder-data.server";
import type { MenuBuilderGlobalSaveStatus } from "./MenuBuilderSaveStatus";

export type MenuBuilderCategory = VendorMenuBuilderPageData["categories"][number] & {
  isTemp?: boolean;
  isDeleting?: boolean;
};

export type MenuBuilderItem = VendorMenuBuilderPageData["items"][number] & {
  isTemp?: boolean;
  isDeleting?: boolean;
};

type EntitySaveStatus = "idle" | "saving" | "saved" | "error";

type ActionResult = { ok: boolean; error?: string; message?: string; categoryId?: string; itemId?: string };

function tempId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function toValidationRows(
  categories: MenuBuilderCategory[],
  items: MenuBuilderItem[]
): OpenOrderMenuValidationResult {
  return validateOpenOrderMenuBuilderState({
    categories: categories.filter((c) => !c.isDeleting).map((c) => ({
      id: c.id,
      name: c.name,
      sortOrder: c.sortOrder,
      isVisible: c.isVisible,
    })),
    items: items
      .filter((item) => !item.isDeleting)
      .map((item) => ({
        id: item.id,
        name: item.name,
        description: item.description,
        priceCents: item.priceCents,
        isAvailable: item.isAvailable,
        sortOrder: item.sortOrder,
        deliverectCategoryId: item.categoryId
          ? openOrderCategoryDeliverectId(item.categoryId)
          : null,
        deliverectProductId: openOrderProductDeliverectId(item.id),
        updatedAt: new Date(item.updatedAt),
      })),
  });
}

function itemCountForCategory(items: MenuBuilderItem[], categoryId: string): number {
  return items.filter((item) => item.categoryId === categoryId && !item.isDeleting).length;
}

export function useMenuBuilderEditor(data: VendorMenuBuilderPageData) {
  const [categories, setCategories] = useState<MenuBuilderCategory[]>(data.categories);
  const [items, setItems] = useState<MenuBuilderItem[]>(data.items);
  const [hasPublishedMenuVersion, setHasPublishedMenuVersion] = useState(data.hasPublishedMenuVersion);
  const [publishedAtIso, setPublishedAtIso] = useState(data.publishedAtIso);
  const [lastUpdatedIso, setLastUpdatedIso] = useState(data.lastUpdatedIso);

  const [entityStatus, setEntityStatus] = useState<Record<string, EntitySaveStatus>>({});
  const [entityErrors, setEntityErrors] = useState<Record<string, string>>({});
  const [globalStatus, setGlobalStatus] = useState<MenuBuilderGlobalSaveStatus>("idle");
  const [publishPending, setPublishPending] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [publishMessage, setPublishMessage] = useState<string | null>(null);

  const inFlightRef = useRef(0);
  const savedHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const validation = useMemo(() => toValidationRows(categories, items), [categories, items]);

  const categoriesWithCounts = useMemo(
    () =>
      categories.map((cat) => ({
        ...cat,
        itemCount: itemCountForCategory(items, cat.id),
      })),
    [categories, items]
  );

  const refreshGlobalStatus = useCallback(() => {
    if (inFlightRef.current > 0) {
      setGlobalStatus("saving");
      return;
    }
    const hasError = Object.values(entityStatus).some((status) => status === "error");
    setGlobalStatus(hasError ? "error" : "saved");
    if (!hasError) {
      if (savedHideTimerRef.current) clearTimeout(savedHideTimerRef.current);
      savedHideTimerRef.current = setTimeout(() => setGlobalStatus("idle"), 2500);
    }
  }, [entityStatus]);

  const setEntitySaveState = useCallback((key: string, status: EntitySaveStatus, error?: string) => {
    setEntityStatus((prev) => ({ ...prev, [key]: status }));
    setEntityErrors((prev) => {
      const next = { ...prev };
      if (error) next[key] = error;
      else delete next[key];
      return next;
    });
  }, []);

  const runSave = useCallback(
    async (
      entityKey: string,
      optimistic: () => void,
      rollback: () => void,
      action: () => Promise<ActionResult>
    ): Promise<ActionResult> => {
      optimistic();
      setEntitySaveState(entityKey, "saving");
      inFlightRef.current += 1;
      setGlobalStatus("saving");

      try {
        const result = await action();
        if (result.ok) {
          setEntitySaveState(entityKey, "saved");
          setLastUpdatedIso(new Date().toISOString());
        } else {
          rollback();
          setEntitySaveState(entityKey, "error", result.error ?? "Could not save. Try again.");
          setGlobalStatus("error");
        }
        return result;
      } catch {
        rollback();
        setEntitySaveState(entityKey, "error", "Could not save. Try again.");
        setGlobalStatus("error");
        return { ok: false, error: "Could not save. Try again." };
      } finally {
        inFlightRef.current -= 1;
        refreshGlobalStatus();
      }
    },
    [refreshGlobalStatus, setEntitySaveState]
  );

  const updateCategoryName = useCallback(
    (categoryId: string, name: string) => {
      const previous = categories.find((c) => c.id === categoryId);
      if (!previous || previous.name === name) return;

      void runSave(
        `cat-name:${categoryId}`,
        () => {
          setCategories((prev) =>
            prev.map((c) => (c.id === categoryId ? { ...c, name } : c))
          );
        },
        () => {
          if (previous) {
            setCategories((prev) =>
              prev.map((c) => (c.id === categoryId ? { ...c, name: previous.name } : c))
            );
          }
        },
        () => updateOpenOrderMenuCategory(data.vendorId, categoryId, { name })
      );
    },
    [categories, data.vendorId, runSave]
  );

  const updateCategoryVisible = useCallback(
    (categoryId: string, isVisible: boolean) => {
      const previous = categories.find((c) => c.id === categoryId);
      if (!previous || previous.isVisible === isVisible) return;

      void runSave(
        `cat-visible:${categoryId}`,
        () => {
          setCategories((prev) =>
            prev.map((c) => (c.id === categoryId ? { ...c, isVisible } : c))
          );
        },
        () => {
          if (previous) {
            setCategories((prev) =>
              prev.map((c) =>
                c.id === categoryId ? { ...c, isVisible: previous.isVisible } : c
              )
            );
          }
        },
        () => updateOpenOrderMenuCategory(data.vendorId, categoryId, { isVisible })
      );
    },
    [categories, data.vendorId, runSave]
  );

  const addCategory = useCallback(
    async (name: string): Promise<boolean> => {
      const trimmed = name.trim();
      if (!trimmed) {
        setEntitySaveState("new-category", "error", "Category name is required.");
        setGlobalStatus("error");
        return false;
      }

      const tempCategoryId = tempId("temp-cat");
      const optimisticCategory: MenuBuilderCategory = {
        id: tempCategoryId,
        name: trimmed,
        sortOrder: categories.length,
        isVisible: true,
        itemCount: 0,
        isTemp: true,
      };

      const result = await runSave(
        "new-category",
        () => setCategories((prev) => [...prev, optimisticCategory]),
        () => setCategories((prev) => prev.filter((c) => c.id !== tempCategoryId)),
        () => createOpenOrderMenuCategory(data.vendorId, { name: trimmed })
      );

      if (result.ok && result.categoryId) {
        setCategories((prev) =>
          prev.map((c) =>
            c.id === tempCategoryId ? { ...c, id: result.categoryId!, isTemp: false } : c
          )
        );
        setItems((prev) =>
          prev.map((item) =>
            item.categoryId === tempCategoryId
              ? { ...item, categoryId: result.categoryId! }
              : item
          )
        );
        return true;
      }
      return false;
    },
    [categories.length, data.vendorId, runSave, setEntitySaveState]
  );

  const removeCategory = useCallback(
    (categoryId: string) => {
      const previous = categories.find((c) => c.id === categoryId);
      if (!previous) return;

      void runSave(
        `cat-delete:${categoryId}`,
        () => {
          setCategories((prev) => prev.filter((c) => c.id !== categoryId));
        },
        () => {
          setCategories((prev) => [...prev, previous]);
        },
        () => deleteOpenOrderMenuCategory(data.vendorId, categoryId)
      );
    },
    [categories, data.vendorId, runSave]
  );

  const updateItemName = useCallback(
    (itemId: string, name: string) => {
      const previous = items.find((i) => i.id === itemId);
      if (!previous || previous.name === name) return;

      void runSave(
        `item-name:${itemId}`,
        () => {
          setItems((prev) => prev.map((i) => (i.id === itemId ? { ...i, name } : i)));
        },
        () => {
          if (previous) {
            setItems((prev) =>
              prev.map((i) => (i.id === itemId ? { ...i, name: previous.name } : i))
            );
          }
        },
        () => updateOpenOrderMenuItem(data.vendorId, itemId, { name })
      );
    },
    [data.vendorId, items, runSave]
  );

  const updateItemPrice = useCallback(
    (itemId: string, rawPrice: string) => {
      const previous = items.find((i) => i.id === itemId);
      if (!previous) return;

      const parsed = parseMenuPriceToCents(rawPrice);
      if (!parsed.ok) {
        setEntitySaveState(`item-price:${itemId}`, "error", parsed.error);
        setGlobalStatus("error");
        return;
      }
      if (parsed.cents === previous.priceCents) return;

      void runSave(
        `item-price:${itemId}`,
        () => {
          setItems((prev) =>
            prev.map((i) => (i.id === itemId ? { ...i, priceCents: parsed.cents } : i))
          );
        },
        () => {
          setItems((prev) =>
            prev.map((i) =>
              i.id === itemId ? { ...i, priceCents: previous.priceCents } : i
            )
          );
        },
        () => updateOpenOrderMenuItem(data.vendorId, itemId, { price: rawPrice })
      );
    },
    [data.vendorId, items, runSave, setEntitySaveState]
  );

  const updateItemAvailable = useCallback(
    (itemId: string, isAvailable: boolean) => {
      const previous = items.find((i) => i.id === itemId);
      if (!previous || previous.isAvailable === isAvailable) return;

      void runSave(
        `item-available:${itemId}`,
        () => {
          setItems((prev) =>
            prev.map((i) => (i.id === itemId ? { ...i, isAvailable } : i))
          );
        },
        () => {
          setItems((prev) =>
            prev.map((i) =>
              i.id === itemId ? { ...i, isAvailable: previous.isAvailable } : i
            )
          );
        },
        () => updateOpenOrderMenuItem(data.vendorId, itemId, { isAvailable })
      );
    },
    [data.vendorId, items, runSave]
  );

  const addItem = useCallback(
    async (input: {
      name: string;
      description: string;
      price: string;
      categoryId: string;
    }): Promise<boolean> => {
      const name = input.name.trim();
      if (!name) {
        setEntitySaveState("new-item", "error", "Item name is required.");
        setGlobalStatus("error");
        return false;
      }

      const parsed = parseMenuPriceToCents(input.price);
      if (!parsed.ok) {
        setEntitySaveState("new-item", "error", parsed.error);
        setGlobalStatus("error");
        return false;
      }

      const tempItemId = tempId("temp-item");
      const optimisticItem: MenuBuilderItem = {
        id: tempItemId,
        name,
        description: input.description.trim() || null,
        priceCents: parsed.cents,
        isAvailable: true,
        sortOrder: items.length,
        categoryId: input.categoryId,
        updatedAt: new Date().toISOString(),
        isTemp: true,
      };

      const result = await runSave(
        "new-item",
        () => setItems((prev) => [...prev, optimisticItem]),
        () => setItems((prev) => prev.filter((i) => i.id !== tempItemId)),
        () =>
          createOpenOrderMenuItem(data.vendorId, {
            name,
            description: input.description,
            price: input.price,
            categoryId: input.categoryId,
          })
      );

      if (result.ok && result.itemId) {
        setItems((prev) =>
          prev.map((i) =>
            i.id === tempItemId ? { ...i, id: result.itemId!, isTemp: false } : i
          )
        );
        return true;
      }
      return false;
    },
    [data.vendorId, items.length, runSave, setEntitySaveState]
  );

  const removeItem = useCallback(
    (itemId: string) => {
      const previous = items.find((i) => i.id === itemId);
      if (!previous) return;

      void runSave(
        `item-delete:${itemId}`,
        () => {
          setItems((prev) => prev.filter((i) => i.id !== itemId));
        },
        () => {
          setItems((prev) => [...prev, previous]);
        },
        async () => {
          const result = await deleteOpenOrderMenuItem(data.vendorId, itemId);
          if (!result.ok && result.error?.includes("marked unavailable")) {
            setItems((prev) =>
              prev.map((i) =>
                i.id === itemId ? { ...i, isAvailable: false } : i
              )
            );
          }
          return result;
        }
      );
    },
    [data.vendorId, items, runSave]
  );

  const publishMenu = useCallback(async () => {
    setPublishError(null);
    setPublishMessage(null);
    setPublishPending(true);
    try {
      const result = await publishOpenOrderMenuAction(data.vendorId);
      if (result.ok) {
        setPublishMessage(result.message ?? "Menu published to your storefront.");
        setHasPublishedMenuVersion(true);
        setPublishedAtIso(new Date().toISOString());
      } else {
        setPublishError(result.error ?? "Could not publish menu.");
      }
    } finally {
      setPublishPending(false);
    }
  }, [data.vendorId]);

  const getEntityStatus = useCallback(
    (key: string): EntitySaveStatus => entityStatus[key] ?? "idle",
    [entityStatus]
  );

  const getEntityError = useCallback((key: string): string | null => entityErrors[key] ?? null, [entityErrors]);

  return {
    categories: categoriesWithCounts,
    items,
    validation,
    hasPublishedMenuVersion,
    publishedAtIso,
    lastUpdatedIso,
    globalStatus,
    publishPending,
    publishError,
    publishMessage,
    addCategory,
    removeCategory,
    updateCategoryName,
    updateCategoryVisible,
    addItem,
    removeItem,
    updateItemName,
    updateItemPrice,
    updateItemAvailable,
    publishMenu,
    getEntityStatus,
    getEntityError,
  };
}

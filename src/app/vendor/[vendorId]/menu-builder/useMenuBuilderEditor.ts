"use client";

import { useCallback, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import {
  createOpenOrderModifierGroup,
  createOpenOrderModifierOption,
  deleteOpenOrderModifierGroup,
  deleteOpenOrderModifierOption,
  updateOpenOrderModifierGroup,
  updateOpenOrderModifierOption,
} from "@/actions/vendor-menu-builder-modifier.actions";
import {
  createOpenOrderMenuCategory,
  createOpenOrderMenuItem,
  deleteOpenOrderMenuCategory,
  deleteOpenOrderMenuItem,
  publishOpenOrderMenuAction,
  reorderOpenOrderMenuCategories,
  reorderOpenOrderMenuItemsInCategory,
  updateOpenOrderMenuCategory,
  updateOpenOrderMenuItem,
} from "@/actions/vendor-menu-builder.actions";
import { openOrderCategoryDeliverectId, openOrderProductDeliverectId } from "@/lib/open-order-menu-ids";
import { parseMenuPriceToCents } from "@/lib/menu-price";
import {
  validateOpenOrderMenuBuilderState,
  type OpenOrderMenuValidationResult,
} from "@/lib/open-order-menu-validation";
import type {
  VendorMenuBuilderModifierGroup,
  VendorMenuBuilderPageData,
} from "@/lib/vendor-menu-builder-data.server";
import { toModifierValidationRow } from "@/lib/open-order-modifier-validation";
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

type ActionResult = {
  ok: boolean;
  error?: string;
  message?: string;
  categoryId?: string;
  itemId?: string;
  groupId?: string;
  linkId?: string;
  optionId?: string;
};

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
        modifierGroups: (item.modifierGroups ?? []).map(toModifierValidationRow),
      })),
  });
}

function updateItemModifierGroups(
  setItems: Dispatch<SetStateAction<MenuBuilderItem[]>>,
  itemId: string,
  updater: (groups: VendorMenuBuilderModifierGroup[]) => VendorMenuBuilderModifierGroup[]
) {
  setItems((prev) =>
    prev.map((item) =>
      item.id === itemId ? { ...item, modifierGroups: updater(item.modifierGroups ?? []) } : item
    )
  );
}

function itemCountForCategory(items: MenuBuilderItem[], categoryId: string): number {
  return items.filter((item) => item.categoryId === categoryId && !item.isDeleting).length;
}

function sortByOrder<T extends { sortOrder: number }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => a.sortOrder - b.sortOrder);
}

function swapSortOrder<T extends { id: string; sortOrder: number }>(
  rows: T[],
  id: string,
  direction: "up" | "down"
): T[] | null {
  const sorted = sortByOrder(rows);
  const index = sorted.findIndex((row) => row.id === id);
  if (index < 0) return null;
  const swapIndex = direction === "up" ? index - 1 : index + 1;
  if (swapIndex < 0 || swapIndex >= sorted.length) return null;
  const next = [...sorted];
  [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  return next.map((row, sortOrder) => ({ ...row, sortOrder }));
}

export function useMenuBuilderEditor(data: VendorMenuBuilderPageData) {
  const [categories, setCategories] = useState<MenuBuilderCategory[]>(data.categories);
  const [items, setItems] = useState<MenuBuilderItem[]>(data.items);
  const [hasPublishedOpenOrderMenu, setHasPublishedOpenOrderMenu] = useState(
    data.hasPublishedOpenOrderMenu
  );
  const [hasUnpublishedChanges, setHasUnpublishedChanges] = useState(data.hasUnpublishedChanges);
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
      sortByOrder(
        categories.map((cat) => ({
          ...cat,
          itemCount: itemCountForCategory(items, cat.id),
        }))
      ),
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
          setHasUnpublishedChanges(true);
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
        imageUrl: null,
        updatedAt: new Date().toISOString(),
        isTemp: true,
        modifierGroups: [],
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

  const addModifierGroup = useCallback(
    async (itemId: string) => {
      const tempGroupId = tempId("temp-modgrp");
      const tempLinkId = tempId("temp-modlink");
      const optimisticGroup: VendorMenuBuilderModifierGroup = {
        id: tempGroupId,
        linkId: tempLinkId,
        name: "New modifier group",
        required: false,
        minSelections: 0,
        maxSelections: 1,
        isAvailable: true,
        sortOrder: (items.find((i) => i.id === itemId)?.modifierGroups?.length ?? 0),
        options: [],
        isTemp: true,
      } as VendorMenuBuilderModifierGroup & { isTemp?: boolean };

      const result = await runSave(
        `modgrp-create:${itemId}`,
        () => updateItemModifierGroups(setItems, itemId, (groups) => [...groups, optimisticGroup]),
        () => updateItemModifierGroups(setItems, itemId, (groups) => groups.filter((g) => g.id !== tempGroupId)),
        () => createOpenOrderModifierGroup(data.vendorId, itemId, { name: "New modifier group" })
      );

      if (result.ok && result.groupId && result.linkId) {
        updateItemModifierGroups(setItems, itemId, (groups) =>
          groups.map((g) =>
            g.id === tempGroupId
              ? { ...g, id: result.groupId!, linkId: result.linkId!, isTemp: false }
              : g
          )
        );
      }
    },
    [data.vendorId, items, runSave]
  );

  const updateModifierGroupFields = useCallback(
    (
      itemId: string,
      groupId: string,
      input: {
        name?: string;
        required?: boolean;
        minSelections?: number;
        maxSelections?: number;
        isAvailable?: boolean;
      }
    ) => {
      const item = items.find((i) => i.id === itemId);
      const previous = item?.modifierGroups?.find((g) => g.id === groupId);
      if (!previous) return;

      void runSave(
        `modgrp:${groupId}`,
        () =>
          updateItemModifierGroups(setItems, itemId, (groups) =>
            groups.map((g) => (g.id === groupId ? { ...g, ...input } : g))
          ),
        () =>
          updateItemModifierGroups(setItems, itemId, (groups) =>
            groups.map((g) => (g.id === groupId ? previous : g))
          ),
        () => updateOpenOrderModifierGroup(data.vendorId, itemId, groupId, input)
      );
    },
    [data.vendorId, items, runSave]
  );

  const removeModifierGroup = useCallback(
    (itemId: string, groupId: string) => {
      const previous = items.find((i) => i.id === itemId)?.modifierGroups?.find((g) => g.id === groupId);
      if (!previous) return;

      void runSave(
        `modgrp-delete:${groupId}`,
        () =>
          updateItemModifierGroups(setItems, itemId, (groups) => groups.filter((g) => g.id !== groupId)),
        () => updateItemModifierGroups(setItems, itemId, (groups) => [...groups, previous]),
        () => deleteOpenOrderModifierGroup(data.vendorId, itemId, groupId)
      );
    },
    [data.vendorId, items, runSave]
  );

  const addModifierOption = useCallback(
    async (itemId: string, groupId: string, name: string, price: string) => {
      const tempOptionId = tempId("temp-modopt");
      const optimisticOption = {
        id: tempOptionId,
        name: name.trim() || "New option",
        priceCents: 0,
        isAvailable: true,
        sortOrder: 0,
        isTemp: true,
      };

      const result = await runSave(
        `modopt-create:${groupId}`,
        () =>
          updateItemModifierGroups(setItems, itemId, (groups) =>
            groups.map((g) =>
              g.id === groupId
                ? { ...g, options: [...g.options, optimisticOption] }
                : g
            )
          ),
        () =>
          updateItemModifierGroups(setItems, itemId, (groups) =>
            groups.map((g) =>
              g.id === groupId
                ? { ...g, options: g.options.filter((o) => o.id !== tempOptionId) }
                : g
            )
          ),
        () =>
          createOpenOrderModifierOption(data.vendorId, itemId, groupId, {
            name: name.trim() || "New option",
            price,
          })
      );

      if (result.ok && result.optionId) {
        updateItemModifierGroups(setItems, itemId, (groups) =>
          groups.map((g) =>
            g.id === groupId
              ? {
                  ...g,
                  options: g.options.map((o) =>
                    o.id === tempOptionId ? { ...o, id: result.optionId!, isTemp: false } : o
                  ),
                }
              : g
          )
        );
      }
    },
    [data.vendorId, runSave]
  );

  const updateModifierOptionFields = useCallback(
    (
      itemId: string,
      groupId: string,
      optionId: string,
      input: { name?: string; price?: string; isAvailable?: boolean }
    ) => {
      const previous = items
        .find((i) => i.id === itemId)
        ?.modifierGroups?.find((g) => g.id === groupId)
        ?.options.find((o) => o.id === optionId);
      if (!previous) return;

      const optimisticPatch = {
        ...input,
        ...(input.price !== undefined
          ? {
              priceCents: (() => {
                const parsed = parseMenuPriceToCents(input.price);
                return parsed.ok ? parsed.cents : previous.priceCents;
              })(),
            }
          : {}),
      };

      void runSave(
        `modopt:${optionId}`,
        () =>
          updateItemModifierGroups(setItems, itemId, (groups) =>
            groups.map((g) =>
              g.id === groupId
                ? {
                    ...g,
                    options: g.options.map((o) =>
                      o.id === optionId ? { ...o, ...optimisticPatch } : o
                    ),
                  }
                : g
            )
          ),
        () =>
          updateItemModifierGroups(setItems, itemId, (groups) =>
            groups.map((g) =>
              g.id === groupId
                ? {
                    ...g,
                    options: g.options.map((o) => (o.id === optionId ? previous : o)),
                  }
                : g
            )
          ),
        () => updateOpenOrderModifierOption(data.vendorId, itemId, groupId, optionId, input)
      );
    },
    [data.vendorId, items, runSave]
  );

  const removeModifierOption = useCallback(
    (itemId: string, groupId: string, optionId: string) => {
      const previous = items
        .find((i) => i.id === itemId)
        ?.modifierGroups?.find((g) => g.id === groupId)
        ?.options.find((o) => o.id === optionId);
      if (!previous) return;

      void runSave(
        `modopt-delete:${optionId}`,
        () =>
          updateItemModifierGroups(setItems, itemId, (groups) =>
            groups.map((g) =>
              g.id === groupId
                ? { ...g, options: g.options.filter((o) => o.id !== optionId) }
                : g
            )
          ),
        () =>
          updateItemModifierGroups(setItems, itemId, (groups) =>
            groups.map((g) =>
              g.id === groupId ? { ...g, options: [...g.options, previous] } : g
            )
          ),
        () => deleteOpenOrderModifierOption(data.vendorId, itemId, groupId, optionId)
      );
    },
    [data.vendorId, items, runSave]
  );

  const updateItemImage = useCallback(
    (itemId: string, imageUrl: string | null) => {
      const previous = items.find((i) => i.id === itemId);
      if (!previous) return;
      if ((previous.imageUrl ?? null) === imageUrl) return;

      void runSave(
        `item-image:${itemId}`,
        () => {
          setItems((prev) =>
            prev.map((i) => (i.id === itemId ? { ...i, imageUrl } : i))
          );
        },
        () => {
          setItems((prev) =>
            prev.map((i) =>
              i.id === itemId ? { ...i, imageUrl: previous.imageUrl ?? null } : i
            )
          );
        },
        () => updateOpenOrderMenuItem(data.vendorId, itemId, { imageUrl })
      );
    },
    [data.vendorId, items, runSave]
  );

  const moveCategory = useCallback(
    (categoryId: string, direction: "up" | "down") => {
      const reordered = swapSortOrder(categories, categoryId, direction);
      if (!reordered) return;
      const previous = categories;

      void runSave(
        "category-reorder",
        () => setCategories(reordered),
        () => setCategories(previous),
        () => reorderOpenOrderMenuCategories(data.vendorId, reordered.map((c) => c.id))
      );
    },
    [categories, data.vendorId, runSave]
  );

  const moveItemInCategory = useCallback(
    (categoryId: string, itemId: string, direction: "up" | "down") => {
      const inCategory = items.filter((i) => i.categoryId === categoryId && !i.isDeleting);
      const reordered = swapSortOrder(inCategory, itemId, direction);
      if (!reordered) return;
      const reorderedIds = new Set(reordered.map((i) => i.id));
      const sortById = new Map(reordered.map((i) => [i.id, i.sortOrder]));
      const previous = items;

      void runSave(
        `item-reorder:${categoryId}`,
        () => {
          setItems((prev) =>
            prev.map((item) =>
              reorderedIds.has(item.id)
                ? { ...item, sortOrder: sortById.get(item.id) ?? item.sortOrder }
                : item
            )
          );
        },
        () => setItems(previous),
        () =>
          reorderOpenOrderMenuItemsInCategory(
            data.vendorId,
            categoryId,
            reordered.map((i) => i.id)
          )
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
        setHasPublishedOpenOrderMenu(true);
        setHasUnpublishedChanges(false);
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
    hasPublishedOpenOrderMenu,
    hasUnpublishedChanges,
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
    updateItemImage,
    moveCategory,
    moveItemInCategory,
    addModifierGroup,
    updateModifierGroupFields,
    removeModifierGroup,
    addModifierOption,
    updateModifierOptionFields,
    removeModifierOption,
    publishMenu,
    getEntityStatus,
    getEntityError,
  };
}

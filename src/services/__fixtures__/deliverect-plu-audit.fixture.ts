/**
 * Fixture modeled after a Deliverect burger menu JSON:
 * - One top-level product PLU per sellable item (P-BRGR-1)
 * - Modifier PLUs (TOMAT, ONION, DLX-1) reused across groups/items
 * - Product PLU reused as modifier option PLU (intentional Deliverect pattern)
 * - Variant parent placeholder row (###PRNT)
 * - Retired historical row with same PLU as current winner
 */
export const deliverectPluAuditFixture = {
  operationalMenuItemIds: ["item-burger-active", "item-dlx-active"],
  operationalModifierOptionIds: [
    "opt-tomat-burger",
    "opt-onion-burger",
    "opt-dlx-burger",
    "opt-tomat-drink",
    "opt-onion-drink",
    "opt-dlx-dlxgrp",
  ],
  productRows: [
    { id: "item-burger-active", name: "House Burger", deliverectPlu: "P-BRGR-1" },
    { id: "item-burger-retired", name: "House Burger (old)", deliverectPlu: "P-BRGR-1" },
    { id: "item-dlx-active", name: "Deluxe add-on", deliverectPlu: "DLX-1" },
    { id: "item-variant-parent", name: "Burger variations", deliverectPlu: "P-BRGR-1###PRNT" },
    { id: "item-ambiguous-a", name: "Duplicate PLU A", deliverectPlu: "AMBIG-1" },
    { id: "item-ambiguous-b", name: "Duplicate PLU B", deliverectPlu: "AMBIG-1" },
  ],
  modifierRows: [
    {
      optionId: "opt-tomat-burger",
      groupId: "grp-burger-toppings",
      groupName: "Burger toppings",
      plu: "TOMAT",
      isOperational: true,
    },
    {
      optionId: "opt-onion-burger",
      groupId: "grp-burger-toppings",
      groupName: "Burger toppings",
      plu: "ONION",
      isOperational: true,
    },
    {
      optionId: "opt-dlx-burger",
      groupId: "grp-burger-upgrades",
      groupName: "Burger upgrades",
      plu: "DLX-1",
      isOperational: true,
    },
    {
      optionId: "opt-tomat-drink",
      groupId: "grp-drink-mix",
      groupName: "Drink mix-ins",
      plu: "TOMAT",
      isOperational: true,
    },
    {
      optionId: "opt-onion-drink",
      groupId: "grp-drink-mix",
      groupName: "Drink mix-ins",
      plu: "ONION",
      isOperational: true,
    },
    {
      optionId: "opt-dlx-dlxgrp",
      groupId: "grp-dlx-required",
      groupName: "Deluxe required",
      plu: "DLX-1",
      isOperational: true,
    },
    {
      optionId: "opt-dlx-dup-a",
      groupId: "grp-ambiguous",
      groupName: "Ambiguous group",
      plu: "PICKL",
      isOperational: true,
    },
    {
      optionId: "opt-dlx-dup-b",
      groupId: "grp-ambiguous",
      groupName: "Ambiguous group",
      plu: "PICKL",
      isOperational: true,
    },
    {
      optionId: "opt-retired-pickl",
      groupId: "grp-burger-toppings",
      groupName: "Burger toppings",
      plu: "PICKL",
      isOperational: false,
    },
  ],
} as const;

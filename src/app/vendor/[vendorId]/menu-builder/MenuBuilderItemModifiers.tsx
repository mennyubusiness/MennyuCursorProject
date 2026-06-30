"use client";

import { useEffect, useState } from "react";
import { formatCentsToCurrency } from "@/lib/menu-price";
import type { VendorMenuBuilderModifierGroup } from "@/lib/vendor-menu-builder-data.server";
import { MenuPriceInput } from "./MenuPriceInput";
import type { useMenuBuilderEditor } from "./useMenuBuilderEditor";

type Editor = ReturnType<typeof useMenuBuilderEditor>;

export function MenuBuilderItemModifiers({
  vendorId: _vendorId,
  itemId,
  itemName,
  groups,
  editor,
  disabled,
}: {
  vendorId: string;
  itemName: string;
  itemId: string;
  groups: VendorMenuBuilderModifierGroup[];
  editor: Editor;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(groups.length > 0);
  const [newOptionName, setNewOptionName] = useState<Record<string, string>>({});
  const [newOptionPrice, setNewOptionPrice] = useState<Record<string, string>>({});

  useEffect(() => {
    if (groups.length > 0) setOpen(true);
  }, [groups.length]);

  return (
    <div className="mt-3 rounded-lg border border-dashed border-oo-light-stone bg-oo-cream/40 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="text-left text-sm font-medium text-oo-charcoal hover:underline"
        >
          Modifiers{groups.length > 0 ? ` (${groups.length})` : ""}
        </button>
        <button
          type="button"
          disabled={disabled || editor.getEntityStatus(`modgrp-create:${itemId}`) === "saving"}
          onClick={() => void editor.addModifierGroup(itemId)}
          className="rounded-lg border border-oo-light-stone bg-oo-warm-white px-3 py-1.5 text-xs font-semibold text-oo-charcoal hover:bg-oo-cream disabled:opacity-50"
        >
          {editor.getEntityStatus(`modgrp-create:${itemId}`) === "saving"
            ? "Adding…"
            : "Add modifier group"}
        </button>
      </div>

      {editor.getEntityError(`modgrp-create:${itemId}`) ? (
        <p className="mt-2 text-xs text-red-700">{editor.getEntityError(`modgrp-create:${itemId}`)}</p>
      ) : null}

      {open ? (
        <div className="mt-3 space-y-4">
          {groups.length === 0 ? (
            <p className="text-xs text-oo-stone-gray">
              Add modifier groups for choices like protein, toppings, or spice level on {itemName}.
            </p>
          ) : (
            groups.map((group) => (
              <ModifierGroupEditor
                key={group.id}
                itemId={itemId}
                group={group}
                editor={editor}
                disabled={disabled}
                newOptionName={newOptionName[group.id] ?? ""}
                newOptionPrice={newOptionPrice[group.id] ?? ""}
                onNewOptionNameChange={(value) =>
                  setNewOptionName((prev) => ({ ...prev, [group.id]: value }))
                }
                onNewOptionPriceChange={(value) =>
                  setNewOptionPrice((prev) => ({ ...prev, [group.id]: value }))
                }
                onAddOption={() => {
                  void editor
                    .addModifierOption(
                      itemId,
                      group.id,
                      newOptionName[group.id] ?? "New option",
                      newOptionPrice[group.id] ?? "0"
                    )
                    .then(() => {
                      setNewOptionName((prev) => ({ ...prev, [group.id]: "" }));
                      setNewOptionPrice((prev) => ({ ...prev, [group.id]: "" }));
                    });
                }}
              />
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}

function ModifierGroupEditor({
  itemId,
  group,
  editor,
  disabled,
  newOptionName,
  newOptionPrice,
  onNewOptionNameChange,
  onNewOptionPriceChange,
  onAddOption,
}: {
  itemId: string;
  group: VendorMenuBuilderModifierGroup;
  editor: Editor;
  disabled?: boolean;
  newOptionName: string;
  newOptionPrice: string;
  onNewOptionNameChange: (value: string) => void;
  onNewOptionPriceChange: (value: string) => void;
  onAddOption: () => void;
}) {
  const [name, setName] = useState(group.name);
  const [minSelections, setMinSelections] = useState(String(group.minSelections));
  const [maxSelections, setMaxSelections] = useState(String(group.maxSelections));
  const groupKey = `modgrp:${group.id}`;

  useEffect(() => {
    setName(group.name);
    setMinSelections(String(group.minSelections));
    setMaxSelections(String(group.maxSelections));
  }, [group.name, group.minSelections, group.maxSelections]);

  const commitBounds = (patch: {
    required?: boolean;
    minSelections?: number;
    maxSelections?: number;
  }) => {
    editor.updateModifierGroupFields(itemId, group.id, patch);
  };

  return (
    <div className="rounded-lg border border-oo-light-stone bg-oo-warm-white p-3">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-[10rem] flex-1 space-y-1">
          <input
            type="text"
            value={name}
            disabled={disabled}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => {
              const trimmed = name.trim();
              if (trimmed !== group.name) {
                editor.updateModifierGroupFields(itemId, group.id, { name: trimmed });
              }
            }}
            className="w-full rounded-lg border border-oo-light-stone px-3 py-2 text-sm"
            placeholder="Group name"
          />
          {editor.getEntityError(groupKey) ? (
            <p className="text-xs text-red-700">{editor.getEntityError(groupKey)}</p>
          ) : null}
        </div>
        <label className="flex items-center gap-2 text-xs text-oo-stone-gray">
          <input
            type="checkbox"
            checked={group.required}
            disabled={disabled}
            onChange={(e) => {
              const required = e.target.checked;
              const min = required ? Math.max(1, group.minSelections) : 0;
              setMinSelections(String(min));
              commitBounds({ required, minSelections: min });
            }}
          />
          Required
        </label>
        <label className="flex items-center gap-2 text-xs text-oo-stone-gray">
          Min
          <input
            type="number"
            min={0}
            value={minSelections}
            disabled={disabled}
            onChange={(e) => setMinSelections(e.target.value)}
            onBlur={() => {
              const min = Number(minSelections);
              if (!Number.isInteger(min)) return;
              if (min !== group.minSelections) commitBounds({ minSelections: min });
            }}
            className="w-14 rounded border border-oo-light-stone px-2 py-1 text-sm"
          />
        </label>
        <label className="flex items-center gap-2 text-xs text-oo-stone-gray">
          Max
          <input
            type="number"
            min={1}
            value={maxSelections}
            disabled={disabled}
            onChange={(e) => setMaxSelections(e.target.value)}
            onBlur={() => {
              const max = Number(maxSelections);
              if (!Number.isInteger(max)) return;
              if (max !== group.maxSelections) commitBounds({ maxSelections: max });
            }}
            className="w-14 rounded border border-oo-light-stone px-2 py-1 text-sm"
          />
        </label>
        <button
          type="button"
          disabled={disabled || editor.getEntityStatus(`modgrp-delete:${group.id}`) === "saving"}
          onClick={() => editor.removeModifierGroup(itemId, group.id)}
          className="text-xs text-red-700 hover:underline disabled:opacity-40"
        >
          Delete group
        </button>
      </div>

      <ul className="mt-3 space-y-2">
        {group.options.map((option) => (
          <ModifierOptionRow
            key={option.id}
            itemId={itemId}
            groupId={group.id}
            option={option}
            editor={editor}
            disabled={disabled}
          />
        ))}
      </ul>

      <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-oo-light-stone pt-3">
        <input
          type="text"
          value={newOptionName}
          disabled={disabled}
          onChange={(e) => onNewOptionNameChange(e.target.value)}
          placeholder="Option name"
          className="min-w-[8rem] flex-1 rounded-lg border border-oo-light-stone px-3 py-2 text-sm"
        />
        <div className="w-28">
          <div className="flex items-center overflow-hidden rounded-lg border border-oo-light-stone bg-white">
            <span className="select-none pl-2 text-xs text-oo-stone-gray">$</span>
            <input
              type="text"
              inputMode="decimal"
              value={newOptionPrice}
              disabled={disabled}
              onChange={(e) => onNewOptionPriceChange(e.target.value)}
              placeholder="0"
              className="min-w-0 flex-1 border-0 bg-transparent py-1.5 pr-2 text-sm outline-none"
            />
          </div>
        </div>
        <button
          type="button"
          disabled={disabled || editor.getEntityStatus(`modopt-create:${group.id}`) === "saving"}
          onClick={onAddOption}
          className="rounded-lg border border-oo-light-stone bg-oo-cream px-3 py-2 text-xs font-semibold disabled:opacity-50"
        >
          Add option
        </button>
      </div>
    </div>
  );
}

function ModifierOptionRow({
  itemId,
  groupId,
  option,
  editor,
  disabled,
}: {
  itemId: string;
  groupId: string;
  option: VendorMenuBuilderModifierGroup["options"][number];
  editor: Editor;
  disabled?: boolean;
}) {
  const [name, setName] = useState(option.name);
  const optionKey = `modopt:${option.id}`;

  useEffect(() => {
    setName(option.name);
  }, [option.name]);

  return (
    <li className="flex flex-wrap items-center gap-2 rounded-md bg-oo-cream/60 px-2 py-2">
      <input
        type="text"
        value={name}
        disabled={disabled}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => {
          const trimmed = name.trim();
          if (trimmed !== option.name) {
            editor.updateModifierOptionFields(itemId, groupId, option.id, { name: trimmed });
          }
        }}
        className="min-w-[8rem] flex-1 rounded-lg border border-oo-light-stone px-2 py-1.5 text-sm"
      />
      <div className="w-28">
        <MenuPriceInput
          cents={option.priceCents}
          compact
          disabled={disabled}
          error={editor.getEntityError(optionKey)}
          status={editor.getEntityStatus(optionKey)}
          onCommit={(raw) =>
            editor.updateModifierOptionFields(itemId, groupId, option.id, { price: raw })
          }
        />
      </div>
      <label className="flex items-center gap-1 text-xs">
        <input
          type="checkbox"
          checked={option.isAvailable}
          disabled={disabled}
          onChange={(e) =>
            editor.updateModifierOptionFields(itemId, groupId, option.id, {
              isAvailable: e.target.checked,
            })
          }
        />
        Available
      </label>
      <span className="text-xs text-oo-stone-gray">
        {formatCentsToCurrency(option.priceCents)} adj.
      </span>
      <button
        type="button"
        disabled={disabled || editor.getEntityStatus(`modopt-delete:${option.id}`) === "saving"}
        onClick={() => editor.removeModifierOption(itemId, groupId, option.id)}
        className="text-xs text-red-700 hover:underline disabled:opacity-40"
      >
        Delete
      </button>
    </li>
  );
}

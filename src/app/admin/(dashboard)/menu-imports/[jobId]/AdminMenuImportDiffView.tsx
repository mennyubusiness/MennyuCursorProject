import type { CanonicalMenuDiff } from "@/domain/menu-import/canonical-diff";

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatWhen(d: Date | null | undefined): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(d);
}

function DiffList({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-4">
      <h3 className="text-sm font-medium text-stone-800">{title}</h3>
      <div className="mt-2 text-sm text-stone-700">{children}</div>
    </div>
  );
}

export function AdminMenuImportDiffView({
  hasDraftMenu,
  publishedRow,
  diff,
  baselineError,
}: {
  hasDraftMenu: boolean;
  publishedRow: { id: string; publishedAt: Date | null } | null;
  diff: CanonicalMenuDiff | null;
  baselineError: string | null;
}) {
  if (!hasDraftMenu) {
    return (
      <section className="rounded-lg border border-stone-200 bg-white p-4">
        <h2 className="font-medium text-stone-900">Draft vs published</h2>
        <p className="mt-2 text-sm text-stone-600">
          Parse the draft canonical menu above to see what would change on publish.
        </p>
      </section>
    );
  }

  if (baselineError) {
    return (
      <section className="rounded-lg border border-amber-200 bg-amber-50 p-4">
        <h2 className="font-medium text-amber-950">Draft vs published</h2>
        <p className="mt-2 text-sm text-amber-900">{baselineError}</p>
        {publishedRow && (
          <p className="mt-1 font-mono text-xs text-amber-800/90">
            Published row: {publishedRow.id} (published {formatWhen(publishedRow.publishedAt)})
          </p>
        )}
      </section>
    );
  }

  if (!diff) return null;

  const s = diff.summary;
  const hasAnyChange =
    s.addedCategories +
      s.removedCategories +
      s.changedCategories +
      s.addedProducts +
      s.removedProducts +
      s.changedPrices +
      s.changedProductsOther +
      s.addedModifierGroups +
      s.removedModifierGroups +
      s.changedModifierGroups +
      s.addedModifierOptions +
      s.removedModifierOptions +
      s.changedModifierOptions >
    0;

  return (
    <section className="rounded-lg border border-stone-200 bg-white p-4">
      <h2 className="font-medium text-stone-900">Draft vs published</h2>
      <p className="mt-1 text-sm text-stone-600">
        Comparison uses Deliverect ids in canonical snapshots only (not live `MenuItem` rows).
      </p>

      {diff.isFirstPublish ? (
        <div className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-950">
          <strong>First publish</strong> — no published <code className="text-xs">MenuVersion</code> for this
          vendor. Everything in the draft would be created on first publish.
        </div>
      ) : (
        <div className="mt-3 rounded-md border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-800">
          Compared to published version{" "}
          <span className="font-mono text-xs">{diff.publishedVersionId}</span>
          {publishedRow?.publishedAt && (
            <>
              {" "}
              · <span className="text-stone-600">{formatWhen(publishedRow.publishedAt)}</span>
            </>
          )}
        </div>
      )}

      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {[
          ["+ Categories", s.addedCategories],
          ["− Categories", s.removedCategories],
          ["~ Categories", s.changedCategories],
          ["+ Products", s.addedProducts],
          ["− Products", s.removedProducts],
          ["~ Prices", s.changedPrices],
          ["~ Product fields", s.changedProductsOther],
          ["+ Mod groups", s.addedModifierGroups],
          ["− Mod groups", s.removedModifierGroups],
          ["~ Mod groups", s.changedModifierGroups],
          ["+ Mod options", s.addedModifierOptions],
          ["− Mod options", s.removedModifierOptions],
          ["~ Mod options", s.changedModifierOptions],
        ].map(([label, n]) => (
          <div
            key={label}
            className="flex items-center justify-between rounded border border-stone-100 bg-stone-50/80 px-3 py-2 text-sm"
          >
            <span className="text-stone-600">{label}</span>
            <span className="font-mono font-medium text-stone-900">{n}</span>
          </div>
        ))}
      </div>

      {!diff.isFirstPublish && !hasAnyChange && (
        <p className="mt-4 text-sm text-stone-600">
          No differences detected vs published canonical snapshot (Deliverect id–based).
        </p>
      )}

      {(diff.addedCategories.length > 0 || diff.removedCategories.length > 0 || diff.changedCategories.length > 0) && (
        <DiffList title="Categories" emptyHint="">
          <ul className="space-y-2">
            {diff.addedCategories.map((c) => (
              <li key={`add-c-${c.deliverectId}`} className="text-emerald-800">
                <span className="font-medium">+</span> {c.name}{" "}
                <span className="font-mono text-xs text-stone-500">({c.deliverectId})</span>
              </li>
            ))}
            {diff.removedCategories.map((c) => (
              <li key={`rm-c-${c.deliverectId}`} className="text-red-800">
                <span className="font-medium">−</span> {c.name}{" "}
                <span className="font-mono text-xs text-stone-500">({c.deliverectId})</span>
              </li>
            ))}
            {diff.changedCategories.map((c) => (
              <li key={`ch-c-${c.deliverectId}`} className="text-amber-900">
                <span className="font-medium">~</span> {c.name}{" "}
                <span className="font-mono text-xs text-stone-500">({c.deliverectId})</span> — {c.details}
              </li>
            ))}
          </ul>
        </DiffList>
      )}

      {(diff.addedProducts.length > 0 || diff.removedProducts.length > 0) && (
        <DiffList title="Added / removed products">
          <ul className="space-y-2">
            {diff.addedProducts.map((p) => (
              <li key={`add-p-${p.deliverectId}`} className="text-emerald-800">
                <span className="font-medium">+</span> {p.name} {formatCents(p.priceCents)}{" "}
                <span className="font-mono text-xs text-stone-500">({p.deliverectId})</span>
              </li>
            ))}
            {diff.removedProducts.map((p) => (
              <li key={`rm-p-${p.deliverectId}`} className="text-red-800">
                <span className="font-medium">−</span> {p.name} {formatCents(p.priceCents)}{" "}
                <span className="font-mono text-xs text-stone-500">({p.deliverectId})</span>
              </li>
            ))}
          </ul>
        </DiffList>
      )}

      {diff.changedPrices.length > 0 && (
        <DiffList title="Changed prices" emptyHint="">
          <ul className="space-y-2">
            {diff.changedPrices.map((p) => (
              <li key={`price-${p.deliverectId}`}>
                <span className="font-medium text-stone-900">{p.name}</span>{" "}
                <span className="font-mono text-xs text-stone-500">({p.deliverectId})</span>
                <div className="text-stone-700">
                  {formatCents(p.oldCents)} → {formatCents(p.newCents)}
                </div>
              </li>
            ))}
          </ul>
        </DiffList>
      )}

      {diff.changedProductsOther.length > 0 && (
        <DiffList title="Changed products (non-price)">
          <ul className="space-y-2">
            {diff.changedProductsOther.map((p) => (
              <li key={`pf-${p.deliverectId}`}>
                <span className="font-medium text-stone-900">{p.name}</span>{" "}
                <span className="font-mono text-xs text-stone-500">({p.deliverectId})</span>
                <div className="text-stone-600">{p.details}</div>
              </li>
            ))}
          </ul>
        </DiffList>
      )}

      {(diff.modifierChanges.addedGroups.length > 0 ||
        diff.modifierChanges.removedGroups.length > 0 ||
        diff.modifierChanges.changedGroups.length > 0 ||
        diff.modifierChanges.addedOptions.length > 0 ||
        diff.modifierChanges.removedOptions.length > 0 ||
        diff.modifierChanges.changedOptions.length > 0) && (
        <DiffList title="Modifier groups & options">
          <ul className="space-y-2">
            {diff.modifierChanges.addedGroups.map((g) => (
              <li key={`add-g-${g.deliverectId}`} className="text-emerald-800">
                <span className="font-medium">+ group</span> {g.name}{" "}
                <span className="font-mono text-xs">({g.deliverectId})</span>
              </li>
            ))}
            {diff.modifierChanges.removedGroups.map((g) => (
              <li key={`rm-g-${g.deliverectId}`} className="text-red-800">
                <span className="font-medium">− group</span> {g.name}{" "}
                <span className="font-mono text-xs">({g.deliverectId})</span>
              </li>
            ))}
            {diff.modifierChanges.changedGroups.map((g) => (
              <li key={`ch-g-${g.deliverectId}`} className="text-amber-900">
                <span className="font-medium">~ group</span> {g.name}{" "}
                <span className="font-mono text-xs">({g.deliverectId})</span> — {g.details}
              </li>
            ))}
            {diff.modifierChanges.addedOptions.map((o) => (
              <li key={`add-o-${o.groupId}-${o.optionId}`} className="text-emerald-800">
                <span className="font-medium">+ option</span> {o.optionName} in {o.groupName}{" "}
                <span className="font-mono text-xs">
                  ({o.optionId} / {o.groupId})
                </span>
              </li>
            ))}
            {diff.modifierChanges.removedOptions.map((o) => (
              <li key={`rm-o-${o.groupId}-${o.optionId}`} className="text-red-800">
                <span className="font-medium">− option</span> {o.optionName} in {o.groupName}{" "}
                <span className="font-mono text-xs">
                  ({o.optionId} / {o.groupId})
                </span>
              </li>
            ))}
            {diff.modifierChanges.changedOptions.map((o) => (
              <li key={`ch-o-${o.groupId}-${o.optionId}`} className="text-amber-900">
                <span className="font-medium">~ option</span> {o.optionName} in {o.groupName}{" "}
                <span className="font-mono text-xs">
                  ({o.optionId} / {o.groupId})
                </span>
                <div className="text-stone-700">{o.details}</div>
              </li>
            ))}
          </ul>
        </DiffList>
      )}
    </section>
  );
}

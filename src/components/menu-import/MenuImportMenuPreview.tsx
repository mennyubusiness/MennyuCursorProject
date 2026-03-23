import type { MennyuCanonicalMenu } from "@/domain/menu-import/canonical.schema";
import { formatModifierMaxSelectionsLabel } from "@/domain/modifier-selection-unbounded";

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function MenuImportMenuPreview({
  menu,
  parseError,
  draftVersionId,
  /** Hide internal Deliverect ids in the main preview (ids still in Advanced). */
  hideDeliverectIds = true,
}: {
  menu: MennyuCanonicalMenu | null;
  parseError: string | null;
  draftVersionId: string | null;
  hideDeliverectIds?: boolean;
}) {
  if (!draftVersionId) {
    return <p className="text-sm text-stone-600">No draft menu linked to this update.</p>;
  }
  if (parseError) {
    return (
      <p className="text-sm text-red-700">
        Couldn&apos;t read the draft menu snapshot: {parseError}
      </p>
    );
  }
  if (!menu) {
    return <p className="text-sm text-stone-600">No preview available.</p>;
  }

  const productById = new Map(menu.products.map((p) => [p.deliverectId, p]));
  const groupById = new Map(menu.modifierGroupDefinitions.map((g) => [g.deliverectId, g]));

  const sortedCategories = [...menu.categories].sort((a, b) => a.sortOrder - b.sortOrder);

  const productIdsInCategories = new Set<string>();
  for (const c of menu.categories) {
    for (const pid of c.productDeliverectIds) productIdsInCategories.add(pid);
  }
  const orphanProducts = menu.products.filter((p) => !productIdsInCategories.has(p.deliverectId)) ?? [];
  const productCount = menu.products.length;

  return (
    <div className="space-y-6">
      {sortedCategories.map((cat) => (
        <div key={cat.deliverectId} className="border-l-2 border-stone-300 pl-3">
          <h3 className="font-medium text-stone-900">
            {cat.name}
            {!hideDeliverectIds && (
              <span className="font-mono text-xs font-normal text-stone-500"> ({cat.deliverectId})</span>
            )}
          </h3>
          <ul className="mt-2 space-y-3">
            {cat.productDeliverectIds.map((pid) => {
              const p = productById.get(pid);
              if (!p) {
                return (
                  <li key={pid} className="text-sm text-amber-800">
                    Missing product reference.
                    {!hideDeliverectIds && (
                      <>
                        {" "}
                        <span className="font-mono">{pid}</span>
                      </>
                    )}
                  </li>
                );
              }
              return (
                <li key={pid} className="rounded-md bg-stone-50 p-3 text-sm">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-medium text-stone-900">{p.name}</span>
                    <span className="font-mono text-stone-700">{formatCents(p.priceCents)}</span>
                  </div>
                  {!hideDeliverectIds && (
                    <div className="mt-0.5 font-mono text-xs text-stone-500">{p.deliverectId}</div>
                  )}
                  {!p.isAvailable && (
                    <span className="mt-1 inline-block text-xs text-red-700">Unavailable</span>
                  )}
                  {p.modifierGroupDeliverectIds.length > 0 && (
                    <div className="mt-2 space-y-2 border-t border-stone-200 pt-2">
                      {p.modifierGroupDeliverectIds.map((gid) => {
                        const g = groupById.get(gid);
                        if (!g) {
                          return (
                            <div key={gid} className="text-xs text-amber-800">
                              Unknown modifier group
                              {!hideDeliverectIds && (
                                <>
                                  : <span className="font-mono">{gid}</span>
                                </>
                              )}
                            </div>
                          );
                        }
                        return (
                          <div key={gid}>
                            <div className="text-xs font-medium text-stone-700">
                              {g.name}
                              {!hideDeliverectIds && (
                                <span className="font-mono font-normal text-stone-500">
                                  {" "}
                                  ({g.deliverectId}) · min {g.minSelections} / max{" "}
                                  {formatModifierMaxSelectionsLabel(g.maxSelections)}
                                </span>
                              )}
                              {hideDeliverectIds && (
                                <span className="font-normal text-stone-500">
                                  {" "}
                                  · min {g.minSelections} / max {formatModifierMaxSelectionsLabel(g.maxSelections)}
                                </span>
                              )}
                            </div>
                            <ul className="ml-2 mt-1 list-inside list-disc text-xs text-stone-600">
                              {g.options.map((o) => (
                                <li key={o.deliverectId}>
                                  {o.name} {formatCents(o.priceCents)}
                                  {!o.isAvailable && " · off"}
                                  {o.isDefault && " · default"}
                                </li>
                              ))}
                            </ul>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
      {sortedCategories.length === 0 && productCount > 0 && (
        <p className="text-sm text-stone-600">
          No categories in this menu; {productCount} product(s) in a flat list only — check issues if unexpected.
        </p>
      )}
      {orphanProducts.length > 0 && (
        <div className="border-t border-stone-200 pt-4">
          <h3 className="text-sm font-medium text-stone-800">
            Products not under a category ({orphanProducts.length})
          </h3>
          <ul className="mt-2 space-y-2 text-sm text-stone-700">
            {orphanProducts
              .slice()
              .sort((a, b) => a.sortOrder - b.sortOrder)
              .map((p) => (
                <li key={p.deliverectId}>
                  <span className="font-medium text-stone-900">{p.name}</span> · {formatCents(p.priceCents)}
                  {!hideDeliverectIds && (
                    <>
                      {" "}
                      · <span className="font-mono text-xs">{p.deliverectId}</span>
                    </>
                  )}
                </li>
              ))}
          </ul>
        </div>
      )}
    </div>
  );
}

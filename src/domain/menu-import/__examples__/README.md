# Menu import Phase 1A examples

- **`deliverect-menu-fragment.sample.json`** — minimal Deliverect-style menu fragment (`products` + `categories` + nested `subProducts` for modifier groups/options).
- **`canonical-output.sample.ts`** — expected `MennyuCanonicalMenu` after normalization (IDs map to `deliverectId` fields; prices are **cents**).

Run the real pipeline:

```ts
import fragment from "./deliverect-menu-fragment.sample.json";
import { runPhase1aDeliverectMenuImport } from "@/integrations/deliverect/menu";

const result = runPhase1aDeliverectMenuImport({
  raw: fragment,
  vendorId: "vendor_sample",
  deliverect: {
    sourcePayloadKind: "deliverect_menu_api_v1",
    menuId: "sample-menu-001",
  },
});
```

Adjust `unwrapMenuRoot` / extractors in `integrations/deliverect/menu/normalize.ts` when your production Deliverect menu JSON shape is confirmed.

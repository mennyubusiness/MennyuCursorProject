# Menu import UI — simplified workflow

## 1. Final screen structure

### List (vendor + admin)

| Area | Content |
|------|---------|
| Title + one-line intro | What this page is (no internal jargon) |
| Optional callout | Only when there are imports awaiting review (admin: pending count) |
| Table | **Updated** · **Vendor** (admin only) · **Status** (single badge) · **Summary** (one line) · **Action** (Review / View) |
| Highlight | Latest actionable row (subtle row background) |

### Review (vendor + admin)

| Section | Purpose |
|---------|---------|
| **Header** | Back link · Title “Menu update” · Vendor name (admin) · Friendly status line · Job id in `Advanced` only |
| **What to do** | Single callout: ready to publish / blocked / newer import exists / not ready |
| **What changed** | Compact bullet list from diff summary (non-zero counts) |
| **Issues** | Blocking first, then warnings; hide raw codes in main line (optional `Advanced`) |
| **Menu preview** | Readable categories → products → modifiers (IDs optional / in Advanced) |
| **Actions** | Publish · Discard · Back (single visual group) |
| **Detailed diff** | Collapsible “Detailed change list” (`AdminMenuImportDiffView`) |
| **Advanced** | Technical metadata, Deliverect IDs, raw JSON, canonical JSON |

## 2. Reuse

- `fetchAdminMenuImportJobDetail`, diff/publish eligibility services (unchanged)
- `src/components/menu-import/MenuImportPublishPanel` (shared; `variant="minimal"` for vendor), `MenuImportDiscardDraftButton`
- `MenuImportWhatChanged`, `MenuImportIssuesList`, `MenuImportMenuPreview`, `MenuImportAdvancedDetails`, `MenuImportJobNextStepsAdmin` (`mode="vendor"` hides admin-only banners)
- `AdminMenuImportDiffView` (moved under collapsible)
- `vendorMenuImportListBadge` / labels via `menu-import-ui-labels.ts`

## 3. Remove / collapse

- Duplicate admin banners (latest + publish CTA) → one **Next step** callout
- Table columns: Source enum, Draft id, Flags pile, mono Status
- Summary DL with every internal field in main flow
- Count cards grid (replaced by “What changed” + issues)
- Vendor publish/discard as separate heavy panels → same action group styling
- Raw JSON except under **Advanced**
- Legacy vendor auth blurb on publish panel (`hideAuthBlurb`)

## 4. Implementation (this pass)

1. `menu-import-ui-labels.ts` + `publish-summary-rows.ts`
2. Shared components: `MenuImportWhatChanged`, `MenuImportIssuesList`, `MenuImportMenuPreview`, `MenuImportAdvancedDetails`, `MenuImportNextStepCallout`
3. Refactor admin + vendor review pages
4. Simplify list pages
5. Tweak `MenuImportPublishPanel` (`variant="minimal"`)

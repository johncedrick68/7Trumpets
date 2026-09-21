# 1968 Clothing — Impeccable Visual Audit

**Audit mode:** Preserve-mode final craft pass  
**Completed:** 2026-09-21  
**Design read:** Premium Filipino streetwear storefront with restrained monochrome merchandising; compact, direct retail operations software for Admin and POS.  
**Storefront dials:** variance 6 / motion 3 / density 4  
**Admin and POS dials:** variance 3 / motion 2 / density 7

This report is evidence-led. Development-only Next.js controls were excluded. No retail business rule or production data was changed.

## Initial Findings

| ID | Route / viewport | Finding | Severity | Resolution |
|---|---|---|---|---|
| VIS-001 | `/products`, 390×844 | An earlier load logged `catalog.categories database_failure` while products still rendered. | P1 | Not reproducible after the local database stabilized. Grants and RLS are correct; repeated development and fresh production loads returned all categories with no new error. Kept as a monitored transient, not hidden. |
| VIS-002 | `/products`, 390×844 | `TGP ??? Triskelion` was visible customer copy. | P1 | Corrected the ASCII-safe seed value and the local fixture through the existing data path. |
| VIS-003 | `/products`, 360–430 | The category rail clips its next chip without a strong scroll cue. | P2 | Kept horizontal overflow as a deliberate cue; links remain keyboard reachable and 44px tall. No page overflow. |
| VIS-004 | `/products`, mobile | Product media edges disappeared against the page. | P2 | Added a restrained media-only hairline, focus ring, press feedback, and reduced-motion-safe 1.02 pointer hover. Metadata remains borderless. |
| VIS-005 | `/products`, all | Catalog query search support existed but the visible search UI had been removed. | P1 | Restored explicit-submit product search with label, real button, Enter search hint, special-character-safe query handling, and contextual no-results guidance. |
| VIS-006 | PDP, mobile | `Size Guide` measured about 32px high. | P1 | Increased the real rendered hit area to 44px without adding visual weight. |
| VIS-007 | PDP gallery | Needed keyboard/overflow/zoom verification. | P2 candidate | Verified contained page width, focusable gallery controls, dialog Escape, and focus return. No gallery rewrite. |
| VIS-008 | Size Guide, 390×844 | Strong existing semantic dialog/table implementation. | KEEP | Preserved. Close receives focus, Escape exits, focus returns to the 44px trigger, and internal horizontal scrolling stays contained. |
| VIS-009 | Auth, 390×844 | Previously reported spacing defects were not present. | KEEP | Preserved shared auth geometry; Login, Signup, and Recovery remain contained at narrow widths. |
| VIS-010 | `/admin`, mobile | Decorative blue/violet/teal/green KPI cards resembled a generic AI dashboard. | P1 | Converted performance metrics and supporting insights to neutral operational surfaces; retained semantic amber/green only for actual states. |
| VIS-011 | `/admin`, mobile | Essential channel metadata used 10px mono text. | P1 | Moved channel totals out of the uneven tile and raised operational metadata to a readable 12px tabular system face. |
| VIS-012 | Admin search | Source classes appeared correct, but rendered input padding was only 14px and collided with the icon. | P1 | Fixed the shared computed inset to 44px, retained a real clear action, and shortened Orders/Payments/POS placeholders. Rendered measurement confirmed 44px. |
| VIS-013 | Admin filters | Mobile rails clip the next status control. | P2 candidate | Preserved as an intentional horizontal-scroll cue; no document overflow and active state remains textual. |
| VIS-014 | `/admin/orders`, mobile | Dense micro-metadata and hairlines weakened scanning. | P1 | Existing resource-card conversion retained; search and queue hierarchy were corrected. Operational metadata remains legible in the rendered production queue. |
| VIS-015 | `/admin/payments`, mobile | Two adjacent empty explanations repeated the same state. | P2 | Removed the redundant right-pane empty state. The queue now gives one contextual recovery message; the separate expired-orders state remains because it represents a different workflow. |
| VIS-016 | Customer header, mobile | Header geometry and target sizes were already sound. | KEEP | Preserved; menu scroll lock, Escape, route close, and focus return verified. |
| VIS-017 | Customer footer | No Admin link and no dead mobile void. | KEEP | Preserved. |
| VIS-018 | Cart/Payments loading, 360–390 | Fixed-width skeletons caused transient horizontal overflow even though loaded pages were clean. | P1 | Made Cart skeleton rows responsive and capped Payments title/description skeletons at available width. |
| VIS-019 | Checkout pickup copy | Customer copy hard-coded “Makati Flagship Store” instead of existing Store Settings data. | P1 | Reads the established fulfillment `pickup_address`; no new content system or business behavior. |
| VIS-020 | POS, 768–820 | Category controls rendered at 32px despite 44px source classes; mixed variant counts created stretched product cards and dead white areas. | P1 | Enforced computed tablet touch heights and changed narrow/tablet product groups to compact single-column rows; multi-column density begins only when workspace width supports it. |
| VIS-021 | Customer money typography | Checkout and order-detail totals used mono. | P2 | Customer-facing monetary values now use system sans with tabular numerals; mono remains for SKUs, order IDs, references, and operational metadata. |

## Fixed

- Restored catalog search and contextual no-results recovery.
- Corrected the real icon/text spacing defect at the shared input level (`44px` computed left inset).
- Corrected the corrupted TGP product fixture.
- Improved product-media definition without turning cards into SaaS panels.
- Raised the Size Guide trigger to a real 44px target.
- Neutralized decorative Admin KPI/insight surfaces and removed 10px essential channel text.
- Removed duplicate Payments queue empty copy.
- Removed narrow-screen loading skeleton overflow.
- Made checkout pickup copy Store Settings-driven.
- Corrected POS tablet touch targets and variable-height product-card whitespace.
- Replaced customer-facing mono prices in the touched checkout/order surfaces.

## Intentionally Kept

- Borderless product metadata and restrained neutral product stages.
- Horizontal filter rails whose partially visible next item communicates scrollability.
- The established five-stage customer order model and all exception-state separation.
- Size Guide semantic table, diagram, fit note, and Shadcn focus management.
- Mobile Admin Orders resource cards instead of a compressed desktop table.
- Semantic amber “Needs attention” treatment in Admin; it carries real operational meaning.
- Storefront and Admin remain visually distinct.

## False Positives

- **Catalog database failure:** not reproducible after database operations completed; current development and production loads are clean.
- **Admin Orders search collision based on class inspection:** the original class names looked sufficient, but rendered measurement proved they were not. This became a real finding and was fixed at computed-style level.
- **Mobile Size Guide close control:** already visible, focusable, and comfortably sized.
- **Loaded-page horizontal overflow:** not present across the required matrix; only two loading skeletons overflowed and were fixed.
- **Lazy images reported with zero natural width:** these were below-viewport/collapsed lazy assets, not failed requests; production console stayed clean.

## Customer QA

- Rendered and inspected Home, Products, multiple PDP/product assets, gallery/Size Guide, populated and empty Cart, Checkout redirect/precondition, Login, Signup, Forgot Password, Account, Addresses, Orders, Order Detail data via empirical flows, and 404.
- Product search passed empty/default, valid catalog, no-result, long/special-character encoding, Enter/explicit submit, and no-overflow behavior.
- Cart loaded and skeleton layouts are contained at 360, 375, 390, and 430.
- Account home exposes default-address recovery and real recent-order actions rather than decorative filler.
- Checkout continues to require a delivery address and uses configured shipping/payment/pickup data.

## Admin QA

- Rendered and inspected Dashboard, Orders, Payments, Catalog, Returns, Settings, Audit, Users, and route authorization.
- Mobile Orders uses scan-first resource cards; desktop/tablet retain operational density.
- Payments search/filter/empty states are distinct and non-duplicative.
- Sensitive mutation wording and AAL2 boundaries were preserved.
- Production Admin pages rendered with authenticated AAL2 and no browser warnings/errors.

## POS QA

- Explicitly inspected at 768×1024, 820×1180, 1024×768, and desktop widths.
- Search has 44px computed icon inset and clear behavior.
- Tablet category/register controls meet 44px targets; desktop density is retained.
- Sale ticket remains reachable through the fixed “Review sale” action when populated and off screen.
- The 12-flow empirical suite verified register, cash/GCash POS sales, receipts, fulfillment, cancellation, refunds, and exchanges.

## Accessibility

- Important touch controls measure at least 44px on touch layouts after fixes.
- Mobile menu: first-link focus, background scroll lock, Escape close, route close, and trigger focus return verified.
- Size Guide: dialog semantics, initial close focus, Escape, trigger focus return, contained scrolling, and semantic table verified.
- Search fields use labels, `type="search"`, `enterKeyHint="search"`, visible coherent focus, and a distinct clear button where live filtering applies.
- Statuses are never color-only; text remains present.
- Reduced-motion handling is retained for new product-media feedback.

## Responsive Matrix

No loaded-page document overflow was found at `360×800`, `375×667`, `390×844`, `430×932`, `768×1024`, `820×1180`, `1024×768`, `1280×720`, `1366×768`, `1440×900`, `1536×864`, `1680×900`, or `1920×1080` on representative customer/Admin/POS routes. Representative 125% and 150% reflow-equivalent checks (1152px and 960px effective CSS widths) passed Products, PDP, Cart, Account, Admin Orders, Payments, and Catalog without clipping.

## Performance

- Optimized production build passed; shared first-load JS is 103 kB.
- Next Image responsive sizing remains in use for customer catalog/PDP assets.
- Fresh production navigation across ten representative surfaces produced zero browser warnings or errors and no broken in-view images.
- No Lighthouse score is claimed; this pass fixed observable layout/asset issues rather than optimizing to an arbitrary score.

## Security Default Privilege Result

- Clean local replay applied all **25 migrations**.
- `postgres` is the migration function owner/creator role.
- The first schema-scoped revoke was empirically shown to be insufficient because PostgreSQL's global `PUBLIC EXECUTE` baseline still applied.
- A second forward migration removes the owner-wide future-function default. Applied history was not rewritten.
- Existing RPC ACL output before and after reset is exactly identical.
- A disposable `public._qa_default_acl_probe()` had ACL `postgres=X/postgres`; `PUBLIC`, `anon`, `authenticated`, and `service_role` all returned `false` for execute privilege.
- The transaction rolled back and `to_regprocedure(...) is null` verified that no QA function remained.

## Validation

- `npm test`: **68 passed, 0 failed**.
- `npm run typecheck`: passed.
- `npm run lint`: passed with no output.
- `npm run build`: passed; 29 routes compiled.
- Clean Supabase replay: passed, 25 migrations.
- Empirical master retail suite: **12/12 flows passed**, including direct AAL1 shipment-RPC denial and AAL2 success path.
- Fresh production browser: Products, PDP, Cart, Account, Orders, Admin Dashboard, Orders, Payments, Catalog, and POS all rendered without page overflow or console warnings/errors.

## Remaining Limitations

- No Lighthouse score is reported.
- Email delivery, third-party GCash confirmation, and courier-site uptime remain external integration concerns and were not altered in this visual pass.
- Product source imagery is treated as supplied brand artwork. No CSS crop was used to conceal embedded pixels; replacement rights/copyright approval remains a content-owner responsibility.

**Result:** FINAL DESIGN / TASTE QA PASSED. All recorded P0/P1 visual findings are closed with rendered or empirical evidence.

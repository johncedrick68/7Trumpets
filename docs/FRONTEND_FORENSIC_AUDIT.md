# 1968 Clothing Frontend Forensic Audit

**Scope:** Read-only inspection of the current project, local Supabase data, rendered browser UI, product assets, and the supplied UI references.  
**Audit date:** 2026-09-20  
**Code changes:** None. This document is the only file added.  
**Evidence standard:** A capability is marked proven only when its UI, server boundary, database effect, authorization, and storefront behavior can be traced. No destructive catalog or order mutations were performed.

## CURRENT STATE

The application has a strong server-authoritative commerce foundation and a substantially improved responsive shell. The public catalog, account pages, operational queues, product-media storage, and checkout all read real local Supabase data. Admin mutations generally use AAL2-gated server actions and hardened PostgreSQL RPCs.

The frontend is not yet a finished product-management or media-shopping experience. Catalog editing is concentrated in one very tall screen; several backend capabilities are missing from the UI; some edit forms silently omit existing fields; the customer gallery is non-interactive; and business content is split between settings, database product data, source code, and baked-in image artwork.

The most consequential findings are:

1. Editing a product cannot edit its description and submits no description, so an existing description can be cleared.
2. The variant form exposes `draft`, but the database accepts `active`, `inactive`, or `archived`; `draft` is rejected and `inactive` is not offered.
3. Existing product options and option values have backend RPCs but no visible admin workflow. A new size variant can therefore be created without its canonical option mapping.
4. Category archive/reactivation, hierarchy, and position exist in the RPC but are not exposed in the dialog. Safe deletion is not implemented.
5. Inventory adjustments are supported, but movement history is not visible in Catalog.
6. Product image ordering controls the database and product cards, but PDP thumbnails are not interactive and are hidden on mobile. There is no zoom, swipe, pinch, or image lightbox.
7. The 390 px cart currently has horizontal overflow (`437 px` document width against `385 px` client width).
8. The mobile size-guide dialog is partly covered by the sticky storefront header; its built-in top-right close control is only about `16×16 px`, while the usable 44 px footer close remains at the bottom.
9. The primary product composites contain the 1968 logo and red rights-reserved strip inside the bitmap. CSS cannot remove them.

## PROVEN WORKING

### Platform and shell

- The previous CSS MIME problem remains fixed. The live stylesheet returned `200` with `text/css; charset=UTF-8`; representative JS assets returned `200` with JavaScript MIME types.
- The representative browser audit accumulated no console errors or warnings across customer and admin routes.
- No broken rendered images were detected in the six-viewport route matrix.
- Storefront and admin chrome are separated; `/admin/*` does not display customer announcement/header/footer chrome.
- Mobile admin navigation uses a Shadcn Sheet and desktop uses a fixed operations sidebar.
- Loading skeletons exist for the main customer and operational routes.

### Catalog and retail authority

- Published products, active variants, prices, categories, inventory, and image order are read from Supabase.
- Product/variant/category/inventory/media mutations require an authenticated admin with AAL2 in both the server action and PostgreSQL RPC.
- Authoritative prices use integer minor units; the variant server action parses decimal PHP input into centavos.
- Inventory adjustment is transactional, row-locked, idempotent, rejects negative stock, respects reserved/safety stock, and writes inventory and audit ledgers.
- Product media accepts WebP/JPEG/PNG only, validates content bytes, limits size to 5 MB, writes to the public `product-images` bucket, and compensates by deleting the uploaded object if the database attachment fails.
- Media reorder/set-primary is atomic per product and persists normalized positions in PostgreSQL.
- The first ordered image controls `/`, `/products`, category cards, PDP lead media, cart media, and POS media through the database query layer.
- Local data currently contains 11 published products. Rise to Defend has 3 images and 5 variants. The upload UI and RPC impose no three-image cap, so a fourth image can be added sequentially.

## BROKEN

### P0 functional defects

- **Product edit is destructive to description.** `admin/catalog` fetches `description`, and `saveProduct` writes it, but `ProductDialog` has no description field. Editing an existing product sends no description and can replace the stored value with `NULL`.
- **Variant status contract mismatch.** `VariantDialog` offers `active`, `draft`, and `archived`. `admin_save_variant` accepts `active`, `inactive`, and `archived`. Selecting Draft fails; a staff member cannot select Inactive.
- **Canonical variant option mapping is inaccessible.** Server actions/RPCs exist for product options, option values, and variant-option assignment, but Catalog exposes none of them. For products with a Size option, a newly created variant may not resolve through the PDP option selector.

### P1 rendered defects

- **390 px cart overflow:** at `390×844`, the document measured `437 px` wide against a `385 px` content viewport. The item control row (quantity, update, line total, remove) is the likely source. Other audited routes did not horizontally overflow at this size.
- **768 px admin Catalog overflow:** at `768×1024`, Catalog measured `829 px` wide against a `762 px` client viewport because the desktop table breakpoint activates too early.
- **Size-guide header collision:** the sticky storefront header remains above the modal. On `390×844`, the dialog title is clipped/covered at the top.
- **Size-guide close affordance:** Radix supplies a top-right close control, but its rendered hit area is about `16×16 px`, below the 44 px touch-target requirement and visually obscured by the header. The footer close is 44 px and usable but forces a second close pattern.

## MISLEADING

- Product, category, and variant edit triggers are pencil icons without visible text or tooltips. They have no explicit `aria-label`; a screen reader receives only generic button semantics.
- Product media actions have good accessible labels, but four adjacent icons (primary/up/down/delete) require staff to infer workflow from symbols.
- Catalog says it manages “products, categories, variants, media, pricing, and stock,” but it does not expose product options, inventory history, category archive, or batch media upload.
- “Display order” in Add Image invites manual number entry even though subsequent movement uses relative up/down controls. Duplicate positions are allowed at insertion and only normalized after reorder.
- The Add Image dialog calls variant selection optional but shows variants from every product in one flat list. The database correctly rejects cross-product selection, yet the UI lets staff choose an invalid pair and only reports a generic failure.
- The account page is functionally useful for profile/contact data and links to addresses, orders, and password settings, but it is still mainly a settings form. It lacks a compact “next useful action” summary such as recent order, address readiness, or unresolved payment.
- “Verified Merchant” is asserted by UI copy; this is not derived from a verifiable merchant-status field.
- The development-only circular `N` control that overlaps lower mobile content is the Next.js development toolbar, not an application control. It should not appear in production and should not be redesigned as product UI.

## MISSING

### Catalog operations

- Inventory movement/history view per SKU.
- Product option and option-value management UI.
- Variant-to-option assignment UI.
- Category archive/reactivate UI and dependency-aware safe-delete workflow.
- Product description editing.
- Media upload preview before submission.
- Multi-file/batch upload; current upload is one file per submission.
- Variant-filtered media management and clearer product-scoped upload entry points.
- Search, filters, pagination, and focused product detail/edit workspace for the 11-product Catalog.
- Human-readable error mapping for product/category/variant/inventory failures. Most fall through to “The catalog could not be updated.”
- Persistent non-navigation mutation feedback. Redirect banners work, but Sonner is installed without a mounted/used Toaster.

### Customer media experience

- Clickable PDP thumbnails.
- Selected-image state and visible selected thumbnail.
- Openable main image/lightbox.
- Desktop hover/click zoom.
- Mobile carousel/swipe.
- Mobile pinch/detailed zoom.
- Mobile access to secondary images; the thumbnail grid is `lg`-only.
- A count or other discoverability cue for additional media.

## HARDCODED

| Value/content | Current source | Classification | Finding |
|---|---|---|---|
| Announcement text/link/enabled | `store_settings.announcement` with source fallback | BUSINESS_SETTING | Correctly admin-managed. |
| Hero title/subtitle/CTA | `store_settings.hero` with source fallback | BUSINESS_SETTING | Correctly admin-managed. |
| Hero artwork/banner | `/public/images/1968 Clothing Banner transparent.png` | BUSINESS_SETTING | Static; no Admin media control. |
| “01 / Drop 01 Archive” | Homepage source | BUSINESS_SETTING | Should be editable with hero/campaign. |
| “Drop 01 Pieces” collection heading | Homepage source | BUSINESS_SETTING | Static campaign copy. |
| Homepage featured selection | First four products returned by newest order | PRODUCT_DATA / BUSINESS_SETTING | Database products, but merchandising selection is not admin-curated. |
| Homepage value propositions and brand story | Homepage source | BUSINESS_SETTING | Marketing copy should be editable if operations owns content. |
| Shipping fee | `store_settings.fulfillment`, trusted again server-side | BUSINESS_SETTING | Checkout uses it correctly; Cart separately hardcodes ₱150 and can disagree. |
| Free-shipping threshold | `store_settings.fulfillment` | BUSINESS_SETTING | Admin-editable but not applied by cart/checkout calculation; announcement mentions it independently. |
| Store pickup enabled/address | `store_settings.fulfillment` plus hardcoded Makati wording | BUSINESS_SETTING | Partly managed; several checkout strings still hardcode “Makati Flagship Store.” |
| GCash number/account name/enabled | `store_settings.payment` with source fallback | BUSINESS_SETTING | Checkout/POS use settings; the downloadable QR remains a static file and can become inconsistent. |
| GCash QR image | `/public/images/gcash-merchant-qr.svg` | BUSINESS_SETTING / SECURITY-SENSITIVE PRESENTATION | Not regenerated or validated against the configured number. |
| Footer collection links | `storefront-chrome.tsx` | BUSINESS_SETTING | Hardcoded slugs can break after category edits. |
| Footer brand description, email, location | `storefront-chrome.tsx` | BUSINESS_SETTING | Not admin-managed. |
| Social links | none | BUSINESS_SETTING | Missing. |
| Operations Portal footer link | `storefront-chrome.tsx` | LEGAL_SECURITY_CONSTANT / INTERNAL NAVIGATION | Publicly discoverable internal route; remove from customer footer even though server auth still protects it. |
| PDP fabric, print, delivery timing, payment copy | PDP source | PRODUCT_DATA / BUSINESS_SETTING | Same copy is applied to every product; should be structured product/policy content. |
| Size measurements and fit copy | `size-chart-dialog.tsx` and bitmap | PRODUCT_DATA | Duplicated in two sources and can drift. |
| Order/payment security rules, two-hour proof window | server/domain plus UI copy | LEGAL_SECURITY_CONSTANT | Keep authoritative duration server-controlled; expose only derived display copy. |
| Layout widths, breakpoints, touch sizes, radii | CSS/Tailwind | DESIGN_CONSTANT | Correctly remain implementation constants. |

## CRUD MATRIX

| Domain / operation | UI | Server action / RPC | Database effect | Authorization | Storefront reflection | Verdict |
|---|---|---|---|---|---|---|
| Product create | Add Product dialog | `saveProduct` → `admin_save_product` | Inserts product + audit log | AAL2 admin in action and RPC | Appears when status is Published | Supported, but no description input. |
| Product edit | Pencil icon dialog | Same | Updates category/name/slug/description/status | Same | Dynamic catalog reflects update | **Unsafe:** description can be cleared. |
| Product archive/reactivate | Status select | Same | `status=archived/published` | Same | Public queries show only Published | Supported. No dedicated confirmation. |
| Media upload | Add Image dialog | `saveProductImage` → Storage + `admin_save_product_image` | Object + image row + audit log | AAL2; trusted storage write; RPC rechecks | Revalidates Catalog/products/PDP | Supported one file at a time. |
| Upload multiple files in one task | No | No batch boundary | — | — | — | Missing. Sequential uploads work. |
| Add fourth image | Same single-upload dialog | Same | No image-count limit | Same | Query returns all images | Supported sequentially. |
| Media preview | Post-upload thumbnail only | — | — | — | — | Partial; no pre-upload preview. |
| Media reorder | Primary/up/down icon buttons | `reorderProductImage` → `admin_reorder_product_image` | Atomic row lock + normalized positions + audit | AAL2 action/RPC | Cards/PDP read ascending order | Supported. |
| Set primary | Star icon | Same, action=`primary` | Moves row to position 0 | Same | First image controls cards/PDP | Supported. |
| Media delete | Delete icon + confirmation Dialog | `deleteProductImage` → RPC then Storage remove | Deletes row/audit, then object | AAL2; RPC | Revalidates catalog/products/PDP | Supported. Storage-delete failure is not surfaced/compensated. |
| Persist media order | Relative controls | Reorder RPC | PostgreSQL positions | AAL2 RPC | Yes | Supported. |
| Variant create | Add Variant dialog | `saveVariant` → `admin_save_variant` | Variant + zeroed inventory + audit | AAL2 action/RPC | Active mapped variants appear | Partial: cannot assign options. |
| Variant edit / price / SKU/name | Pencil icon | Same | Updates row + audit | Same | Dynamic price/variant queries reflect it | Supported except status mismatch. |
| Variant deactivate | No valid Inactive option | RPC supports `inactive` | Would update status | Same | Public query excludes inactive | **Broken in UI.** |
| Variant archive | Status option | Same | Sets archived | Same | Excluded publicly | Supported. |
| Size/option management | No visible UI | Actions/RPCs exist | Option/value/mapping tables | AAL2 | PDP uses mappings | Backend-only; operationally missing. |
| Inventory adjust + reason | Inline form per variant | `adjustInventory` → `admin_adjust_inventory` | Locked stock update + movement + audit | AAL2 action/RPC | Availability updates in purchase/cart/POS queries | Supported. |
| Inventory history | No Catalog view | Data exists in `inventory_movements` | Read only possible | Admin read boundary available | Not customer-facing | Missing. |
| Category create/edit | Dialog | `saveCategory` → `admin_save_category` | Upsert + audit | AAL2 action/RPC | Dynamic category queries reflect it | Create works; edit fields are incomplete. |
| Category archive/reactivate | No control | RPC supports boolean | Sets/clears `archived_at` | AAL2 RPC | Public queries exclude archived | Backend-only. |
| Category delete safely | No | No dedicated safe-delete RPC | — | — | — | Missing; archive should remain preferred. |
| Category hierarchy/position | No control | RPC supports parent/position | Updates fields | AAL2 RPC | Query ordering reflects position | Backend-only. |

## MEDIA MATRIX

| Capability | Actual customer behavior |
|---|---|
| Database-driven gallery | Yes. PDP queries `product_images` ordered by `position`. |
| Multiple images visible | Desktop: lead image plus up to four thumbnails. Mobile/tablet below `lg`: lead image only. |
| Clickable thumbnails | No. They are plain `div` containers. |
| Selected image changes | No selected-image client state exists. |
| Main image opens | No link, dialog, or lightbox. |
| Desktop zoom | No. |
| Mobile swipe | No; the existing Shadcn Carousel is unused. |
| Mobile pinch/detailed zoom | No. |
| Extra-image discoverability | Poor on desktop, absent on mobile; no count or carousel indicator. Images after the fourth are not rendered. |
| Admin order followed | Yes for the lead and rendered thumbnails. |
| Primary controls product cards | Yes: lowest position is used by home, products, categories, cart, and POS query paths. |
| Delete reflects | Yes after redirect/revalidation; dynamic reads remove the row. |
| Variant-specific image behavior | Rows can be attached to a variant, but PDP does not switch gallery media when a variant is selected. |

## PRODUCT MEDIA ASSET AUDIT

- `1968 CLOTHING V1.webp`, `V2.webp`, and `V3 - SAN ROQUE.webp` physically contain the large chrome 1968 logo and the red “ALL RIGHTS RESERVED…” footer strip. These are pixels in the source files, not CSS overlays.
- The cleaner detail files (`V1.0`, `V1.1`, `V2.0`, and similar) isolate front/back garments and do not contain the large footer strip.
- “CURRENT DROPS” on collection cards is a UI/category overlay when shown; it is not present in the inspected Rise to Defend/Triskelion bitmaps.
- The primary composites have large white margins, embedded branding, and low garment contrast. Product-card `object-cover` crops them inconsistently and weakens the visual edge.
- CSS cannot selectively remove embedded logos or the red strip. Replace the primary media with clean master exports, or create approved crops outside the application and upload them as new product media.
- `size-chart-1968-clothing.png` contains the measurement diagram, a full size table, and a long brand paragraph. The dialog then repeats a semantic HTML table and fit copy. The image should be replaced with a diagram-only asset so text/table remain accessible and single-source.

## MOBILE ISSUES

### Matrix results

Audited at `390×844`, `430×932`, and `768×1024` across `/`, `/products`, `/categories/drops`, Rise PDP, cart, account, orders, admin overview, Catalog, Orders, Payments, and POS.

- `390×844`: Cart horizontally overflows by approximately 52 px. Other representative routes did not show document-level overflow.
- `430×932`: No document-level horizontal overflow was detected in the matrix.
- `768×1024`: Admin Catalog overflows by approximately 67 px because the desktop table is enabled at `md`.
- PDP secondary media is unavailable at all widths below 1024 px (`lg`).
- Category product grids still use two columns at 390 px, unlike `/products`, which uses one column. This creates an inconsistent catalog density and smaller product imagery.
- The mobile footer is a long single-column block with four sections and generous vertical padding; Operations Portal increases both height and cognitive noise.
- Size-guide title/top close are obscured by the sticky header. The image duplicates the semantic content and consumes most of the initial scroll region.
- Several public routes still expose sub-44 px visible targets (mostly inline footer/card links and compact controls). Exact counts include hidden/development elements, so each target needs a semantic pass rather than a blanket size rule.
- Admin Catalog’s mobile disclosure pattern is better than its desktop table, but global Add Variant/Add Image actions force staff to choose from long cross-product lists instead of acting within a product.
- POS is usable but long (about 4,547 px at 390 px with current data); the fixed “Review sale” shortcut improves recovery, but product search/category filtering remains essential.

## DESKTOP ISSUES

Audited at `1024×768`, `1440×900`, and `1920×1080`.

- Header navigation is flex-centered only in the space between logo/actions, not geometrically centered in the viewport. At 1440 px, the nav midpoint was about 708 px rather than the viewport/content midpoint near 717–720 px because the logo is 125 px and actions are about 143 px.
- Catalog’s single table becomes more than 6,200 px tall with only 11 products. Product identity sits at the top of a row while variant stacks dominate the row, making product-to-variant scanning slow.
- Desktop Catalog uses many unlabeled pencil icons and small 32–36 px operational controls. The audit measured a high concentration of visible sub-44 px targets; desktop density can be compact, but icon-only controls still need labels/tooltips and keyboard clarity.
- PDP thumbnails look like previews but do nothing. Only the first four are shown; additional images disappear from the customer page.
- Product media uses a weak neutral edge against white-heavy source art. A clearer media surface/border and clean assets are needed before further decorative styling.
- Duplicate legacy/current CSS blocks define the footer and other systems more than once in `globals.css`, increasing cascade risk and making spacing fixes unpredictable.

## ACCESSIBILITY ISSUES

- Product/category/variant edit icon buttons lack explicit accessible names and visible tooltips.
- PDP thumbnails are not interactive semantics and therefore cannot be keyboard-operated.
- Size-guide top close target is below 44 px and covered by another high-z-index surface on mobile.
- Category pills in `/categories/[slug]` do not declare the same `min-height: 44px` contract used on `/products`.
- Status badges generally pair color with text, which is good; retain this pattern.
- Dialog focus management and footer close behavior are otherwise based on Radix/Shadcn and are structurally sound.
- Reduced-motion CSS exists globally, but product hover transforms should remain nonessential.
- Dense uppercase mono text at 9–11 px is overused for operational details and can be difficult for low-vision staff.
- The public footer contains an internal Operations Portal link. Authorization is enforced server-side, but exposing it is unnecessary information architecture and encourages customers into an MFA/admin flow.

## COMPONENT AUDIT

| Primitive | Current state | Recommendation |
|---|---|---|
| Dialog | Used for size guide and admin create/edit/confirm flows | Keep for short forms. Make Catalog edit forms scroll-safe and fix modal/header stacking. |
| Drawer | Not installed | Do not install merely for parity. Existing Sheet covers mobile side panels. |
| Sheet | Used for admin navigation and order detail | Keep; appropriate for mobile navigation/context. |
| Carousel | Present but unused | Use for the customer PDP gallery, with thumbnail/indicator state and keyboard/swipe support. |
| Sidebar | No Shadcn Sidebar primitive; custom admin sidebar | Keep custom shell unless collapse/state requirements justify migration. It is clear and domain-specific. |
| Table | Used in operational/admin screens | Keep for desktop data. Do not use at tablet widths without overflow containment or a responsive card mode. |
| DropdownMenu | Present but effectively unused | Appropriate for grouped row actions in Catalog, especially secondary media/product actions, provided primary action remains visible. |
| AlertDialog | Not present | Existing Dialog confirmations work, but destructive actions would be semantically clearer with AlertDialog in a later implementation phase. Do not install during audit. |
| InputGroup/SearchField | Custom SearchField used in queues/POS | Keep; it fixes icon/input spacing and provides a consistent search contract. |
| Skeleton | Used broadly | Keep; ensure skeleton geometry matches final cards/tables to limit layout shift. |
| Empty | No shared primitive | Introduce only if repeated empty-state structure is consolidated; current bespoke states vary in guidance quality. |
| Sonner | Component/dependency present, not mounted or used | Either mount and use for client-safe mutation feedback or remove later. Redirect status banners remain reliable for server actions. |

Reference review: the supplied `shadcn-admin` project demonstrates focused feature workspaces, row-action menus, URL-backed table state, confirmations, and mutation drawers. Those interaction patterns are more relevant than copying its visual theme. The `AGENTS DESIGN` references reinforce strong hierarchy, restrained motion, and minimal surfaces. The current 1968 brand should retain its own monochrome retail identity rather than visually cloning either reference.

## NONTECHNICAL-USABILITY AUDIT

### Catalog

- A nontechnical employee can create a basic product, variant, image, and stock adjustment, but cannot reliably build a selectable size model or understand why Draft variant fails.
- “Slug,” “SKU,” “Compare At,” and centavo-oriented settings require clearer examples and helper text. SKU may remain operationally necessary, but it should not be the primary customer-facing identifier.
- Product-scoped actions should live inside a product workspace: Edit details, Media, Variants & sizes, Inventory, Archive. The current global action row makes staff choose the product repeatedly.
- Category archiving and product archiving need consequence copy explaining storefront visibility and historical-order preservation.
- Inventory adjustment needs a visible resulting balance preview, reason examples, confirmation for large negative changes, and recent movement history.

### Orders and Payments

- Queue filters, search, status text, selection panels, and confirmations are materially clearer than the Catalog.
- Database terms still leak into copy: “reservations consumed,” “transitioned to PAID,” “active holds,” and all-caps enum-like states should be translated for staff while preserving details in an expandable audit section.
- Empty states should state the next action (“No receipts need review—check Orders for fulfillment work”) rather than only reporting absence.

### POS

- “Centavos” in register open/close inputs is technically correct but error-prone for nontechnical staff. The UI should accept/display pesos and convert server-side using the existing money parser.
- The closed-drawer warning says to open before ringing sales, but items can still be added. This is acceptable for ticket preparation only if Complete Sale clearly enforces the register rule for cash; otherwise copy and behavior conflict.
- GCash instructions now use store settings and clearly require staff confirmation before completion.

### Account and customer flows

- Account navigation is useful, but the overview lacks recent order/payment/address readiness summaries.
- Orders provide real tracking and exception states; the five-stage success path remains distinct from cancellation/failure states.
- Cart’s current horizontal overflow directly harms the primary checkout path and should be fixed before visual refinements.

## PERFORMANCE / ERROR FINDINGS

- Representative console audit: no warnings, hydration errors, or runtime errors were captured.
- Representative asset probes: CSS and JS returned `200` with correct MIME types. The former CSS MIME/static-asset blocker did not reproduce.
- Six-viewport route matrix: no rendered broken images detected.
- No route returned an observed 404 or 500 during the matrix.
- The audit did not use a full HAR recorder, so duplicate network-request claims are not made. Next.js development mode also adds development resources and the `N` toolbar; production performance should be measured from a production server.
- Product pages mark up to four grid images as priority on home/products/category surfaces. At mobile one-column catalog density, this can preload more media than is above the fold. Measure LCP and transfer size in a production Lighthouse/WebPageTest pass.
- Large image dimensions are not the dominant byte problem in the inspected WebP composites, but the 1.9 MB size-chart PNG is heavy and duplicates an HTML table.
- `globals.css` contains duplicate/legacy component sections (including footer definitions), increasing CSS payload and regression risk.

## PRIORITY P0 / P1 / P2

### P0 — correctness and safe operation

1. Prevent product edit from clearing description; expose and preserve all editable fields.
2. Align variant statuses with the database and add the option/value/mapping workflow required by PDP selection.
3. Fix 390 px Cart overflow.
4. Keep checkout totals server-authoritative; remove Cart’s hardcoded ₱150 and display the same trusted fulfillment setting used by checkout.
5. Verify/apply the configured free-shipping threshold consistently or remove the unused setting/claim.

### P1 — core commerce and staff usability

1. Build an interactive, database-ordered PDP gallery using the existing Carousel: click/keyboard thumbnails, swipe, selected state, media count, and lightbox/zoom.
2. Fix size-guide stacking, top close target, and replace the duplicated chart bitmap with a diagram-only asset.
3. Redesign Catalog as a searchable product list plus focused product workspace; preserve mobile disclosure cards below an appropriate breakpoint.
4. Add category archive/reactivate, hierarchy/order where genuinely needed, and consequence confirmations.
5. Add inventory movement history and clear mutation/error feedback.
6. Replace embedded-logo/red-strip primary composites with clean product masters.
7. Remove Operations Portal from the public footer and make footer/contact/collection links settings-driven where business-editable.
8. Reconcile GCash QR media with configured merchant details.

### P2 — refinement and maintainability

1. Geometrically center desktop navigation with balanced left/right slots or an absolute center track.
2. Reduce repetitive category badges and strengthen product-card media/metadata hierarchy.
3. Add useful account summary cards for recent orders, address readiness, and payment action needed.
4. Consolidate duplicate legacy CSS after visual contracts are locked.
5. Add URL-backed Catalog filters and pagination if catalog size justifies them.
6. Standardize empty-state guidance and decide between redirect banners and Sonner for each mutation class.
7. Move remaining campaign/story/help/footer copy to narrowly scoped business settings; leave design and security constants in code.

## RECOMMENDED IMPLEMENTATION ORDER

1. **Correctness guardrails:** product-description preservation, variant status contract, product option assignment, Cart trusted shipping display, and regression tests.
2. **Responsive blockers:** Cart at 390 px, Catalog at 768 px, size-guide stacking/close behavior, touch-target audit.
3. **Product media customer flow:** selected-image state, Carousel/swipe, thumbnail controls, lightbox/zoom, image-count affordance, and variant-media behavior.
4. **Catalog information architecture:** searchable product index and product-scoped Details / Media / Variants & Sizes / Inventory sections.
5. **Catalog capability exposure:** category archive, option/value management, inventory movement history, product-scoped image upload, clear confirmations and errors.
6. **Asset remediation:** replace primary composites and size-chart bitmap using approved clean exports; do not attempt CSS removal of embedded pixels.
7. **Business-content consolidation:** shipping/free-shipping, pickup copy, GCash QR/account parity, footer/contact/category links, hero image/campaign selection.
8. **Account and admin language refinement:** recent-action summaries, human-readable queue language, guided empty states, and next recommended action.
9. **CSS/component cleanup:** remove duplicate legacy CSS, consolidate empty states, decide Sonner usage, retain the custom sidebar unless new requirements prove a need to migrate.
10. **Release QA:** repeat the six-viewport matrix, keyboard/focus and screen-reader checks, image failure cases, production console/network/Lighthouse, and commerce/security regression suites.

## AUDIT LIMITS

- No product, media, variant, inventory, category, order, payment, register, or settings mutation was executed.
- CRUD conclusions are based on UI-to-action-to-RPC/schema tracing plus current read-only database evidence.
- Browser checks used the local development server and current local data/authentication state.
- Duplicate-request and production performance conclusions require a production-mode HAR/Lighthouse pass during the approved implementation phase.

---

## Implementation follow-up — 2026-09-20

The approved remediation phase has addressed the audited correctness contract, responsive overflow blockers, size-guide layering/asset duplication, interactive database-driven PDP gallery, canonical size mapping controls, category archive/reactivate, automatic media ordering, account overview, trusted/free-shipping calculation, configurable GCash QR/contact/footer content, public footer safety, balanced header geometry, and duplicate footer CSS. Detailed implementation and browser evidence is recorded in `docs/UI_AUDIT.md`.

Final automated evidence: typecheck PASS, lint PASS, 65/65 tests PASS, optimized production build PASS. Production server smoke check successfully rendered the database-backed Rise to Defend PDP. AAL2-admin destructive media/settings mutation-and-restore QA remains explicitly outstanding; no authorization bypass was used.

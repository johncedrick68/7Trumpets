# Shadcn Component Audit

**Date:** 2026-09-20  
**References:** local `ui-main` v4 registry and local `shadcn-admin-1.0.0` layout examples  
**Decision:** Shadcn remains the accessibility/component foundation; 1968 tokens and domain-specific server components remain authoritative.

## Existing primitives

| Component | Current implementation | Reference comparison | Custom changes | Action |
|---|---|---|---|---|
| Alert | Shadcn/Radix-style variants | Current registry-compatible | 1968 semantic tones | KEEP |
| Badge | CVA variants | Current registry-compatible | Commerce status styling consumers | KEEP |
| Button | CVA + Radix Slot | Current registry-compatible | 44px touch sizing and press response | KEEP |
| Card | Standard compound component | Current registry-compatible | Tokenized border/radius | KEEP; use selectively |
| Carousel | Embla client primitive | Current registry-compatible | None material | KEEP; required for real PDP media |
| Dialog | Radix dialog | Current registry-compatible | Existing close and responsive styling | KEEP |
| DropdownMenu | Radix menu | Current registry-compatible | None material | KEEP; planned row/action menus |
| Form | React Hook Form adapter | Older Shadcn pattern | Existing RHF dependency | KEEP only where RHF already drives a form |
| Input | Native input wrapper | Current registry-compatible | 1968 focus treatment | KEEP |
| Label | Radix label | Current registry-compatible | None material | KEEP |
| PasswordInput | Project-specific client wrapper | No direct registry equivalent | Visibility toggle and accessible label | KEEP |
| ScrollArea | Radix scroll area | Current registry-compatible | None material | KEEP for constrained operational panes |
| Select | Radix select | Current registry-compatible | None material | KEEP |
| Separator | Radix separator | Current registry-compatible | None material | KEEP |
| Sheet | Radix dialog-based sheet | Current registry-compatible | Direction variants | KEEP; admin/mobile contextual inspection |
| Skeleton | Standard Shadcn primitive | Current registry-compatible | Route-shaped consumers | KEEP |
| Sonner | Theme-aware toaster | Current registry-compatible | Not mounted/used consistently | DEFER; adopt only with a concrete transient mutation |
| Table | Semantic table compounds | Current registry-compatible | Horizontal-scroll consumers | KEEP |
| Tabs | Radix tabs | Current registry-compatible | Currently unused | KEEP only for imminent catalog/returns workflow |
| Textarea | Native textarea wrapper | Current registry-compatible | None material | KEEP |

## Missing primitives with proven need

| Primitive | Proven use | Decision |
|---|---|---|
| AlertDialog | Archive/delete/high-consequence admin confirmation | ADD when first destructive UI is refactored |
| Breadcrumb | Compact admin topbar wayfinding | ADD with admin shell refactor |
| Command / CommandDialog | Bounded Ctrl/Cmd+K admin search | ADD after server search endpoint is scoped |
| Drawer | Mobile order/payment quick view and address editing | ADD when those interactions are implemented |
| Empty | Consistent actionable empty states | MERGE a minimal project-owned implementation |
| Field | Consistent labels, help, and errors | MERGE during form refactors; do not duplicate existing Form wrappers |
| InputGroup | Shared search-field icon/clear-button geometry | ADD with `SearchField` |
| Progress | Customer fulfillment presentation | ADD only where it improves the existing semantic timeline |
| RadioGroup | Checkout and POS choices | ADD when native controls no longer satisfy the interaction |
| Sidebar | Responsive admin navigation | MERGE concepts selectively; preserve server authorization and Next layouts |
| Spinner | Inline pending controls only | DEFER; route loading remains Skeleton-based |
| Switch | Product visibility/status settings | ADD with the product editor |
| Tooltip | Icon-only admin controls | ADD only for controls that remain understandable on touch |

## Explicitly deferred

Accordion, Checkbox, Collapsible, Combobox, HoverCard, Pagination, Popover, and Avatar are not being installed merely for parity. They should enter the project only with a current route-level need. The app will not import TanStack Router, template state libraries, or the Vite architecture from `shadcn-admin`.

## Findings

- Existing primitives are generally current, small, and project-owned; wholesale replacement would erase valid 1968 sizing and focus changes.
- `carousel`, `dropdown-menu`, `form`, `sonner`, and `tabs` currently have little or no production usage. Their presence is acceptable only because the master refactor has near-term, named uses; unused status must be rechecked at final Ponytail review.
- Admin pages still recreate headers and search geometry. `AdminPageHeader` and `SearchField` are justified shared compositions, not new low-level primitives.
- The admin reference is useful for grouping, responsive sidebar behavior, and table toolbars only. Its router, auth, state, and dependency choices are incompatible with this Next.js/Supabase architecture and will not be copied.

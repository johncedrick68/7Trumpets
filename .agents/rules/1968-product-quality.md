# 1968 Clothing — Product Quality Rules

1. **Design System Authority**: Strictly adhere to `DESIGN.md`. Use canonical semantic design tokens (`--background`, `--foreground`, `--surface-muted`, `--border`, `--primary`, `--ring`) and the defined typography hierarchy (Geist Sans for human reading, Geist Mono for drop codes, SKUs, and metadata).
2. **Container Discipline**: Adhere to container constraints: Storefront max `1440px`, Transaction max `1280px`, Account max `1240px`, Admin max `1600px`, Auth/Readable max `512px`. Do not introduce ad-hoc container widths or arbitrary margins.
3. **No Random Spacing**: Strictly use the base spacing scale (`4px`, `8px`, `12px`, `16px`, `20px`, `24px`, `32px`, `48px`, `64px`). Enforce standard form rhythm (Label → Control → Helper/Error → Field Group → CTA).
4. **Security & Trust Boundaries**: Preserve all backend invariants (RLS, server-side authentication, AAL2 MFA for admin, integer minor-unit money arithmetic, transactional stock reservation, owner isolation, private receipt storage). UI hiding is never authorization.
5. **Operational Density vs Editorial Breathability**:
   - Storefront: Editorial, photography-led, tactile, uncluttered.
   - Admin & POS: High operational density, fast scanning, compact tables, quick drawers, and instant keyboard shortcuts (`/` for POS search).
6. **Card & Radius Discipline**: Avoid nested cards inside cards. Default elevation is flat (1px border). Restrained corner radius: `rounded-xs` (4px), `rounded-md` (8px), `rounded-lg` (12px), `rounded-xl` (16px), `rounded-full` (pills/badges).
7. **Accessibility Mandatory (WCAG 2.2 AA)**:
   - Visible 2px focus ring (`:focus-visible`).
   - Touch targets must be at least 44×44px on mobile viewports.
   - Never communicate status by color alone; pair with text/icons.
   - Respect `prefers-reduced-motion`.
8. **Mobile-First Responsive Integrity**: Mobile is not compressed desktop. Stack thoughtfully, prioritize primary customer tasks (purchase block above media fold where needed, sticky actions without obscuring inputs), and prevent horizontal overflow.
9. **No Fake Functionality or Fabricated Data**: Use live database records, real products, and real local demo accounts. Never mock success or mark GCash as PAID upon mere upload.
10. **Evidence-Based Completion**: Do not claim PASS without browser-verified inspection across viewport matrices (360px to 1920px). Zero uncaught runtime console errors.

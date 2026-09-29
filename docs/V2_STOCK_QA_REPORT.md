# Canonical local stock fixture — final evidence

1. Target guard: PASS. Supabase status showed API http://127.0.0.1:54321 and
   database loopback port 54322. Helper refuses remote/disguised targets and
   uses only the known local supabase_db_7trumpets container. Browser target
   was http://localhost:3002.
2. Tenets #2: product b1000000-0000-0000-0000-000000000011, two variants.
   IDs/SKUs were resolved from that canonical product. Inventory primary key
   is variant_id; there is no separate inventory row ID.
3. Temporarily changed on_hand to reserved + safety_stock. The existing
   updated_at trigger updated timestamps. Product semantics, prices, SKUs,
   publication, media, reserved and safety_stock were not changed.
4. Original complete inventory rows captured successfully before mutation,
   including exact timestamps. Non-sensitive recovery snapshot only in .tmp.
5. All variants had zero available stock in the database. SSR already rendered
   Out of Stock before hydration; no response rewrites were used.
6. Both serialized-availability response interceptors removed.
7. Product Case D: PASS with actual canonical out-of-stock rendering.
8. Out-of-stock axe state: zero detected violations.
9. Hydration: zero mismatch/#418 errors in the completed production-build suite.
10. Console/page errors: zero; unexpected errors now fail the runner.
11. Full runner: PASS. 18 axe states; 14 keyboard/interaction checks; 44
    horizontal-overflow checks over four routes at 11 viewports, all passed.
    Existing matrix J/K cart entries rely on contract-test evidence rather
    than an authenticated browser cart session; this is not complete commerce
    UAT. Mixed available/unavailable variant coverage was not independently
    established by its existing Rise to Defend fixture (zero unavailable labels).
12. Restoration: PASS in finally, including browser-launch/assertion failure
    paths. Snapshot recovery command is node scripts/local-qa-tenets-stock.mjs
    --restore if a terminated run leaves its recovery artifact.
13. BEFORE == AFTER for every captured inventory row/field, including timestamp;
    SSR radio availability also matched the original state exactly. Recovery
    snapshot was removed only after database equality passed.
14. Inventory has only inventory_set_updated_at as a user trigger. This direct
    test-only fixture did not generate inventory audit/movement rows. No
    append-only audit evidence was deleted or rewritten. Auth test audit
    history remains governed by the existing customer deletion lifecycle.
15. Live session: 16/16 assertions across 10 scenarios executed and passed;
    real getUser/getClaims verification; repeatability proven after reset.
16. Application tests: 146/146 PASS, zero skipped; process exited normally.
17. Database regression: 408/408; backend-only RPC/COD/settings contract intact.
18. Focused checkout tests: 16/16.
19. TypeScript: PASS; rerun after restoration.
20. ESLint: PASS; rerun after restoration.
21. Production build: PASS; rerun after restoration.
22. Files: scripts/storefront-qa.mjs, local-qa-customer.mjs,
    local-qa-tenets-stock.mjs; tests/support-ai-staff.test.mjs,
    local-qa-admin.test.mjs; these two evidence documents.
23. Commit: exact SHA in task response. Security commit 2a5a0d1 unchanged.
24. Working tree: checked at handoff; temporary stock values not staged.
25. Phase 4 may resume in the next task after this evidence gate. Checkout
    visuals remain untouched here; actual rendered order still needs its own
    action-time authorization.
26. Remote/production actions: NONE. One authorized local fixture cycle only.
    No order, COD/GCash payment, proof upload, POS sale, return, push, deployment,
    merge, or remote migration.

The fixture script is not standing authorization for future inventory writes.
Its recovery file contains only product/inventory values, never credentials.
Exact timestamp recovery uses session-local replica trigger behavior within a
transaction, not a persistent trigger change or RLS/grant relaxation. Local
concurrent inventory operations must be avoided while this QA fixture is active.

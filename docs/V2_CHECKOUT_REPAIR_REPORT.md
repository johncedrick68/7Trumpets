# Checkout security repair — local evidence

1. RPC signatures: checkout_order(uuid,text,jsonb,bigint,text,timestamptz,jsonb,text) and checkout_order(uuid,text,jsonb,bigint,text,timestamptz,jsonb,text,text).
2. Old grants: both accessible to authenticated and service_role; browser access accepted arbitrary customer/shipping inputs.
3. New grants: explicit PUBLIC/anon/authenticated revocation; service_role execution only (owner remains postgres).
4. Privileged client: existing server-only createServiceClient reused; separate from SSR cookies, no persisted session or token refresh, existing SUPABASE_SECRET_KEY convention.
5. Client secret exposure: NONE detected by exact configured-key scan of built static files; no key was printed. No secret-bearing client props introduced.
6. User verification: verified claims plus getUser; IDs must agree before configuration and privileged invocation.
7. Customer ID: canonical session subject, never form input.
8. Address: selected address ID queried with user_id equal to verified subject.
9. Shipping: existing helper and validated persisted fulfillment configuration; browser shipping ignored.
10. COD total: database locked-price subtotal + backend shipping; discount stays zero.
11. COD enforcement: database reads canonical persisted payment JSONB; above ceiling rejects before writes; ceiling row share-locked.
12. Configuration failures: typed query/missing/malformed errors, safe unavailable page/redirect, no financial fallbacks or submission.
13. Anonymous direct RPC: both denied.
14. Authenticated direct RPC: both denied.
15. Identity spoof: denied at execution boundary.
16. Shipping tamper: zero/negative/reduced input denied at execution boundary.
17. Backend RPC: valid service_role calls pass; actual server-action code also passes mocked trust-boundary regression.
18. COD below/exact/one-centavo-above: PASS/PASS/REJECT; shipping-crosses-ceiling case included.
19. GCash above COD ceiling passes; existing expiration suite passes. Cash pickup passes.
20. Atomicity: rejected order/payment absent; on-hand/reserved counts unchanged; no application cart cleanup on settings failure. Fixtures rolled back.
21. Idempotency: corrected rejected key succeeds; subsequent valid retries return same order; historical suite passes.
22. Migration: 20260929010000_secure_checkout_rpc_and_cod_limit.sql; one forward-only migration, historical migrations unchanged. Also disambiguates the existing wrapper delegation.
23. Replay: all 34 local migrations replayed from reset successfully. Local QA data reset is destructive and recoverable only through reseeding/re-provisioning.
24. Database: six pgTAP suites, 408/408 (24 new security assertions); standalone POS rollback suite also passed. Concurrency scripts not rerun; this is not a new concurrency stress proof.
25. Application: existing suite reports 144/144; focused settings/action/client tests 16/16. Existing support live-session assertions were skipped internally due to missing login fixture, despite runner reporting pass.
26. TypeScript: PASS.
27. ESLint: PASS.
28. Admin: 19/19 functional source assertions PASS; no rendered admin mutation UAT performed. Admin settings save/reload persistence was not exercised in the browser.
29. Build: PASS. Storefront regression: 18 axe states, zero detected violations, keyboard and 11-viewport checks passed; two React #418 page errors were logged. This is NOT console-clean evidence. No shared UI changed.
30. Files: package.json; checkout page/client/action; settings.ts/settings-contract.ts; new migration; checkout_security.sql; phase_1c.sql expectations; checkout.test.mjs; checkout-settings.test.mjs; this report and V2_CHECKOUT_CONTRACT.md.
31. Commit: see task response for exact SHA; no push authorized.
32. Phase 4: database/security repair tests pass. Before claiming unrestricted browser readiness, investigate logged hydration errors and restore/re-run the skipped live-session fixture. Rendered successful checkout remains separately authorized UAT. No visual rebuild performed here.
33. Remote/production: NONE. No push, deployment, merge, remote migration, rendered QA checkout, or proof upload.

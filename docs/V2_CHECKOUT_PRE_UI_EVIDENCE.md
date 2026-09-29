# Checkout pre-UI evidence gate — resolved locally

## Exact hydration findings

Both independently captured development events occurred at
`/products/tenets-2`, in `ProductPurchaseForm`'s direct-variant fieldset.
Event 1 was the automated axe out-of-stock state. Event 2 was product case D.
Each has its own `page.route` response rewrite in storefront-qa.mjs.

Both interceptors changed serialized `is_available:true` to false but did not
change the server-rendered HTML. Server snapshot: available label/radio,
no disabled attribute and no unavailable screen-reader span. First client
render: unavailable label classes, disabled=true radio, added sr-only span.
First divergent element is the label for
`variant-a1000000-0011-0000-0000-000000000001`; first explicit structural
divergence is its radio's disabled attribute and additional span.

The development component diffs independently establish the same runner-induced
cause. No storefront application source repair is justified by these findings.
The existing footer year warning suppression is unchanged; it is not where
either captured diff begins. No new suppression, SSR disablement or dependency
upgrade was added. A footer timezone rollover audit was not performed.

Do not fabricate out-of-stock coverage by rewriting only RSC/client data.
A canonical local stock fixture was separately authorized and exercised once.
Both corrupting interceptors were removed. The production-build browser suite
passed with zero hydration/console/page errors and zero axe violations across
18 states. Exact inventory and SSR availability restoration passed. See
V2_STOCK_QA_REPORT.md for the final inventory/evidence gate.

## Auth fixture

local-qa-customer.mjs provisions a disposable verified ordinary customer through
Supabase Auth admin API, then signs in with a runtime-generated password.
It validates getUser and getClaims against the created identity. No raw Auth SQL,
role promotion, MFA bypass, JWT modification, file persistence or credential
logging occurs. Profile provisioning uses the existing Auth trigger.
Cleanup signs out, deletes the fixture through Auth API and verifies deletion;
associated customer support conversations/messages cascade on user deletion.
Immutable audit history is retained under the existing lifecycle rules.

The helper accepts only exact loopback origins on port 54321, with no userinfo,
path, query or fragment, and refuses missing credentials. Setup failure fails
the test, never silently skips. Both formerly skipped support security scenarios
now use it; existing ordinary-admin negative tests retain their separate fixture.

After a fresh local database reset, first and second customer-session runs
passed and terminated normally. The primary live-session test reports 16/16
assertions across 10 scenarios, plus real getUser/getClaims verification.
The complete support test file passed 10/10, including the direct negative
RPC scenario. The final application suite includes an additional stock-fixture
contract test, with no skipped critical live-session checks.

## Current evidence

- Local reset/replay: PASS; checkout security migration unchanged.
- Database regressions: 408/408 PASS.
- Focused checkout tests: 16/16 PASS.
- Typecheck and lint: PASS.
- Application tests: 145/145 PASS, normal termination.
- Admin audit: 19/19 PASS before the second live-scenario fixture refinement;
  these same audit assertions also passed within the final application run.
- Development diagnosis: both artificial hydration events reproduced and
  component diff captured before the mock repair. The final fixture suite ran
  on the production build, not a second post-fix development fixture cycle.
- Production build: PASS. Clean-browser, unmodified responses for /, /products,
  /products/rise-to-defend, /cart, /login, /products/tenets-2: zero console errors
  and zero page errors. This read-only check does not replace the pending
  full out-of-stock fixture/axe regression.
- Only runner/fixture/tests/documentation changes are in scope.
- Phase 4 visual work may resume in the next task after the final commit; it
  was not performed here. No QA order, proof upload, deployment, merge, remote
  migration or remote/production action occurred.

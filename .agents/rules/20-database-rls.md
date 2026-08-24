# Database, RLS, and Storage Rules

- Make schema changes through new migrations; never rewrite applied migration history.
- Put durable invariants in PostgreSQL constraints and transactional operations.
- Design stock reservation and finalization to survive concurrent last-item purchases.
- Enable intentional RLS on browser-reachable sensitive tables and test cross-customer denial.
- Do not weaken RLS to make a failing query pass.
- Do not add browser policies to tables intended only for trusted server access.
- A server secret key is server-only and never browser-safe; the publishable key may be used in the browser with RLS.
- Authorize every server-side data operation even when using elevated database access.
- Keep payment receipts and return proofs private; issue signed URLs only after authorization.
- Validate upload owner, purpose, type, size, and path before accepting a file.
- Review indexes for foreign keys, common filters, authorization predicates, and Realtime access paths.
- Require explicit approval before any production schema, policy, storage, or data mutation.

# Golden Rules

1. Follow the authority order in `AGENTS.md`.
2. Read `docs/PROJECT_STATUS.md` before work and stay inside the active phase.
3. Treat the browser as untrusted and the server/database as authoritative for business decisions.
4. Protect money, inventory, orders, payments, refunds, authorization, and private files with explicit invariants.
5. Use `docs/architecture/MASTER_ARCHITECTURE.md` as the canonical architecture contract.
6. Never trade security, correctness, data integrity, or architecture for speed or minimalism.
7. Do not mutate production, expose secrets, commit, push, deploy, or weaken access controls without explicit authorization.
8. Verify consequential changes with relevant positive and negative tests.

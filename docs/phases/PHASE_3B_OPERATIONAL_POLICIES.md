# Phase 3B Operational Policies

## Admin AAL2

All `/admin` pages, private receipt previews, audit-log reads, payment decisions,
COD settlement, fulfillment transitions, and role mutations require an active
AAL2 session. The separate `/admin-mfa` route permits authenticated staff at
AAL1 to enroll or challenge a TOTP factor. Customer storefront access remains
AAL1. No SMS factor or per-action fresh-code prompt is in scope.

## Auth Abuse Controls

Supabase Auth rate limits remain the primary login control. Before launch,
Phase 3D must configure production limits and Cloudflare Turnstile for signup
and password-reset requests because those public flows send email and the
development signup smoke already encountered platform limits. Password login
starts with Supabase IP limits and leaked-password protection; add a login
challenge only if monitoring shows credential-stuffing pressure.

## Payment Receipt Retention

Payment receipts are private financial evidence. Retain them for five years
after the associated order reaches a terminal state, or longer while a dispute,
charge inquiry, audit, or legal hold is active. Access is limited to the owning
customer and AAL2 staff through short-lived signed URLs. Customers cannot delete
evidence. Any early or scheduled deletion requires a super-admin-authorized,
audited operation that records the submission ID and reason without recording
the storage path or receipt contents. Database backups do not contain Storage
objects, so production backup/export and expiry procedures must treat private
Storage separately and ensure expired backup copies age out under the same
policy.

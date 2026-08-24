# ADR-004: Private Payment Receipts

## Status

Accepted

## Context

Manual GCash evidence may contain personal and financial information.

## Decision

Store payment receipts privately. Authorize access against the associated order
and issue short-lived signed URLs. Uploading evidence cannot set `PAID`.

## Consequences

Receipt access requires policies, upload validation, server authorization, and
negative cross-customer tests. Public receipt URLs are prohibited.

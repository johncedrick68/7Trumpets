# Storage Model

Status: Approved storage contract

## Buckets

| Bucket | Read | Write | Activation |
| --- | --- | --- | --- |
| `product-images` | Public | Trusted administration only | Phase 1 |
| `payment-receipts` | Private, authorized access | Authorized signed upload or trusted processing | Phase 1 |
| `return-proofs` | Private, authorized access | Authorized submission or trusted processing | Deferred until returns exist |

## Rules

Private object paths are not authorization. Validate authenticated owner,
business purpose, expected path, file size, declared type, and inspected content
as appropriate. Generate short-lived signed URLs only after authorizing access
to the associated business record.

Customers may submit evidence but cannot use an upload to establish payment,
return, or refund approval. Phase 1 creates/configures exactly `product-images`
and `payment-receipts`; it must not create `return-proofs`. Bucket creation and
policies require an approved implementation phase and reviewed changes.

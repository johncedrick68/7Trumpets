# Storage Model

Status: Approved storage contract

## Buckets

| Bucket | Read | Write |
| --- | --- | --- |
| `product-images` | Public | Trusted administration only |
| `payment-receipts` | Private, authorized access | Submitting customer or trusted processing under policy |
| `return-proofs` | Private, authorized access | Submitting customer or trusted processing under policy |

## Rules

Private object paths are not authorization. Validate authenticated owner,
business purpose, expected path, file size, declared type, and inspected content
as appropriate. Generate short-lived signed URLs only after authorizing access
to the associated business record.

Customers may submit evidence but cannot use an upload to establish payment,
return, or refund approval. Bucket creation and policies belong to a future
approved implementation phase and must be applied through reviewed changes.

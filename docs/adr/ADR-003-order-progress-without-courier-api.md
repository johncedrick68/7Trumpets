# ADR-003: Order Progress Without a Courier API

## Status

Accepted

## Context

Core tracking must work before or without courier, map, and GPS integrations.

## Decision

Expose `CONFIRMED`, `PREPARING`, `SHIPPING`, `ARRIVING`, and `DELIVERED` as a
manually operable customer success timeline. Keep shipment data
provider-agnostic and exceptions separate.

## Consequences

Customers receive useful progress without external providers. A future courier
adapter may supply evidence for transitions but cannot redefine the core model.

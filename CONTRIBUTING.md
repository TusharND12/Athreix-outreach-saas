# Contributing

## Development contract

1. Read `PRODUCT.md` and `DESIGN.md` before changing a user-facing workflow.
2. Keep provider integrations behind server-only typed adapters and preserve demo mode.
3. Add authorization, validation, audit, credits, suppression, and idempotency handling at the service boundary—not only in UI code.
4. Add or update tests for every behavior change.
5. Run `pnpm verify` before opening a pull request.

## Database changes

- Prefer additive migrations and explicit backfills.
- Never edit a committed migration after it has shipped.
- Treat contact fields as sensitive; use the encryption envelope and deterministic lookup token where required.
- Preserve workspace scoping and retention semantics on new prospect-derived tables.

## UI changes

- Use the shared component vocabulary and OKLCH tokens.
- Verify keyboard, focus, reduced-motion, mobile reflow, loading, empty, error, disabled, and permission-denied states.
- Amber is a signal, not decoration. Avoid generic glass, gradient text, repeated card grids, and gratuitous motion.

## Commit hygiene

Use focused commits with an imperative subject. Do not commit `.env` files, provider payloads, production exports, screenshots containing real contacts, or database dumps.

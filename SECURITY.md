# Security policy

## Supported version

The current local release candidate is `0.1.0`.

## Reporting

Do not place vulnerability details, credentials or client documents in a public issue. Until a remote repository and private reporting channel exist, report findings directly to the repository owner through an agreed private channel.

## Current boundary

This version processes bundled synthetic data in browser memory or local JSON through the CLI. It has no upload service, database, tenant model, auth, billing, external connector or model-provider call.

Do not use this release candidate with real client or investor data. See `docs/security.md` for fail-closed rules and production gaps.

# Architecture

## Components

- `src/core`: pure TypeScript validator and deterministic preflight engine.
- `src/fixtures`: browser sample with fixed dates and explicit policy classes.
- `src/App.tsx`: React guest flow, report inspection, export and post-value intent.
- `internal/preflight`: Go implementation of the same JSON input and report shapes.
- `cmd/fundproof-lint`: thin CLI with stdout JSON, stderr errors and stable exit codes.
- `testdata`: valid, malformed and mixed-fund fixtures used by Go tests and smoke commands.

## Data flow

1. Validate schema, limits, dates, required collections and fund identity.
2. Stop before checks when validation fails.
3. Run five fixed checks in stable order.
4. Attach source addresses to support and conflict findings.
5. Export the report with no server call.

Browser analytics record only event name, timestamp and optional TTV in local storage. The engine has no time, network or random dependency. Its report timestamp comes from the fixture `asOfDate`.

## Deliberate duplication

TypeScript and Go have separate implementations to keep the CLI dependency-free and offline. Shared fixtures plus parity-oriented tests limit drift. A future slice can add a cross-language golden-file test if the report contract expands.

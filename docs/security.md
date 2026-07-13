# Security and privacy notes

The current preview processes only bundled synthetic data in browser memory. It has no file picker, upload endpoint, API, database, auth, billing, model provider or external connector.

## Fail-closed rules

- malformed JSON returns `INVALID_INPUT`;
- more than 3 sources, 20 QAs or 20 MB returns `LIMIT_EXCEEDED`;
- mixed fund IDs return `MIXED_FUND_IDS` before checks run;
- missing evidence addresses produce an inconclusive support result;
- personalized recommendation handling comes only from the explicit fixture policy class.

## Analytics

Local events contain only an event name, timestamp and optional TTV. Questions, answers, source text, fund IDs and finding messages are never included.

## Production gaps

This preview has not implemented threat modeling for uploads, tenant isolation, encryption key management, retention, deletion, rate limiting, audit immutability or incident response. Those controls must precede any real document processing.

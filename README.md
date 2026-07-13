# FundProof QA

FundProof QA is a local preview for IR, content operations and compliance teams at asset managers. It checks a synthetic fund-assistant QA set for evidence coverage, unsupported claims, conflicting source versions, stale documents and explicit must-refuse policy classes.

Status: local preview. It has no upload flow, backend, account system, billing or production data path.

## Web preview

```bash
npm install
npm run dev
```

The page opens with a synthetic sample. Run the preflight, inspect a finding, then export the JSON report. Save and workspace intent appear only after export.

Verification:

```bash
npm test
npm run typecheck
npm run build
```

## fundproof-lint

The free tool runs the same JSON contract offline and writes its report to stdout.

```bash
go run ./cmd/fundproof-lint --help
go run ./cmd/fundproof-lint testdata/sample.json > report.json
cat testdata/sample.json | go run ./cmd/fundproof-lint -
```

Install from this checkout:

```bash
go install ./cmd/fundproof-lint
```

Exit codes:

- `0`: report produced
- `1`: unexpected runtime or output error
- `2`: invalid input, limit breach or usage error

The CLI makes no network calls. Its utility is complete without a product account. FundProof QA adds saved and versioned libraries, release diffs, recurring runs, client-configured policies, collaboration, audit history and API access in the intended paid boundary.

## Input contract

```json
{
  "schemaVersion": "1.0",
  "policy": { "asOfDate": "2026-07-12", "staleAfterDays": 365 },
  "sources": [
    {
      "id": "source-id",
      "title": "Factsheet",
      "fundId": "fund-id",
      "version": "2026.1",
      "effectiveDate": "2026-06-30",
      "pages": [{ "page": 1, "text": "Benchmark: CDI" }]
    }
  ],
  "qas": [
    {
      "id": "qa-id",
      "question": "What is the benchmark?",
      "answer": "CDI",
      "sourceRefs": [{ "sourceId": "source-id", "page": 1, "span": "Benchmark: CDI" }]
    }
  ]
}
```

Guest limits are 3 sources, 20 QAs and 20 MB. Mixed `fundId` values stop the run before checks execute.

## Scope boundaries

The preview uses deterministic fixture checks. It does not generate answers, make recommendations, rank or rate funds, predict performance, calculate returns, parse OCR, connect external systems or accept client data. The `must_refuse` check uses only `policyClass: personalized_recommendation`; it does not infer policy from legal text.

## Documentation

- [Concept](docs/concept.md)
- [Opportunity research](docs/research.md)
- [Architecture](docs/architecture.md)
- [Security](docs/security.md)
- [Brand](docs/brand/README.md)
- [Task slices](docs/task.md)
- [Marketing drafts](docs/marketing/drafts.md)

## License

The repository preview is MIT licensed. See [LICENSE](LICENSE).

# FundProof QA

FundProof QA is a local preview for IR, content operations and compliance teams at asset managers. It checks a synthetic fund-assistant QA set for evidence coverage, unsupported claims, conflicting source versions, stale documents and explicit must-refuse policy classes.

Release candidate: `0.1.0`. It has no upload flow, backend, account system, billing or production data path.

| Surface | Status |
| --- | --- |
| Live demo | Pending deployment |
| Source repository | Pending remote publication |
| Release | `v0.1.0` tag pending |
| Local web build | Available from `dist/` after `npm run build` |
| Local CLI build | Available after `go build ./cmd/fundproof-lint` |

## Web preview

```bash
npm install
npm run dev
```

The page opens with a synthetic sample. Run the preflight, inspect a finding, then export the JSON report. Save and workspace intent appear only after export.

Verification:

```bash
npm run check
npm test
npm run typecheck
npm run build
go test ./...
go vet ./...
go build -o fundproof-lint ./cmd/fundproof-lint
```

GitHub Actions runs independent web, Go and security jobs. The security job performs a repository secret scan and a high-severity dependency audit. CI uploads the static web build and Linux CLI binary as workflow artifacts.

## fundproof-lint

The free tool runs the same JSON contract offline and writes its report to stdout.

```bash
go run ./cmd/fundproof-lint --help
go run ./cmd/fundproof-lint --version
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

## Static hosting package

`vercel.json` configures the Vite build, SPA fallback, long-lived hashed-asset caching and restrictive browser headers. The app requires no server functions or runtime environment variables.

Public metadata includes SVG favicon and mark assets, 192px and 512px app icons, an Apple touch icon, web manifest and a 1200x630 social image. The `og:image` value is root-relative until a live URL exists.

No deployment or remote repository is created by this package.

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

# FundProof QA retrospective

Decision: **kill**  
Date: 2026-07-12

## What worked

- The deterministic QA engine, exact-source-span validation and cross-language fixtures produced a credible technical artifact.
- The web preview and offline CLI shared a clear contract and passed the implemented test matrix.
- The scope avoided investment recommendations, production client data and unsupported compliance claims.

## Why the venture was killed

The category was wrong for the Daily Venture Factory. FundProof QA was an operator, compliance and implementation tool presented as a micro-SaaS. Its golden path ended in a technical readiness report, while the free CLI expressed almost the same core value more directly.

That inverted the intended venture pair: the tool became the product, and the proposed SaaS boundary was mostly persistence, collaboration and recurring execution around it. A technically useful artifact is not automatically a public-facing micro-SaaS.

## Durable factory rule

A future venture pair must pass all of these checks before implementation:

1. The SaaS has a clearly named end user or buyer and produces a visible business or life outcome for that person.
2. The value can be described without implementation language such as RAG, evals, validators, policies, schemas or CLIs.
3. The product golden path ends in the user outcome, not in a QA, readiness, audit or infrastructure artifact.
4. The free tool supports adoption or distribution but is not the more legible or desirable product.
5. The SaaS would still have a compelling reason to exist if the technical tool disappeared.

If these checks fail, the candidate must be rejected or explicitly reclassified as a tool-only project. It must not be shipped as a venture pair unless the requested territory is developer tooling itself.

## Disposition

- Public deployment and custom domain: removed.
- Seven-day venture review: cancelled.
- GitHub repository: archived after this retrospective.
- Source: retained as a technical and QA reference; no further product work planned.

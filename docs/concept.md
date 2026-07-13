# Concept

FundProof QA helps IR, content operations and compliance teams catch evidence defects in fund-assistant answers before a release review.

## Narrow job

When a source library or assistant QA set changes, run a deterministic preflight that shows:

- whether answer references resolve to a document, page and exact span;
- whether answer claims have substring or token evidence;
- whether canonical facts conflict across source versions;
- whether a document exceeds an explicit age threshold;
- whether an explicit personalized-recommendation policy class requires refusal.

## Activation

The synthetic sample is ready on open. One click produces the first finding and records local TTV. The target is 60 seconds, with a 120-second gate.

## Boundaries

Free preview: synthetic sample and JSON export. Free tool: offline JSON linting. Intended workspace: saved versioned libraries, diffs, recurring runs, client-configured policies, collaboration, audit history and API access.

This slice does not generate fund content or make investment decisions.

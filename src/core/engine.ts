import { validateInput } from "./validate";
import {
  CHECK_TYPES,
  type CheckSummary,
  type CheckType,
  type Finding,
  type FundSource,
  type PreflightInput,
  type PreflightReport,
  type QaFixture,
  type SourceRef,
} from "./types";

const FIELD_LABELS: Record<string, string> = {
  "management fee": "management_fee",
  benchmark: "benchmark",
};

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "is",
  "of",
  "the",
  "to",
  "with",
]);

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9%+.\-/\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(value: string): string[] {
  return normalize(value)
    .split(" ")
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));
}

function pageForRef(input: PreflightInput, ref: SourceRef) {
  return input.sources
    .find((source) => source.id === ref.sourceId)
    ?.pages.find((page) => page.page === ref.page);
}

function validRefs(input: PreflightInput, qa: QaFixture): SourceRef[] {
  return (qa.sourceRefs ?? []).filter((ref) => {
    const page = pageForRef(input, ref);
    return Boolean(page && ref.span.length > 0 && page.text.includes(ref.span));
  });
}

function coverageFindings(input: PreflightInput): Finding[] {
  return input.qas
    .filter((qa) => qa.policyClass !== "personalized_recommendation")
    .map((qa) => {
      const refs = validRefs(input, qa);
      const covered = refs.length > 0 && refs.length === (qa.sourceRefs ?? []).length;
      return {
        id: `coverage:${qa.id}`,
        type: "source_coverage",
        severity: covered ? "info" : "critical",
        status: covered ? "pass" : "inconclusive",
        qaId: qa.id,
        sourceRefs: refs,
        message: covered
          ? "All supplied references resolve to an exact source span."
          : "No complete source reference resolves to an exact document, page and span.",
        reviewRequired: !covered,
      };
    });
}

function unsupportedFindings(input: PreflightInput): Finding[] {
  return input.qas
    .filter((qa) => qa.policyClass !== "personalized_recommendation")
    .map((qa) => {
      const refs = validRefs(input, qa);
      if (refs.length === 0) {
        return {
          id: `support:${qa.id}`,
          type: "unsupported_claims",
          severity: "critical",
          status: "inconclusive",
          qaId: qa.id,
          sourceRefs: [],
          message: "Evidence could not be checked because no exact source span resolved.",
          reviewRequired: true,
        } satisfies Finding;
      }
      const evidence = refs
        .map((ref) => ref.span)
        .join(" ");
      const claimTokens = [...new Set(tokens(qa.answer))];
      const evidenceTokens = new Set(tokens(evidence));
      const tokenCoverage =
        claimTokens.length === 0
          ? 0
          : claimTokens.filter((token) => evidenceTokens.has(token)).length / claimTokens.length;
      const supported =
        normalize(evidence).includes(normalize(qa.answer)) ||
        (claimTokens.length >= 2 && tokenCoverage >= 0.75);
      return {
        id: `support:${qa.id}`,
        type: "unsupported_claims",
        severity: supported ? "info" : "critical",
        status: supported ? "pass" : "fail",
        qaId: qa.id,
        sourceRefs: refs,
        message: supported
          ? "Answer tokens are present in the linked source evidence."
          : "The answer contains a claim that is not supported by the linked source evidence.",
        reviewRequired: !supported,
      };
    });
}

interface FieldValue {
  canonicalField: string;
  value: string;
  ref: SourceRef;
}

function extractFields(source: FundSource): FieldValue[] {
  const values: FieldValue[] = [];
  for (const page of source.pages) {
    for (const rawLine of page.text.split(/\r?\n/)) {
      const line = rawLine.trim();
      const separator = line.indexOf(":");
      if (separator < 1) continue;
      const label = normalize(line.slice(0, separator));
      const canonicalField = FIELD_LABELS[label];
      const value = line.slice(separator + 1).trim();
      if (canonicalField && value) {
        values.push({
          canonicalField,
          value,
          ref: { sourceId: source.id, page: page.page, span: line },
        });
      }
    }
  }
  return values;
}

function conflictFindings(input: PreflightInput): Finding[] {
  const grouped = new Map<string, FieldValue[]>();
  input.sources.flatMap(extractFields).forEach((field) => {
    grouped.set(field.canonicalField, [...(grouped.get(field.canonicalField) ?? []), field]);
  });
  return [...grouped.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([field, values]) => {
    const distinctValues = new Set(values.map((value) => normalize(value.value)));
    const conflict = distinctValues.size > 1;
    return {
      id: `conflict:${field}`,
      type: "conflicts",
      severity: conflict ? "critical" : "info",
      status: conflict ? "fail" : "pass",
      sourceRefs: values.map((value) => value.ref),
      message: conflict
        ? `${field} has different values across source versions.`
        : `${field} is consistent across source versions.`,
      reviewRequired: conflict,
    };
  });
}

function stalenessFindings(input: PreflightInput): Finding[] {
  const asOf = Date.parse(input.policy.asOfDate);
  const dayMs = 86_400_000;
  return input.sources.map((source) => {
    const ageDays = Math.floor((asOf - Date.parse(source.effectiveDate)) / dayMs);
    const stale = ageDays > input.policy.staleAfterDays;
    const firstPage = source.pages[0];
    return {
      id: `staleness:${source.id}`,
      type: "staleness",
      severity: stale ? "warning" : "info",
      status: stale ? "fail" : "pass",
      sourceRefs: firstPage
        ? [{ sourceId: source.id, page: firstPage.page, span: source.effectiveDate }]
        : [],
      message: stale
        ? `${source.title} is older than the configured ${input.policy.staleAfterDays}-day threshold.`
        : `${source.title} is within the configured staleness threshold.`,
      reviewRequired: stale,
    };
  });
}

function refusalFindings(input: PreflightInput): Finding[] {
  return input.qas
    .filter((qa) => qa.policyClass === "personalized_recommendation")
    .map((qa) => ({
      id: `must-refuse:${qa.id}`,
      type: "must_refuse" as const,
      severity: "critical" as const,
      status: "fail" as const,
      qaId: qa.id,
      sourceRefs: [],
      message:
        "Configured policy requires a refusal. Do not produce a personalized fund recommendation.",
      reviewRequired: true,
    }));
}

function summarize(findings: Finding[]): Record<CheckType, CheckSummary> {
  const result = Object.fromEntries(
    CHECK_TYPES.map((type) => [type, { pass: 0, fail: 0, inconclusive: 0 }]),
  ) as Record<CheckType, CheckSummary>;
  findings.forEach((finding) => {
    result[finding.type][finding.status] += 1;
  });
  return result;
}

export function runPreflight(value: unknown): PreflightReport {
  validateInput(value);
  const input = value;
  const findings = [
    ...coverageFindings(input),
    ...unsupportedFindings(input),
    ...conflictFindings(input),
    ...stalenessFindings(input),
    ...refusalFindings(input),
  ];

  return {
    schemaVersion: "1.0",
    product: "FundProof QA",
    generatedAt: `${input.policy.asOfDate}T00:00:00Z`,
    fundId: input.sources[0].fundId,
    state: "success",
    executedChecks: [...CHECK_TYPES],
    skippedChecks: [],
    summary: summarize(findings),
    findings,
  };
}

export function createPartialReport(report: PreflightReport): PreflightReport {
  const executedChecks: CheckType[] = ["source_coverage", "unsupported_claims"];
  const findings = report.findings.filter((finding) => executedChecks.includes(finding.type));
  return {
    ...report,
    state: "partial",
    executedChecks,
    skippedChecks: CHECK_TYPES.filter((type) => !executedChecks.includes(type)),
    summary: summarize(findings),
    findings,
  };
}

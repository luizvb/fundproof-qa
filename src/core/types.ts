export const CHECK_TYPES = [
  "source_coverage",
  "unsupported_claims",
  "conflicts",
  "staleness",
  "must_refuse",
] as const;

export type CheckType = (typeof CHECK_TYPES)[number];
export type FindingStatus = "pass" | "fail" | "inconclusive";
export type Severity = "info" | "warning" | "critical";

export interface SourceRef {
  sourceId: string;
  page: number;
  span: string;
}

export interface SourcePage {
  page: number;
  text: string;
}

export interface FundSource {
  id: string;
  title: string;
  fundId: string;
  version: string;
  effectiveDate: string;
  pages: SourcePage[];
}

export interface QaFixture {
  id: string;
  question: string;
  answer: string;
  policyClass?: string;
  expectedOutcome?: string;
  sourceRefs?: SourceRef[];
}

export interface PreflightInput {
  schemaVersion: "1.0";
  policy: {
    asOfDate: string;
    staleAfterDays: number;
  };
  sources: FundSource[];
  qas: QaFixture[];
}

export interface Finding {
  id: string;
  type: CheckType;
  severity: Severity;
  status: FindingStatus;
  qaId?: string;
  sourceRefs: SourceRef[];
  message: string;
  reviewRequired: boolean;
}

export interface CheckSummary {
  pass: number;
  fail: number;
  inconclusive: number;
}

export interface PreflightReport {
  schemaVersion: "1.0";
  product: "FundProof QA";
  generatedAt: string;
  fundId: string;
  state: "success" | "partial";
  executedChecks: CheckType[];
  skippedChecks: CheckType[];
  summary: Record<CheckType, CheckSummary>;
  findings: Finding[];
}

export class PreflightError extends Error {
  constructor(
    public readonly code:
      | "INVALID_INPUT"
      | "LIMIT_EXCEEDED"
      | "MIXED_FUND_IDS",
    message: string,
  ) {
    super(message);
    this.name = "PreflightError";
  }
}

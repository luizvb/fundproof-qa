import {
  PreflightError,
  type FundSource,
  type PreflightInput,
  type QaFixture,
} from "./types";

export const LIMITS = {
  maxBytes: 20 * 1024 * 1024,
  maxSources: 3,
  maxQas: 20,
} as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireString(value: unknown, path: string): asserts value is string {
  if (typeof value !== "string") {
    throw new PreflightError("INVALID_INPUT", `${path} must be a string.`);
  }
}

function requireNonEmptyString(value: unknown, path: string): asserts value is string {
  requireString(value, path);
  if (value.trim() === "") {
    throw new PreflightError("INVALID_INPUT", `${path} must not be empty.`);
  }
}

function isStrictDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function validateSource(value: unknown, index: number): asserts value is FundSource {
  if (!isRecord(value)) {
    throw new PreflightError("INVALID_INPUT", `sources[${index}] must be an object.`);
  }
  for (const field of ["id", "title", "fundId", "version", "effectiveDate"] as const) {
    requireNonEmptyString(value[field], `sources[${index}].${field}`);
  }
  if (!Array.isArray(value.pages) || value.pages.length === 0) {
    throw new PreflightError("INVALID_INPUT", `sources[${index}].pages must be a non-empty array.`);
  }
  value.pages.forEach((page, pageIndex) => {
    if (
      !isRecord(page) ||
      !Number.isInteger(page.page) ||
      Number(page.page) < 1 ||
      typeof page.text !== "string" ||
      page.text.trim() === ""
    ) {
      throw new PreflightError(
        "INVALID_INPUT",
        `sources[${index}].pages[${pageIndex}] must contain an integer page and text.`,
      );
    }
  });
  if (!isStrictDate(value.effectiveDate as string)) {
    throw new PreflightError("INVALID_INPUT", `sources[${index}].effectiveDate is invalid.`);
  }
}

function validateQa(value: unknown, index: number): asserts value is QaFixture {
  if (!isRecord(value)) {
    throw new PreflightError("INVALID_INPUT", `qas[${index}] must be an object.`);
  }
  for (const field of ["id", "question", "answer"] as const) {
    if (field === "answer") {
      requireString(value[field], `qas[${index}].${field}`);
    } else {
      requireNonEmptyString(value[field], `qas[${index}].${field}`);
    }
  }
  if (
    (value.answer as string).trim() === "" &&
    value.policyClass !== "personalized_recommendation"
  ) {
    throw new PreflightError(
      "INVALID_INPUT",
      `qas[${index}].answer may be empty only for personalized_recommendation.`,
    );
  }
  if (value.sourceRefs !== undefined) {
    if (!Array.isArray(value.sourceRefs)) {
      throw new PreflightError("INVALID_INPUT", `qas[${index}].sourceRefs must be an array.`);
    }
    value.sourceRefs.forEach((ref, refIndex) => {
      if (
        !isRecord(ref) ||
        typeof ref.sourceId !== "string" ||
        ref.sourceId.trim() === "" ||
        !Number.isInteger(ref.page) ||
        Number(ref.page) < 1 ||
        typeof ref.span !== "string" ||
        ref.span.trim() === ""
      ) {
        throw new PreflightError(
          "INVALID_INPUT",
          `qas[${index}].sourceRefs[${refIndex}] is invalid.`,
        );
      }
    });
  }
}

export function validateInput(value: unknown): asserts value is PreflightInput {
  let encoded: string;
  try {
    encoded = JSON.stringify(value);
  } catch {
    throw new PreflightError("INVALID_INPUT", "Input must be serializable JSON.");
  }
  if (new TextEncoder().encode(encoded).byteLength > LIMITS.maxBytes) {
    throw new PreflightError("LIMIT_EXCEEDED", "Input exceeds the 20 MB guest limit.");
  }
  if (!isRecord(value) || value.schemaVersion !== "1.0") {
    throw new PreflightError("INVALID_INPUT", "schemaVersion must be 1.0.");
  }
  if (!isRecord(value.policy)) {
    throw new PreflightError("INVALID_INPUT", "policy must be an object.");
  }
  requireString(value.policy.asOfDate, "policy.asOfDate");
  if (!isStrictDate(value.policy.asOfDate)) {
    throw new PreflightError("INVALID_INPUT", "policy.asOfDate is invalid.");
  }
  if (!Number.isInteger(value.policy.staleAfterDays) || Number(value.policy.staleAfterDays) < 1) {
    throw new PreflightError("INVALID_INPUT", "policy.staleAfterDays must be a positive integer.");
  }
  if (!Array.isArray(value.sources) || value.sources.length === 0) {
    throw new PreflightError("INVALID_INPUT", "sources must be a non-empty array.");
  }
  if (value.sources.length > LIMITS.maxSources) {
    throw new PreflightError("LIMIT_EXCEEDED", "Guest preflight accepts at most 3 sources.");
  }
  if (!Array.isArray(value.qas) || value.qas.length === 0) {
    throw new PreflightError("INVALID_INPUT", "qas must be a non-empty array.");
  }
  if (value.qas.length > LIMITS.maxQas) {
    throw new PreflightError("LIMIT_EXCEEDED", "Guest preflight accepts at most 20 QAs.");
  }
  value.sources.forEach(validateSource);
  value.qas.forEach(validateQa);

  const fundIds = new Set(value.sources.map((source) => source.fundId));
  if (fundIds.size !== 1) {
    throw new PreflightError(
      "MIXED_FUND_IDS",
      "Sources contain mixed fundIds. Preflight stopped before running checks.",
    );
  }
}

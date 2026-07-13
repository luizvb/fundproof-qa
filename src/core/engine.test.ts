import { describe, expect, it } from "vitest";
import emptyTitle from "../../testdata/adversarial/empty-title.json";
import emptyAnswerNonPolicy from "../../testdata/adversarial/empty-answer-non-policy.json";
import looseDate from "../../testdata/adversarial/loose-date.json";
import missingAnswer from "../../testdata/adversarial/missing-answer.json";
import pageZero from "../../testdata/adversarial/page-zero.json";
import whitespaceTitle from "../../testdata/adversarial/whitespace-title.json";
import { SAMPLE_INPUT } from "../fixtures/sample";
import { runPreflight } from "./engine";
import { PreflightError, type PreflightInput } from "./types";

function cloneSample(): PreflightInput {
  return structuredClone(SAMPLE_INPUT);
}

describe("runPreflight", () => {
  it("returns all five checks with deterministic findings", () => {
    const first = runPreflight(cloneSample());
    const second = runPreflight(cloneSample());

    expect(first).toEqual(second);
    expect(first.executedChecks).toEqual([
      "source_coverage",
      "unsupported_claims",
      "conflicts",
      "staleness",
      "must_refuse",
    ]);
    expect(first.findings.some((finding) => finding.type === "must_refuse")).toBe(true);
    expect(
      first.findings.some(
        (finding) => finding.type === "unsupported_claims" && finding.status === "fail",
      ),
    ).toBe(true);
    expect(first.findings.filter((finding) => finding.type === "conflicts" && finding.status === "fail"))
      .toHaveLength(2);
    expect(first.findings.filter((finding) => finding.type === "conflicts").map((finding) => finding.id))
      .toEqual(["conflict:benchmark", "conflict:management_fee"]);
  });

  it("keeps source evidence on support and conflict findings unless inconclusive", () => {
    const report = runPreflight(cloneSample());
    const evidenceFindings = report.findings.filter((finding) =>
      ["source_coverage", "unsupported_claims", "conflicts"].includes(finding.type),
    );

    evidenceFindings.forEach((finding) => {
      if (finding.status !== "inconclusive") {
        expect(finding.sourceRefs.length).toBeGreaterThan(0);
        finding.sourceRefs.forEach((ref) => {
          expect(ref.sourceId).not.toBe("");
          expect(ref.page).toBeGreaterThan(0);
          expect(ref.span).not.toBe("");
        });
      }
    });
  });

  it("fails closed for mixed fundIds", () => {
    const mixed = cloneSample();
    mixed.sources[1].fundId = "BR-OTHER-FUND";

    expect(() => runPreflight(mixed)).toThrowError(PreflightError);
    try {
      runPreflight(mixed);
    } catch (error) {
      expect(error).toMatchObject({ code: "MIXED_FUND_IDS" });
    }
  });

  it("returns inconclusive support when a source span is invalid", () => {
    const invalidRef = cloneSample();
    invalidRef.qas[0].sourceRefs![0].span = "Not present";
    const report = runPreflight(invalidRef);

    expect(report.findings).toContainEqual(
      expect.objectContaining({
        id: "support:qa-management-fee",
        status: "inconclusive",
        sourceRefs: [],
      }),
    );
  });

  it("checks support against exact referenced spans, not unrelated page text", () => {
    const laundered = cloneSample();
    laundered.qas[0].answer = "IMA-B";
    const report = runPreflight(laundered);

    expect(report.findings).toContainEqual(
      expect.objectContaining({
        id: "support:qa-management-fee",
        status: "fail",
      }),
    );
  });

  it.each([
    ["missing answer", missingAnswer],
    ["page zero", pageZero],
    ["empty source title", emptyTitle],
    ["whitespace source title", whitespaceTitle],
    ["empty answer without policy", emptyAnswerNonPolicy],
    ["loose date", looseDate],
  ])("rejects adversarial fixture: %s", (_name, fixture) => {
    expect(() => runPreflight(fixture)).toThrowError(PreflightError);
    try {
      runPreflight(fixture);
    } catch (error) {
      expect(error).toMatchObject({ code: "INVALID_INPUT" });
    }
  });

  it("rejects corrupt and oversized shapes with specific codes", () => {
    expect(() => runPreflight({ schemaVersion: "1.0" })).toThrowError(PreflightError);

    const tooManyQas = cloneSample();
    tooManyQas.qas = Array.from({ length: 21 }, (_, index) => ({
      id: `qa-${index}`,
      question: "Question",
      answer: "Answer",
    }));
    try {
      runPreflight(tooManyQas);
    } catch (error) {
      expect(error).toMatchObject({ code: "LIMIT_EXCEEDED" });
    }

    const tooLarge = cloneSample();
    tooLarge.sources[0].title = "x".repeat(20 * 1024 * 1024);
    try {
      runPreflight(tooLarge);
      throw new Error("Expected oversized input to fail");
    } catch (error) {
      expect(error).toMatchObject({ code: "LIMIT_EXCEEDED" });
    }
  });
});

import { useMemo, useRef, useState } from "react";
import { track } from "./analytics";
import { createPartialReport, runPreflight } from "./core/engine";
import {
  CHECK_TYPES,
  PreflightError,
  type CheckType,
  type Finding,
  type PreflightReport,
} from "./core/types";
import { SAMPLE_INPUT } from "./fixtures/sample";

type ViewState = "idle" | "loading" | "success" | "partial" | "error";
type RunMode = "success" | "partial" | "error";

const CHECK_LABELS: Record<CheckType, string> = {
  source_coverage: "Coverage",
  unsupported_claims: "Unsupported",
  conflicts: "Conflicts",
  staleness: "Staleness",
  must_refuse: "Must refuse",
};

function formatTtv(ttvMs: number | null) {
  if (ttvMs === null) return "Not measured";
  if (ttvMs < 1_000) return `${Math.round(ttvMs)} ms`;
  return `${(ttvMs / 1_000).toFixed(2)} s`;
}

function FindingRow({ finding }: { finding: Finding }) {
  const refs = finding.sourceRefs.map((ref) => {
    const source = SAMPLE_INPUT.sources.find((item) => item.id === ref.sourceId);
    return { ...ref, title: source?.title ?? ref.sourceId };
  });

  return (
    <details className="finding">
      <summary>
        <span className={`status-label status-${finding.status}`}>{finding.status}</span>
        <span className="finding-title">{CHECK_LABELS[finding.type]}</span>
        <span className="finding-message">{finding.message}</span>
      </summary>
      <div className="finding-body">
        {finding.qaId ? <p className="finding-meta">QA ID: {finding.qaId}</p> : null}
        {refs.length > 0 ? (
          <ul className="source-list" aria-label="Source references">
            {refs.map((ref) => (
              <li key={`${finding.id}:${ref.sourceId}:${ref.page}:${ref.span}`}>
                <span>{ref.title}</span>
                <strong>Page {ref.page}</strong>
                <blockquote>{ref.span}</blockquote>
              </li>
            ))}
          </ul>
        ) : (
          <p className="no-source">
            {finding.status === "inconclusive"
              ? "No exact source span resolved."
              : "This policy finding does not depend on source evidence."}
          </p>
        )}
        <p className="review-line">
          Human review: {finding.reviewRequired ? "required" : "not required for this check"}
        </p>
      </div>
    </details>
  );
}

function LoadingReport() {
  return (
    <div className="loading-report" aria-label="Running preflight">
      <div className="skeleton skeleton-title" />
      <div className="skeleton-grid">
        {CHECK_TYPES.map((check) => (
          <div className="skeleton skeleton-cell" key={check} />
        ))}
      </div>
      <div className="skeleton skeleton-row" />
      <div className="skeleton skeleton-row short" />
    </div>
  );
}

export function App() {
  const [viewState, setViewState] = useState<ViewState>("idle");
  const [report, setReport] = useState<PreflightReport | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [ttvMs, setTtvMs] = useState<number | null>(null);
  const [exported, setExported] = useState(false);
  const [saveIntent, setSaveIntent] = useState(false);
  const startedAt = useRef<number | null>(null);

  const reviewCount = useMemo(
    () => report?.findings.filter((finding) => finding.reviewRequired).length ?? 0,
    [report],
  );
  const exportHref = useMemo(() => {
    if (!report) return undefined;
    const payload = JSON.stringify({ ...report, metrics: { ttvMs } }, null, 2);
    return `data:application/json;charset=utf-8,${encodeURIComponent(payload)}`;
  }, [report, ttvMs]);

  function run(mode: RunMode = "success") {
    setViewState("loading");
    setReport(null);
    setErrorMessage("");
    setExported(false);
    setSaveIntent(false);
    setTtvMs(null);
    startedAt.current = performance.now();
    track("run_started");

    window.setTimeout(() => {
      try {
        if (mode === "error") {
          throw new PreflightError(
            "INVALID_INPUT",
            "Input could not be parsed. No checks were executed.",
          );
        }
        const complete = runPreflight(structuredClone(SAMPLE_INPUT));
        const nextReport = mode === "partial" ? createPartialReport(complete) : complete;
        const measuredTtv = performance.now() - (startedAt.current ?? performance.now());
        setReport(nextReport);
        setTtvMs(measuredTtv);
        setViewState(mode === "partial" ? "partial" : "success");
        track("first_finding", measuredTtv);
      } catch (error) {
        setViewState("error");
        setErrorMessage(error instanceof Error ? error.message : "Preflight failed closed.");
      }
    }, 460);
  }

  function exportJson() {
    if (!report || !exportHref) return;
    setExported(true);
    track("export_json", ttvMs ?? undefined);
  }

  function registerSaveIntent() {
    setSaveIntent(true);
    track("save_intent");
  }

  function registerUpgradeIntent() {
    track("upgrade_intent");
  }

  return (
    <div className="page-shell">
      <header className="site-header">
        <a className="brand" href="#top" aria-label="FundProof QA home">
          <span className="brand-mark" aria-hidden="true">
            <span />
            <i />
          </span>
          <span>FundProof QA</span>
        </a>
        <nav aria-label="Primary navigation">
          <a href="#method">Method</a>
          <a href="#tool">Local tool</a>
          <a href="#limits">Boundaries</a>
        </nav>
      </header>

      <main id="top">
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero-copy">
            <p className="eyebrow">Evidence-first QA</p>
            <h1 id="hero-title">
              <span>Prove what your fund</span>
              <span>assistant can answer.</span>
            </h1>
            <p className="hero-subtitle">
              Run a source-linked preflight for gaps, conflicts, stale facts and questions your
              assistant should refuse.
            </p>
          </div>

          <section className="preflight-panel" aria-labelledby="preflight-title">
            <header className="panel-header">
              <div>
                <p className="panel-kicker">Synthetic sample ready</p>
                <h2 id="preflight-title">Aurora Income Fund</h2>
              </div>
              <span className="sample-count">2 sources / 3 QAs</span>
            </header>

            {viewState === "idle" ? (
              <div className="idle-state">
                <div className="sample-docs" aria-label="Sample contents">
                  <article>
                    <span>Source versions</span>
                    <strong>2024.1 and 2026.2</strong>
                    <small>Fee and benchmark differ</small>
                  </article>
                  <article>
                    <span>Policy fixture</span>
                    <strong>Personalized recommendation</strong>
                    <small>Expected outcome: must refuse</small>
                  </article>
                </div>
                <button className="button button-primary" type="button" onClick={() => run()}>
                  Run preflight
                </button>
              </div>
            ) : null}

            {viewState === "loading" ? <LoadingReport /> : null}

            {viewState === "error" ? (
              <div className="error-state" role="alert">
                <span className="status-label status-fail">stopped</span>
                <h3>Preflight did not run</h3>
                <p>{errorMessage}</p>
                <button className="button button-secondary" type="button" onClick={() => run()}>
                  Restore sample
                </button>
              </div>
            ) : null}

            {report ? (
              <div className="report" aria-live="polite">
                <div className="report-lead">
                  <div>
                    <span className={`status-label status-${report.state === "partial" ? "inconclusive" : "pass"}`}>
                      {report.state}
                    </span>
                    <h3>{reviewCount} findings need review</h3>
                  </div>
                  <div className="ttv">
                    <span>First finding</span>
                    <strong>{formatTtv(ttvMs)}</strong>
                  </div>
                </div>

                {report.state === "partial" ? (
                  <div className="partial-note" role="status">
                    <strong>Timeout preview</strong>
                    <span>Executed: {report.executedChecks.map((item) => CHECK_LABELS[item]).join(", ")}</span>
                    <span>Skipped: {report.skippedChecks.map((item) => CHECK_LABELS[item]).join(", ")}</span>
                  </div>
                ) : null}

                <div className="check-grid" aria-label="Check summary">
                  {CHECK_TYPES.map((check) => {
                    const summary = report.summary[check];
                    return (
                      <div key={check}>
                        <span>{CHECK_LABELS[check]}</span>
                        <strong>{summary.fail + summary.inconclusive}</strong>
                        <small>review</small>
                      </div>
                    );
                  })}
                </div>

                <div className="finding-list">
                  {report.findings.map((finding) => (
                    <FindingRow finding={finding} key={finding.id} />
                  ))}
                </div>

                <div className="report-actions">
                  <a
                    className="button button-primary"
                    href={exportHref}
                    download="fundproof-qa-report.json"
                    onClick={exportJson}
                  >
                    Export JSON
                  </a>
                  <button className="button button-secondary" type="button" onClick={() => run()}>
                    Run again
                  </button>
                </div>

                {exported ? (
                  <aside className="save-intent">
                    <div>
                      <strong>Keep this report versioned</strong>
                      <p>Saved libraries, release diffs and recurring runs are workspace features.</p>
                    </div>
                    {!saveIntent ? (
                      <button className="button button-secondary" type="button" onClick={registerSaveIntent}>
                        Save report
                      </button>
                    ) : (
                      <button className="button button-primary" type="button" onClick={registerUpgradeIntent}>
                        View workspace
                      </button>
                    )}
                  </aside>
                ) : null}
              </div>
            ) : null}

            <details className="state-controls">
              <summary>Preview failure states</summary>
              <div>
                <button type="button" className="text-button" onClick={() => run("partial")}>
                  Timeout
                </button>
                <button type="button" className="text-button" onClick={() => run("error")}>
                  Invalid input
                </button>
              </div>
            </details>
          </section>
        </section>

        <section className="method" id="method" aria-labelledby="method-title">
          <h2 id="method-title">Every conclusion keeps its evidence address.</h2>
          <p>
            Support and conflict checks carry the document, page and exact span. Missing evidence
            stays inconclusive.
          </p>
          <div className="evidence-address">
            <span>Aurora Income Fund Factsheet 2026</span>
            <strong>Page 3</strong>
            <blockquote>Management fee: 1.35% p.a.</blockquote>
          </div>
        </section>

        <section className="tool-section" id="tool" aria-labelledby="tool-title">
          <div>
            <h2 id="tool-title">The same checks, offline.</h2>
            <p>
              fundproof-lint accepts the shared JSON contract, makes no network calls and returns
              machine-readable output.
            </p>
          </div>
          <pre aria-label="Command line example"><code>fundproof-lint sample.json &gt; report.json</code></pre>
        </section>

        <section className="limits" id="limits" aria-labelledby="limits-title">
          <div className="limits-copy">
            <h2 id="limits-title">A preflight, not an investment decision.</h2>
            <p>
              The preview runs fixed checks against synthetic data. It does not generate answers,
              rank funds or process client documents.
            </p>
          </div>
          <dl>
            <div>
              <dt>Guest input</dt>
              <dd>2 synthetic factsheets and 3 QAs</dd>
            </div>
            <div>
              <dt>Runtime</dt>
              <dd>Browser memory only</dd>
            </div>
            <div>
              <dt>Analytics</dt>
              <dd>Event name, timestamp and TTV only</dd>
            </div>
            <div>
              <dt>Policy</dt>
              <dd>Explicit fixture classes only</dd>
            </div>
          </dl>
        </section>
      </main>

      <footer>
        <span>FundProof QA</span>
        <span>Preview with synthetic data only</span>
      </footer>
    </div>
  );
}

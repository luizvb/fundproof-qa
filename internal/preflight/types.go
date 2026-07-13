package preflight

const (
	CheckSourceCoverage       = "source_coverage"
	CheckUnsupported          = "unsupported_claims"
	CheckConflicts            = "conflicts"
	CheckStaleness            = "staleness"
	CheckMustRefuse           = "must_refuse"
	SchemaVersion             = "1.0"
	MaxInputBytes       int64 = 20 * 1024 * 1024
	MaxSources                = 3
	MaxQAs                    = 20
)

var CheckTypes = []string{
	CheckSourceCoverage,
	CheckUnsupported,
	CheckConflicts,
	CheckStaleness,
	CheckMustRefuse,
}

type SourceRef struct {
	SourceID string `json:"sourceId"`
	Page     int    `json:"page"`
	Span     string `json:"span"`
}

type SourcePage struct {
	Page int    `json:"page"`
	Text string `json:"text"`
}

type FundSource struct {
	ID            string       `json:"id"`
	Title         string       `json:"title"`
	FundID        string       `json:"fundId"`
	Version       string       `json:"version"`
	EffectiveDate string       `json:"effectiveDate"`
	Pages         []SourcePage `json:"pages"`
}

type QA struct {
	ID              string      `json:"id"`
	Question        string      `json:"question"`
	Answer          string      `json:"answer"`
	PolicyClass     string      `json:"policyClass,omitempty"`
	ExpectedOutcome string      `json:"expectedOutcome,omitempty"`
	SourceRefs      []SourceRef `json:"sourceRefs,omitempty"`
}

type Policy struct {
	AsOfDate       string `json:"asOfDate"`
	StaleAfterDays int    `json:"staleAfterDays"`
}

type Input struct {
	SchemaVersion string       `json:"schemaVersion"`
	Policy        Policy       `json:"policy"`
	Sources       []FundSource `json:"sources"`
	QAs           []QA         `json:"qas"`
}

type Finding struct {
	ID             string      `json:"id"`
	Type           string      `json:"type"`
	Severity       string      `json:"severity"`
	Status         string      `json:"status"`
	QAID           string      `json:"qaId,omitempty"`
	SourceRefs     []SourceRef `json:"sourceRefs"`
	Message        string      `json:"message"`
	ReviewRequired bool        `json:"reviewRequired"`
}

type CheckSummary struct {
	Pass         int `json:"pass"`
	Fail         int `json:"fail"`
	Inconclusive int `json:"inconclusive"`
}

type Report struct {
	SchemaVersion  string                  `json:"schemaVersion"`
	Product        string                  `json:"product"`
	GeneratedAt    string                  `json:"generatedAt"`
	FundID         string                  `json:"fundId"`
	State          string                  `json:"state"`
	ExecutedChecks []string                `json:"executedChecks"`
	SkippedChecks  []string                `json:"skippedChecks"`
	Summary        map[string]CheckSummary `json:"summary"`
	Findings       []Finding               `json:"findings"`
}

type ValidationError struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

func (e *ValidationError) Error() string {
	return e.Code + ": " + e.Message
}

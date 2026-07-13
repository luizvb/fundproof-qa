package preflight

import (
	"encoding/json"
	"fmt"
	"io"
	"regexp"
	"sort"
	"strings"
	"time"
)

var (
	nonTokenChars = regexp.MustCompile(`[^a-z0-9%+.\-/\s]`)
	spaceChars    = regexp.MustCompile(`\s+`)
	stopWords     = map[string]bool{
		"a": true, "an": true, "and": true, "is": true,
		"of": true, "the": true, "to": true, "with": true,
	}
	fieldLabels = map[string]string{
		"management fee": "management_fee",
		"benchmark":      "benchmark",
	}
)

func Decode(r io.Reader) (Input, error) {
	limited := io.LimitReader(r, MaxInputBytes+1)
	data, err := io.ReadAll(limited)
	if err != nil {
		return Input{}, &ValidationError{Code: "INVALID_INPUT", Message: "could not read input"}
	}
	if int64(len(data)) > MaxInputBytes {
		return Input{}, &ValidationError{Code: "LIMIT_EXCEEDED", Message: "input exceeds the 20 MB limit"}
	}
	var input Input
	decoder := json.NewDecoder(strings.NewReader(string(data)))
	if err := decoder.Decode(&input); err != nil {
		return Input{}, &ValidationError{Code: "INVALID_INPUT", Message: "input is not valid JSON"}
	}
	if err := ensureSingleJSONValue(decoder); err != nil {
		return Input{}, err
	}
	if err := requireAnswerFields(data); err != nil {
		return Input{}, err
	}
	return input, nil
}

func requireAnswerFields(data []byte) error {
	var envelope struct {
		QAs []map[string]json.RawMessage `json:"qas"`
	}
	if err := json.Unmarshal(data, &envelope); err != nil {
		return &ValidationError{Code: "INVALID_INPUT", Message: "input is not valid JSON"}
	}
	for index, qa := range envelope.QAs {
		if _, ok := qa["answer"]; !ok {
			return &ValidationError{Code: "INVALID_INPUT", Message: fmt.Sprintf("qa %d is missing answer", index)}
		}
	}
	return nil
}

func ensureSingleJSONValue(decoder *json.Decoder) error {
	var extra any
	if err := decoder.Decode(&extra); err != io.EOF {
		return &ValidationError{Code: "INVALID_INPUT", Message: "input must contain one JSON value"}
	}
	return nil
}

func Validate(input Input) error {
	if input.SchemaVersion != SchemaVersion {
		return &ValidationError{Code: "INVALID_INPUT", Message: "schemaVersion must be 1.0"}
	}
	if _, err := time.Parse("2006-01-02", input.Policy.AsOfDate); err != nil {
		return &ValidationError{Code: "INVALID_INPUT", Message: "policy.asOfDate must use YYYY-MM-DD"}
	}
	if input.Policy.StaleAfterDays < 1 {
		return &ValidationError{Code: "INVALID_INPUT", Message: "policy.staleAfterDays must be positive"}
	}
	if len(input.Sources) == 0 {
		return &ValidationError{Code: "INVALID_INPUT", Message: "sources must not be empty"}
	}
	if len(input.Sources) > MaxSources {
		return &ValidationError{Code: "LIMIT_EXCEEDED", Message: "at most 3 sources are accepted"}
	}
	if len(input.QAs) == 0 {
		return &ValidationError{Code: "INVALID_INPUT", Message: "qas must not be empty"}
	}
	if len(input.QAs) > MaxQAs {
		return &ValidationError{Code: "LIMIT_EXCEEDED", Message: "at most 20 QAs are accepted"}
	}
	fundID := input.Sources[0].FundID
	if strings.TrimSpace(fundID) == "" {
		return &ValidationError{Code: "INVALID_INPUT", Message: "source fundId must not be empty"}
	}
	for index, source := range input.Sources {
		if strings.TrimSpace(source.ID) == "" || strings.TrimSpace(source.Title) == "" || strings.TrimSpace(source.Version) == "" {
			return &ValidationError{Code: "INVALID_INPUT", Message: fmt.Sprintf("source %d is missing required fields", index)}
		}
		if source.FundID != fundID {
			return &ValidationError{Code: "MIXED_FUND_IDS", Message: "sources contain mixed fundIds; checks were not run"}
		}
		if _, err := time.Parse("2006-01-02", source.EffectiveDate); err != nil {
			return &ValidationError{Code: "INVALID_INPUT", Message: fmt.Sprintf("source %d has an invalid effectiveDate", index)}
		}
		if len(source.Pages) == 0 {
			return &ValidationError{Code: "INVALID_INPUT", Message: fmt.Sprintf("source %d has no pages", index)}
		}
		for _, page := range source.Pages {
			if page.Page < 1 || strings.TrimSpace(page.Text) == "" {
				return &ValidationError{Code: "INVALID_INPUT", Message: fmt.Sprintf("source %d has an invalid page", index)}
			}
		}
	}
	for index, qa := range input.QAs {
		if strings.TrimSpace(qa.ID) == "" || strings.TrimSpace(qa.Question) == "" {
			return &ValidationError{Code: "INVALID_INPUT", Message: fmt.Sprintf("qa %d is missing required fields", index)}
		}
		if strings.TrimSpace(qa.Answer) == "" && qa.PolicyClass != "personalized_recommendation" {
			return &ValidationError{Code: "INVALID_INPUT", Message: fmt.Sprintf("qa %d answer may be empty only for personalized_recommendation", index)}
		}
		for refIndex, ref := range qa.SourceRefs {
			if strings.TrimSpace(ref.SourceID) == "" || ref.Page < 1 || strings.TrimSpace(ref.Span) == "" {
				return &ValidationError{Code: "INVALID_INPUT", Message: fmt.Sprintf("qa %d sourceRef %d is invalid", index, refIndex)}
			}
		}
	}
	return nil
}

func Run(input Input) (Report, error) {
	if err := Validate(input); err != nil {
		return Report{}, err
	}
	findings := make([]Finding, 0)
	findings = append(findings, coverageFindings(input)...)
	findings = append(findings, unsupportedFindings(input)...)
	findings = append(findings, conflictFindings(input)...)
	findings = append(findings, stalenessFindings(input)...)
	findings = append(findings, refusalFindings(input)...)

	return Report{
		SchemaVersion:  SchemaVersion,
		Product:        "FundProof QA",
		GeneratedAt:    input.Policy.AsOfDate + "T00:00:00Z",
		FundID:         input.Sources[0].FundID,
		State:          "success",
		ExecutedChecks: append([]string(nil), CheckTypes...),
		SkippedChecks:  []string{},
		Summary:        summarize(findings),
		Findings:       findings,
	}, nil
}

func RunReader(r io.Reader) (Report, error) {
	input, err := Decode(r)
	if err != nil {
		return Report{}, err
	}
	return Run(input)
}

func normalize(value string) string {
	value = strings.ToLower(value)
	value = nonTokenChars.ReplaceAllString(value, " ")
	return strings.TrimSpace(spaceChars.ReplaceAllString(value, " "))
}

func tokens(value string) []string {
	result := make([]string, 0)
	for _, token := range strings.Fields(normalize(value)) {
		if len(token) > 1 && !stopWords[token] {
			result = append(result, token)
		}
	}
	return result
}

func pageForRef(input Input, ref SourceRef) (SourcePage, bool) {
	for _, source := range input.Sources {
		if source.ID != ref.SourceID {
			continue
		}
		for _, page := range source.Pages {
			if page.Page == ref.Page {
				return page, true
			}
		}
	}
	return SourcePage{}, false
}

func validRefs(input Input, qa QA) []SourceRef {
	refs := make([]SourceRef, 0)
	for _, ref := range qa.SourceRefs {
		page, ok := pageForRef(input, ref)
		if ok && ref.Span != "" && strings.Contains(page.Text, ref.Span) {
			refs = append(refs, ref)
		}
	}
	return refs
}

func coverageFindings(input Input) []Finding {
	result := make([]Finding, 0)
	for _, qa := range input.QAs {
		if qa.PolicyClass == "personalized_recommendation" {
			continue
		}
		refs := validRefs(input, qa)
		covered := len(refs) > 0 && len(refs) == len(qa.SourceRefs)
		finding := Finding{
			ID:             "coverage:" + qa.ID,
			Type:           CheckSourceCoverage,
			Severity:       "info",
			Status:         "pass",
			QAID:           qa.ID,
			SourceRefs:     refs,
			Message:        "All supplied references resolve to an exact source span.",
			ReviewRequired: false,
		}
		if !covered {
			finding.Severity = "critical"
			finding.Status = "inconclusive"
			finding.Message = "No complete source reference resolves to an exact document, page and span."
			finding.ReviewRequired = true
		}
		result = append(result, finding)
	}
	return result
}

func unsupportedFindings(input Input) []Finding {
	result := make([]Finding, 0)
	for _, qa := range input.QAs {
		if qa.PolicyClass == "personalized_recommendation" {
			continue
		}
		refs := validRefs(input, qa)
		if len(refs) == 0 {
			result = append(result, Finding{
				ID: "support:" + qa.ID, Type: CheckUnsupported, Severity: "critical",
				Status: "inconclusive", QAID: qa.ID, SourceRefs: []SourceRef{},
				Message: "Evidence could not be checked because no exact source span resolved.", ReviewRequired: true,
			})
			continue
		}
		evidenceParts := make([]string, 0, len(refs))
		for _, ref := range refs {
			evidenceParts = append(evidenceParts, ref.Span)
		}
		evidence := strings.Join(evidenceParts, " ")
		claimSet := map[string]bool{}
		for _, token := range tokens(qa.Answer) {
			claimSet[token] = true
		}
		evidenceSet := map[string]bool{}
		for _, token := range tokens(evidence) {
			evidenceSet[token] = true
		}
		matched := 0
		for token := range claimSet {
			if evidenceSet[token] {
				matched++
			}
		}
		coverage := 0.0
		if len(claimSet) > 0 {
			coverage = float64(matched) / float64(len(claimSet))
		}
		supported := strings.Contains(normalize(evidence), normalize(qa.Answer)) || (len(claimSet) >= 2 && coverage >= 0.75)
		finding := Finding{
			ID: "support:" + qa.ID, Type: CheckUnsupported, Severity: "info", Status: "pass",
			QAID: qa.ID, SourceRefs: refs, Message: "Answer tokens are present in the linked source evidence.", ReviewRequired: false,
		}
		if !supported {
			finding.Severity = "critical"
			finding.Status = "fail"
			finding.Message = "The answer contains a claim that is not supported by the linked source evidence."
			finding.ReviewRequired = true
		}
		result = append(result, finding)
	}
	return result
}

type fieldValue struct {
	CanonicalField string
	Value          string
	Ref            SourceRef
}

func extractFields(source FundSource) []fieldValue {
	result := make([]fieldValue, 0)
	for _, page := range source.Pages {
		for _, rawLine := range strings.Split(strings.ReplaceAll(page.Text, "\r\n", "\n"), "\n") {
			line := strings.TrimSpace(rawLine)
			separator := strings.Index(line, ":")
			if separator < 1 {
				continue
			}
			canonical, ok := fieldLabels[normalize(line[:separator])]
			value := strings.TrimSpace(line[separator+1:])
			if ok && value != "" {
				result = append(result, fieldValue{
					CanonicalField: canonical,
					Value:          value,
					Ref:            SourceRef{SourceID: source.ID, Page: page.Page, Span: line},
				})
			}
		}
	}
	return result
}

func conflictFindings(input Input) []Finding {
	grouped := map[string][]fieldValue{}
	for _, source := range input.Sources {
		for _, field := range extractFields(source) {
			grouped[field.CanonicalField] = append(grouped[field.CanonicalField], field)
		}
	}
	keys := make([]string, 0, len(grouped))
	for key := range grouped {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	result := make([]Finding, 0, len(keys))
	for _, field := range keys {
		values := grouped[field]
		distinct := map[string]bool{}
		refs := make([]SourceRef, 0, len(values))
		for _, value := range values {
			distinct[normalize(value.Value)] = true
			refs = append(refs, value.Ref)
		}
		conflict := len(distinct) > 1
		finding := Finding{
			ID: "conflict:" + field, Type: CheckConflicts, Severity: "info", Status: "pass",
			SourceRefs: refs, Message: field + " is consistent across source versions.", ReviewRequired: false,
		}
		if conflict {
			finding.Severity = "critical"
			finding.Status = "fail"
			finding.Message = field + " has different values across source versions."
			finding.ReviewRequired = true
		}
		result = append(result, finding)
	}
	return result
}

func stalenessFindings(input Input) []Finding {
	asOf, _ := time.Parse("2006-01-02", input.Policy.AsOfDate)
	result := make([]Finding, 0, len(input.Sources))
	for _, source := range input.Sources {
		effective, _ := time.Parse("2006-01-02", source.EffectiveDate)
		ageDays := int(asOf.Sub(effective).Hours() / 24)
		stale := ageDays > input.Policy.StaleAfterDays
		refs := []SourceRef{}
		if len(source.Pages) > 0 {
			refs = append(refs, SourceRef{SourceID: source.ID, Page: source.Pages[0].Page, Span: source.EffectiveDate})
		}
		finding := Finding{
			ID: "staleness:" + source.ID, Type: CheckStaleness, Severity: "info", Status: "pass", SourceRefs: refs,
			Message: source.Title + " is within the configured staleness threshold.", ReviewRequired: false,
		}
		if stale {
			finding.Severity = "warning"
			finding.Status = "fail"
			finding.Message = fmt.Sprintf("%s is older than the configured %d-day threshold.", source.Title, input.Policy.StaleAfterDays)
			finding.ReviewRequired = true
		}
		result = append(result, finding)
	}
	return result
}

func refusalFindings(input Input) []Finding {
	result := make([]Finding, 0)
	for _, qa := range input.QAs {
		if qa.PolicyClass == "personalized_recommendation" {
			result = append(result, Finding{
				ID: "must-refuse:" + qa.ID, Type: CheckMustRefuse, Severity: "critical", Status: "fail", QAID: qa.ID,
				SourceRefs: []SourceRef{}, Message: "Configured policy requires a refusal. Do not produce a personalized fund recommendation.", ReviewRequired: true,
			})
		}
	}
	return result
}

func summarize(findings []Finding) map[string]CheckSummary {
	result := map[string]CheckSummary{}
	for _, check := range CheckTypes {
		result[check] = CheckSummary{}
	}
	for _, finding := range findings {
		summary := result[finding.Type]
		switch finding.Status {
		case "pass":
			summary.Pass++
		case "fail":
			summary.Fail++
		default:
			summary.Inconclusive++
		}
		result[finding.Type] = summary
	}
	return result
}

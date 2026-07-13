package preflight

import (
	"bytes"
	"encoding/json"
	"errors"
	"os"
	"reflect"
	"testing"
)

func loadFixture(t *testing.T, name string) []byte {
	t.Helper()
	data, err := os.ReadFile("../../testdata/" + name)
	if err != nil {
		t.Fatal(err)
	}
	return data
}

func TestRunReaderDeterministicAllChecks(t *testing.T) {
	data := loadFixture(t, "sample.json")
	first, err := RunReader(bytes.NewReader(data))
	if err != nil {
		t.Fatal(err)
	}
	second, err := RunReader(bytes.NewReader(data))
	if err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(first, second) {
		t.Fatal("same input produced different reports")
	}
	if !reflect.DeepEqual(first.ExecutedChecks, CheckTypes) {
		t.Fatalf("executed checks = %v", first.ExecutedChecks)
	}

	seen := map[string]bool{}
	conflicts := 0
	for _, finding := range first.Findings {
		seen[finding.Type] = true
		if finding.Type == CheckConflicts && finding.Status == "fail" {
			conflicts++
		}
		if (finding.Type == CheckSourceCoverage || finding.Type == CheckUnsupported || finding.Type == CheckConflicts) && finding.Status != "inconclusive" && len(finding.SourceRefs) == 0 {
			t.Fatalf("finding %s has no evidence address", finding.ID)
		}
	}
	if len(seen) != len(CheckTypes) {
		t.Fatalf("got check types %v", seen)
	}
	if conflicts != 2 {
		t.Fatalf("got %d conflicts, want 2", conflicts)
	}
	conflictIDs := make([]string, 0, 2)
	for _, finding := range first.Findings {
		if finding.Type == CheckConflicts {
			conflictIDs = append(conflictIDs, finding.ID)
		}
	}
	if !reflect.DeepEqual(conflictIDs, []string{"conflict:benchmark", "conflict:management_fee"}) {
		t.Fatalf("conflict order = %v", conflictIDs)
	}
}

func TestDecodeInvalidJSON(t *testing.T) {
	_, err := RunReader(bytes.NewReader(loadFixture(t, "invalid.json")))
	var validationError *ValidationError
	if !errors.As(err, &validationError) || validationError.Code != "INVALID_INPUT" {
		t.Fatalf("got %v", err)
	}
}

func TestDecodeOversizedInput(t *testing.T) {
	data := bytes.Repeat([]byte("x"), int(MaxInputBytes+1))
	_, err := RunReader(bytes.NewReader(data))
	var validationError *ValidationError
	if !errors.As(err, &validationError) || validationError.Code != "LIMIT_EXCEEDED" {
		t.Fatalf("got %v", err)
	}
}

func TestMixedFundIDsFailClosed(t *testing.T) {
	_, err := RunReader(bytes.NewReader(loadFixture(t, "mixed-funds.json")))
	var validationError *ValidationError
	if !errors.As(err, &validationError) || validationError.Code != "MIXED_FUND_IDS" {
		t.Fatalf("got %v", err)
	}
}

func TestAdversarialFixturesFailClosed(t *testing.T) {
	fixtures := []string{
		"adversarial/missing-answer.json",
		"adversarial/page-zero.json",
		"adversarial/empty-title.json",
		"adversarial/whitespace-title.json",
		"adversarial/empty-answer-non-policy.json",
		"adversarial/loose-date.json",
	}
	for _, fixture := range fixtures {
		t.Run(fixture, func(t *testing.T) {
			_, err := RunReader(bytes.NewReader(loadFixture(t, fixture)))
			var validationError *ValidationError
			if !errors.As(err, &validationError) || validationError.Code != "INVALID_INPUT" {
				t.Fatalf("got %v", err)
			}
		})
	}
}

func TestSupportUsesExactReferencedSpan(t *testing.T) {
	input, err := Decode(bytes.NewReader(loadFixture(t, "sample.json")))
	if err != nil {
		t.Fatal(err)
	}
	input.QAs[0].Answer = "IMA-B"
	report, err := Run(input)
	if err != nil {
		t.Fatal(err)
	}
	for _, finding := range report.Findings {
		if finding.ID == "support:qa-management-fee" {
			if finding.Status != "fail" {
				t.Fatalf("support status = %s, want fail", finding.Status)
			}
			return
		}
	}
	t.Fatal("support finding not found")
}

func TestOutputIsJSONCompatible(t *testing.T) {
	report, err := RunReader(bytes.NewReader(loadFixture(t, "sample.json")))
	if err != nil {
		t.Fatal(err)
	}
	if _, err := json.Marshal(report); err != nil {
		t.Fatal(err)
	}
}

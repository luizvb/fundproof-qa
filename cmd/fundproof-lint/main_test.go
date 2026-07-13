package main

import (
	"bytes"
	"encoding/json"
	"strings"
	"testing"

	"github.com/netolabs/fundproof-qa/internal/preflight"
)

func TestHelp(t *testing.T) {
	var stdout, stderr bytes.Buffer
	if code := run([]string{"--help"}, strings.NewReader(""), &stdout, &stderr); code != 0 {
		t.Fatalf("exit code = %d", code)
	}
	if !strings.Contains(stdout.String(), "Usage:") || stderr.Len() != 0 {
		t.Fatalf("stdout=%q stderr=%q", stdout.String(), stderr.String())
	}
}

func TestVersion(t *testing.T) {
	var stdout, stderr bytes.Buffer
	if code := run([]string{"--version"}, strings.NewReader(""), &stdout, &stderr); code != 0 {
		t.Fatalf("exit code = %d", code)
	}
	if strings.TrimSpace(stdout.String()) != "0.1.0" || stderr.Len() != 0 {
		t.Fatalf("stdout=%q stderr=%q", stdout.String(), stderr.String())
	}
}

func TestValidInput(t *testing.T) {
	var stdout, stderr bytes.Buffer
	code := run([]string{"../../testdata/sample.json"}, strings.NewReader(""), &stdout, &stderr)
	if code != 0 {
		t.Fatalf("exit code = %d stderr=%s", code, stderr.String())
	}
	var report preflight.Report
	if err := json.Unmarshal(stdout.Bytes(), &report); err != nil {
		t.Fatal(err)
	}
	if len(report.Findings) == 0 {
		t.Fatal("no findings")
	}
}

func TestInvalidInput(t *testing.T) {
	var stdout, stderr bytes.Buffer
	code := run([]string{"../../testdata/invalid.json"}, strings.NewReader(""), &stdout, &stderr)
	if code != 2 {
		t.Fatalf("exit code = %d", code)
	}
	if !strings.Contains(stderr.String(), "INVALID_INPUT") || stdout.Len() != 0 {
		t.Fatalf("stdout=%q stderr=%q", stdout.String(), stderr.String())
	}
}

func TestUsageError(t *testing.T) {
	var stdout, stderr bytes.Buffer
	if code := run(nil, strings.NewReader(""), &stdout, &stderr); code != 2 {
		t.Fatalf("exit code = %d", code)
	}
}

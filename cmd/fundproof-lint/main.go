package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"

	"github.com/netolabs/fundproof-qa/internal/preflight"
)

const helpText = `fundproof-lint runs deterministic QA preflight checks locally.

Usage:
  fundproof-lint <input.json>
  cat input.json | fundproof-lint -

Output:
  A FundProof QA report is written as JSON to stdout.

Exit codes:
  0  report produced
  1  unexpected runtime error
  2  invalid input or usage
`

const version = "0.1.0"

func run(args []string, stdin io.Reader, stdout, stderr io.Writer) int {
	if len(args) == 1 && (args[0] == "--help" || args[0] == "-h") {
		fmt.Fprint(stdout, helpText)
		return 0
	}
	if len(args) == 1 && args[0] == "--version" {
		fmt.Fprintln(stdout, version)
		return 0
	}
	if len(args) != 1 {
		fmt.Fprintln(stderr, "usage error: expected one JSON file path; use --help")
		return 2
	}

	reader := stdin
	var file *os.File
	if args[0] != "-" {
		opened, err := os.Open(args[0])
		if err != nil {
			fmt.Fprintf(stderr, "input error: %v\n", err)
			return 2
		}
		file = opened
		defer file.Close()
		reader = file
	}

	report, err := preflight.RunReader(reader)
	if err != nil {
		var validationError *preflight.ValidationError
		if errors.As(err, &validationError) {
			encoded, _ := json.Marshal(validationError)
			fmt.Fprintln(stderr, string(encoded))
			return 2
		}
		fmt.Fprintf(stderr, "runtime error: %v\n", err)
		return 1
	}
	encoder := json.NewEncoder(stdout)
	encoder.SetIndent("", "  ")
	if err := encoder.Encode(report); err != nil {
		fmt.Fprintf(stderr, "output error: %v\n", err)
		return 1
	}
	return 0
}

func main() {
	os.Exit(run(os.Args[1:], os.Stdin, os.Stdout, os.Stderr))
}

#!/usr/bin/env bash
# Fails if staged changes contain any pattern from the private leak list (LICENSE excluded).
set -euo pipefail
patterns=".private/leak_patterns.txt"
[ -f "$patterns" ] || { echo "leak_check: $patterns missing, skipping"; exit 0; }
hits=$(git diff --cached -U0 -- . ':(exclude)LICENSE' | grep '^+' | grep -v '^+++' | grep -inEf "$patterns" || true)
if [ -n "$hits" ]; then
  echo "leak_check: staged changes mention something they must not:"
  echo "$hits"
  exit 1
fi

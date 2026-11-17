#!/usr/bin/env bash
# Before/after for 0a. Extracts the base commit's src into a scratch dir (never
# touches the working tree or any branch), runs figures.mts against it and
# against the working tree under a fixed clock and UTC, and diffs the output.
# Usage: scripts/med-checks/diff-figures.sh [base-ref]   (default: HEAD)
set -euo pipefail
cd "$(dirname "$0")/../.."
BASE="${1:-HEAD}"
TSX=node_modules/code-ds/node_modules/.bin/tsx
OUT="${OUT_DIR:-$(mktemp -d)}"
mkdir -p "$OUT/base"
git archive "$BASE" src package.json tsconfig.json tsconfig.app.json tsconfig.node.json | tar -x -C "$OUT/base"
ln -sfn "$PWD/node_modules" "$OUT/base/node_modules"
TZ=UTC ROOT="$OUT/base" "$TSX" --tsconfig "$OUT/base/tsconfig.app.json" scripts/med-checks/figures.mts > "$OUT/before.txt"
TZ=UTC ROOT="$PWD"      "$TSX" --tsconfig tsconfig.app.json scripts/med-checks/figures.mts > "$OUT/after.txt"
echo "base: $(git rev-parse --short "$BASE")   lines before/after: $(wc -l < "$OUT/before.txt") / $(wc -l < "$OUT/after.txt")"
if diff -u "$OUT/before.txt" "$OUT/after.txt" > "$OUT/figures.diff"; then
  echo "IDENTICAL: no figure on Today or Insights changed."
else
  echo "DIFFERENT:"; cat "$OUT/figures.diff"; exit 1
fi
echo "outputs: $OUT"

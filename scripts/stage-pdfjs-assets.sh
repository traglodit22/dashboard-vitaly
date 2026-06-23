#!/usr/bin/env bash
# pdfjs-dist в standalone содержит только pdf.mjs — без worker/fonts превью PDF падает.
set -euo pipefail

DST="${1:?usage: stage-pdfjs-assets.sh <runtime>/node_modules/pdfjs-dist}"
SRC="$(cd "$(dirname "$0")/.." && pwd)/node_modules/pdfjs-dist"

[[ -d "$SRC" ]] || { echo "ERROR: pdfjs-dist not found at $SRC"; exit 1; }
[[ -d "$DST" ]] || { echo "ERROR: pdfjs-dist dst missing: $DST"; exit 1; }

mkdir -p "$DST/legacy/build"
cp -f "$SRC/legacy/build/pdf.worker.mjs" "$DST/legacy/build/"
cp -f "$SRC/legacy/build/pdf.worker.min.mjs" "$DST/legacy/build/"
rsync -a "$SRC/standard_fonts/" "$DST/standard_fonts/"
rsync -a "$SRC/cmaps/" "$DST/cmaps/"
[[ -d "$SRC/wasm" ]] && rsync -a "$SRC/wasm/" "$DST/wasm/" || true
[[ -d "$SRC/iccs" ]] && rsync -a "$SRC/iccs/" "$DST/iccs/" || true

for required in \
  "$DST/legacy/build/pdf.worker.mjs" \
  "$DST/standard_fonts/FoxitFixed.pfb" \
  "$DST/cmaps/Adobe-CNS1-UCS2.bcmap"; do
  if [[ ! -f "$required" ]]; then
    echo "ERROR: missing pdfjs asset: $required"
    exit 1
  fi
done

echo "==> pdfjs assets staged in $DST"

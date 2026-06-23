#!/usr/bin/env bash
# pdfjs-dist в standalone содержит только pdf.mjs — без worker/fonts превью PDF падает.
set -euo pipefail

DST="${1:?usage: stage-pdfjs-assets.sh <runtime>/node_modules/pdfjs-dist}"
SRC="$(cd "$(dirname "$0")/.." && pwd)/node_modules/pdfjs-dist"

[[ -d "$SRC" ]] || { echo "WARNING: pdfjs-dist not found at $SRC"; exit 0; }
[[ -d "$DST" ]] || { echo "WARNING: pdfjs-dist dst missing: $DST"; exit 0; }

mkdir -p "$DST/legacy/build"
cp -f "$SRC/legacy/build/pdf.worker.mjs" "$DST/legacy/build/" 2>/dev/null || true
cp -f "$SRC/legacy/build/pdf.worker.min.mjs" "$DST/legacy/build/" 2>/dev/null || true
rsync -a "$SRC/standard_fonts/" "$DST/standard_fonts/"
rsync -a "$SRC/cmaps/" "$DST/cmaps/"
[[ -d "$SRC/wasm" ]] && rsync -a "$SRC/wasm/" "$DST/wasm/" || true
[[ -d "$SRC/iccs" ]] && rsync -a "$SRC/iccs/" "$DST/iccs/" || true

echo "==> pdfjs assets staged in $DST"

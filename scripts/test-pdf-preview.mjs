#!/usr/bin/env node
/** Диагностика PDF-превью на сервере: node scripts/test-pdf-preview.mjs [file.pdf] */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { buildFilePreview } from '../src/lib/files/pdfPreview.ts'

const sample =
  process.argv[2] ??
  path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'uploads', 'files', 'important-documents')

let pdfPath = sample
if (fs.existsSync(sample) && fs.statSync(sample).isDirectory()) {
  const found = walkDir(sample).find((p) => p.toLowerCase().endsWith('.pdf'))
  if (!found) {
    console.error('PDF не найден в', sample)
    process.exit(1)
  }
  pdfPath = found
}

if (!fs.existsSync(pdfPath)) {
  console.error('Файл не найден:', pdfPath)
  process.exit(1)
}

const buffer = fs.readFileSync(pdfPath)
console.log('PDF:', pdfPath, 'bytes:', buffer.length)
const t0 = Date.now()
const preview = await buildFilePreview('application/pdf', buffer, path.basename(pdfPath))
console.log('preview bytes:', preview?.length ?? null, 'ms:', Date.now() - t0)
if (!preview) process.exit(1)

function walkDir(dir) {
  const out = []
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name)
    const st = fs.statSync(full)
    if (st.isDirectory()) out.push(...walkDir(full))
    else out.push(full)
  }
  return out
}

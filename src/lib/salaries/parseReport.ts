import * as XLSX from 'xlsx'

// Одна строка отчёта тайм-трекера (DeskTime-подобный экспорт).
export interface ParsedTimeRow {
  name: string
  email: string // нормализован в lower-case — это ключ сопоставления с сотрудником
  hours: number // часы за период
}

// Заголовки колонок в экспорте. Ищем по имени, а не по позиции — порядок может меняться.
const COL_NAME = 'User name'
const COL_EMAIL = 'Email'
const COL_HOURS = 'Productive time (sum)'

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

// Парсит xlsx-отчёт тайм-трекера в строки {имя, email, часы}.
// ВАЖНО: «Productive time» хранится как длительность Excel (формат [h]:mm:ss),
// т.е. в долях суток. Часы = значение × 24.
export function parseTimeReport(buffer: Buffer): ParsedTimeRow[] {
  const wb = XLSX.read(buffer, { type: 'buffer' })
  const sheetName = wb.SheetNames[0]
  if (!sheetName) throw new Error('В файле нет листов')

  const ws = wb.Sheets[sheetName]
  const rows = XLSX.utils.sheet_to_json<(string | number | null)[]>(ws, {
    header: 1,
    blankrows: false,
  })
  if (rows.length < 2) throw new Error('В файле нет данных')

  const header = rows[0].map((c) => String(c ?? '').trim())
  const iName = header.indexOf(COL_NAME)
  const iEmail = header.indexOf(COL_EMAIL)
  const iHours = header.indexOf(COL_HOURS)
  if (iEmail === -1 || iHours === -1) {
    throw new Error(
      `Не найдены колонки «${COL_EMAIL}» и «${COL_HOURS}». Похоже, это файл не того формата.`,
    )
  }

  const result: ParsedTimeRow[] = []
  for (const row of rows.slice(1)) {
    const email = String(row[iEmail] ?? '').trim().toLowerCase()
    const name = iName === -1 ? '' : String(row[iName] ?? '').trim()
    if (!email && !name) continue

    const raw = row[iHours]
    const dayFraction = typeof raw === 'number' ? raw : Number(raw)
    const hours = Number.isFinite(dayFraction) ? dayFraction * 24 : 0

    result.push({ name, email, hours: round2(hours) })
  }
  return result
}

// Итог начисления: часы × ставка + премии − удержания. Округляем до копеек.
export function computeTotal(
  hours: number,
  hourlyRate: number,
  bonuses: number,
  deductions: number,
): number {
  const total = hours * hourlyRate + bonuses - deductions
  return Math.round(total * 100) / 100
}

// Детерминированный id записи начисления, чтобы upsert был идемпотентным.
export function salaryRecordId(month: string, employeeId: string): string {
  return `${month}_${employeeId}`
}

// Проверка формата месяца "YYYY-MM".
export function isValidMonth(month: unknown): month is string {
  return typeof month === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(month)
}

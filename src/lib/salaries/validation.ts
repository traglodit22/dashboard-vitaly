export interface EmployeeDraft {
  name: string
  role: string
  hourlyRate: number
  trackerEmail: string
  telegramId?: string
}

// Достаёт поля сотрудника из тела запроса, приводя типы.
export function parseEmployeeBody(body: Record<string, unknown>): EmployeeDraft {
  return {
    name: String(body.name ?? '').trim(),
    role: String(body.role ?? '').trim(),
    hourlyRate: Number(body.hourlyRate ?? 0),
    trackerEmail: String(body.trackerEmail ?? '').trim().toLowerCase(),
    telegramId: body.telegramId ? String(body.telegramId).trim() : undefined,
  }
}

export function validateEmployee(d: EmployeeDraft): string[] {
  const errors: string[] = []
  if (!d.name) errors.push('Укажите имя сотрудника')
  if (!Number.isFinite(d.hourlyRate) || d.hourlyRate < 0) {
    errors.push('Ставка должна быть числом ≥ 0')
  }
  if (!d.trackerEmail) {
    errors.push('Укажите email из тайм-трекера — по нему сопоставляется отчёт')
  } else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.trackerEmail)) {
    errors.push('Email из тайм-трекера выглядит некорректно')
  }
  return errors
}

type RevPart = number | { total?: number; salesCount?: number } | null | undefined

function revAmount(v: RevPart): number | undefined {
  if (v == null) return undefined
  if (typeof v === 'number') return v
  if (typeof v === 'object' && typeof v.total === 'number') return v.total
  return undefined
}

function normalizeBreakdown(v: unknown): Record<string, number> | undefined {
  if (!v) return undefined
  if (Array.isArray(v)) {
    const out: Record<string, number> = {}
    for (const item of v) {
      if (!item || typeof item !== 'object') continue
      const row = item as Record<string, unknown>
      const name = String(row.name ?? row.type ?? row.label ?? row.title ?? '').trim()
      const qty = Number(row.count ?? row.qty ?? row.quantity ?? row.value ?? 0)
      if (name) out[name] = qty
    }
    return Object.keys(out).length > 0 ? out : undefined
  }
  if (typeof v === 'object') {
    const out: Record<string, number> = {}
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      const n = Number(val)
      if (!Number.isNaN(n)) out[k] = n
    }
    return Object.keys(out).length > 0 ? out : undefined
  }
  return undefined
}

function normalizeRevenue(revenue: unknown) {
  if (!revenue || typeof revenue !== 'object') return revenue
  const r = revenue as Record<string, unknown>
  return {
    ...r,
    total: typeof r.total === 'number' ? r.total : revAmount(r.total as RevPart),
    salesCount: typeof r.salesCount === 'number' ? r.salesCount : undefined,
    cash: revAmount(r.cash as RevPart),
    card: revAmount(r.card as RevPart),
    erip: revAmount(r.erip as RevPart),
    nonCashGroups: revAmount(r.nonCashGroups as RevPart),
    cashier: revAmount(r.cashier as RevPart),
  }
}

function normalizeVisitors(visitors: unknown) {
  if (!visitors || typeof visitors !== 'object') return visitors
  const v = visitors as Record<string, unknown>
  return {
    ...v,
    breakdown: normalizeBreakdown(v.breakdown),
    salesBreakdown: normalizeBreakdown(v.salesBreakdown),
  }
}

/** Приводит ответ Las Legas API к плоским суммам и объектам breakdown. */
export function normalizeLasLegasPayload<T>(data: T): T {
  if (!data || typeof data !== 'object') return data
  const root = data as Record<string, unknown>
  const out: Record<string, unknown> = { ...root }

  if (root.today && typeof root.today === 'object') {
    const today = root.today as Record<string, unknown>
    out.today = {
      ...today,
      visitors: normalizeVisitors(today.visitors),
      revenue: normalizeRevenue(today.revenue),
    }
  }

  for (const key of ['month', 'last7d', 'last30d'] as const) {
    if (!root[key] || typeof root[key] !== 'object') continue
    const block = root[key] as Record<string, unknown>
    out[key] = {
      ...block,
      revenue: normalizeRevenue(block.revenue),
    }
  }

  if (root.visitors) out.visitors = normalizeVisitors(root.visitors)
  if (root.revenue) out.revenue = normalizeRevenue(root.revenue)

  if (root.history && Array.isArray(root.history)) {
    out.history = root.history.map((row) => {
      if (!row || typeof row !== 'object') return row
      const h = row as Record<string, unknown>
      return {
        ...h,
        revenue:
          typeof h.revenue === 'number'
            ? h.revenue
            : revAmount(h.revenue as RevPart),
      }
    })
  }

  return out as T
}

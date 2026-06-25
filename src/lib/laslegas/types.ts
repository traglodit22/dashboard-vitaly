export interface LasLegasPeriodStats {
  label?: string
  from?: string
  to?: string
  visitors?: number
  ticketsSold?: number
  revenue?: { total?: number; salesCount?: number; cash?: number; card?: number; erip?: number; nonCashGroups?: number }
}

export interface LasLegasOverview {
  source: 'las-legas'
  generatedAt: string
  today: {
    visitors: {
      date: string
      dateLabel?: string
      visitors: number
      ticketsSold: number
      breakdown?: Record<string, number>
      salesBreakdown?: Record<string, number>
    }
    revenue: {
      total: number
      salesCount?: number
      cash?: number
      card?: number
      erip?: number
      nonCashGroups?: number
      cashier?: number
    }
  }
  month: LasLegasPeriodStats & { label?: string }
  last7d: LasLegasPeriodStats
  last30d: LasLegasPeriodStats
}

export interface LasLegasCalendarDay {
  date: string
  day: number
  inMonth: boolean
  isToday: boolean
}

export interface LasLegasCalendar {
  source: 'las-legas'
  month: string
  monthLabel: string
  dayCounts: Record<
    string,
    { visitors: number; ticketsSold: number; revenue: number }
  >
  calendar: LasLegasCalendarDay[]
}

export interface LasLegasDayDetail {
  source?: 'las-legas'
  date?: string
  visitors?: {
    date?: string
    dateLabel?: string
    visitors?: number
    ticketsSold?: number
    breakdown?: Record<string, number>
    salesBreakdown?: Record<string, number>
  }
  revenue?: {
    total?: number
    salesCount?: number
    cash?: number
    card?: number
    erip?: number
    nonCashGroups?: number
  }
}

export interface LasLegasPeriodDetail {
  source?: 'las-legas'
  period?: string
  visitors?: {
    visitors?: number
    ticketsSold?: number
    breakdown?: Record<string, number>
    salesBreakdown?: Record<string, number>
  }
  revenue?: {
    total?: number
    salesCount?: number
    cash?: number
    card?: number
    erip?: number
    nonCashGroups?: number
  }
  summary?: Record<string, number>
  history?: Array<{
    date: string
    visitors?: number
    ticketsSold?: number
    revenue?: number
  }>
}
